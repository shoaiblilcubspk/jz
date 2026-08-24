/* DB Movement Analyzer — connects to live Supabase (service role), extracts data,
 * builds per-module IN/OUT/REMAINING movement report. Output: MD + JSON + CSV. */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('Missing creds'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const PAGE = 5000;
async function fetchAll(table, cols = '*', order = 'created_at') {
  let rows = [], from = 0, done = false;
  while (!done) {
    let q = sb.from(table).select(cols, { count: 'exact' });
    if (order) q = q.order(order, { ascending: true });
    q = q.range(from, from + PAGE - 1);
    const { data, error, count } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (data && data.length) rows = rows.concat(data);
    from += PAGE;
    if (!data || data.length < PAGE) done = true;
    if (count !== null && from >= count) done = true;
  }
  return rows;
}

// ---- INVENTORY CLASSIFICATION ----
const OUT = new Set(['sale', 'adjustment_out']);
const IN  = new Set(['initial', 'stock_in', 'purchase', 'return']);
const ADJ = new Set(['adjustment']);

function classify(type, qty) {
  if (OUT.has(type)) return { in: 0, out: Math.abs(qty) };
  if (IN.has(type))  return { in: Math.abs(qty), out: 0 };
  if (ADJ.has(type)) return qty >= 0 ? { in: qty, out: 0 } : { in: 0, out: Math.abs(qty) };
  return { in: 0, out: 0, unknown: qty };
}

(async () => {
  const out = { generated_at: new Date().toISOString(), modules: {} };
  const tableCounts = {};

  // ---- 0. TABLE COUNTS ----
  const tables = ['users','app_settings','categories','customers','customer_ledger','suppliers',
    'products','discounts','sales','salesmen','expenses','sales_tabs','purchase_records',
    'purchase_orders','purchase_order_items','supplier_transactions','payments','stock_history',
    'bundles','bundle_items','variant_stock_history','row_tombstones','product_addons','toppings',
    'product_toppings','payment_modes','payment_movements','sale_audit_log','stock_mismatches',
    'price_history','sessions'];
  for (const t of tables) {
    try { const { count } = await sb.from(t).select('*', { count: 'exact', head: true }); tableCounts[t] = count || 0; }
    catch (e) { tableCounts[t] = `ERR:${e.message}`; }
  }
  out.table_counts = tableCounts;

  // ---- 1. INVENTORY (stock_history + products) ----
  const products = await fetchAll('products', 'id,name,sku,stock,category,track_inventory');
  const sh = await fetchAll('stock_history', 'product_id,type,change_qty,balance_after,created_at', 'created_at');
  const perProduct = {};
  const typeTotals = {};
  for (const r of sh) {
    typeTotals[r.type] = (typeTotals[r.type] || 0) + (r.change_qty || 0);
    const p = perProduct[r.product_id] || (perProduct[r.product_id] = { in:0, out:0, rows:0, lastBalance:null, lastTs:null });
    const c = classify(r.type, r.change_qty || 0);
    p.in += c.in; p.out += c.out; p.rows += 1;
    p.lastBalance = r.balance_after; p.lastTs = r.created_at;
  }
  const recon = [];
  let mismatchCount = 0;
  for (const p of products) {
    const agg = perProduct[p.id] || { in:0, out:0, rows:0, lastBalance:null };
    const expected = agg.in - agg.out; // initial included in IN
    const actual = p.stock || 0;
    const lastBal = agg.lastBalance == null ? 0 : agg.lastBalance;
    const stockMatch = (actual === expected);
    // real drift = computed IN-OUT != authoritative products.stock
    const stockFlag = stockMatch ? 'OK' : 'DRIFT';
    // balance_after metadata gap = ledger never maintains running balance
    const ledgerGap = (agg.rows > 0 && agg.lastBalance == null) || (lastBal !== expected);
    if (!stockMatch) mismatchCount++;
    recon.push({
      sku: p.sku, name: p.name, category: p.category, track: p.track_inventory,
      in_total: agg.in, out_total: agg.out, expected_stock: expected,
      actual_stock: actual, last_ledger_balance: lastBal,
      stock_consistent: stockMatch, stock_flag: stockFlag,
      balance_after_gap: ledgerGap
    });
  }
  out.modules.inventory = {
    products_total: products.length,
    stock_history_rows: sh.length,
    type_totals: typeTotals,
    in_total: Object.values(perProduct).reduce((a,p)=>a+p.in,0),
    out_total: Object.values(perProduct).reduce((a,p)=>a+p.out,0),
    mismatches: mismatchCount,
    reconciliation: recon.sort((a,b)=> (a.stock_flag===b.stock_flag?0:(a.stock_flag==='DRIFT'?-1:1)))
  };

  // ---- 2. VARIANT STOCK ----
  const vsh = await fetchAll('variant_stock_history', 'product_id,variant_id,type,change_qty,balance_after', 'created_at');
  const vPer = {}; const vType = {};
  for (const r of vsh) {
    vType[r.type] = (vType[r.type]||0)+(r.change_qty||0);
    const k = `${r.product_id}::${r.variant_id}`;
    const p = vPer[k] || (vPer[k]={in:0,out:0,rows:0,lastBalance:null});
    const c = classify(r.type, r.change_qty||0); p.in+=c.in; p.out+=c.out; p.rows++; p.lastBalance=r.balance_after;
  }
  const vRecon = [];
  for (const [k,p] of Object.entries(vPer)) {
    const expected = p.in - p.out; const lastBal = p.lastBalance==null?0:p.lastBalance;
    vRecon.push({ key:k, in_total:p.in, out_total:p.out, expected:expected, last_ledger_balance:lastBal,
      consistent: expected===lastBal, flag: expected===lastBal?'OK':'MISMATCH' });
  }
  out.modules.variant_inventory = { rows: vsh.length, type_totals: vType, mismatches: vRecon.filter(r=>r.flag==='MISMATCH').length, reconciliation: vRecon };

  // ---- 3. SALES ----
  const sales = await fetchAll('sales', 'id,status,total,refunded_amount,payment_method,sale_type,created_at', 'created_at');
  const saleStatus = {}; const saleType = {};
  let grossRev=0, refunded=0, draftCount=0;
  for (const s of sales) {
    saleStatus[s.status]=(saleStatus[s.status]||0)+1;
    saleType[s.sale_type]=(saleType[s.sale_type]||0)+1;
    if (s.status!=='draft' && s.status!=='deleted' && s.status!=='cancelled') grossRev+=(+s.total||0);
    refunded+=(+s.refunded_amount||0);
    if (s.status==='draft') draftCount++;
  }
  out.modules.sales = { total: sales.length, by_status: saleStatus, by_type: saleType,
    net_revenue_incl_refund: grossRev, total_refunded: refunded, draft_count: draftCount };

  // ---- 4. PURCHASES ----
  const pr = await fetchAll('purchase_records', 'id,total_amount,status,created_at', 'created_at').catch(()=>[]);
  const po = await fetchAll('purchase_orders', 'id,status,total,created_at', 'created_at').catch(()=>[]);
  const stx = await fetchAll('supplier_transactions', 'id,type,amount,created_at', 'created_at').catch(()=>[]);
  const stxIn = stx.filter(t=>['purchase','payment_out','credit','return'].includes(t.type)).reduce((a,t)=>a+(+t.amount||0),0);
  const stxOut = stx.filter(t=>['payment','debit'].includes(t.type)).reduce((a,t)=>a+(+t.amount||0),0);
  out.modules.purchases = { purchase_records: pr.length, purchase_orders: po.length,
    purchase_record_value: pr.reduce((a,r)=>a+(+r.total_amount||0),0),
    purchase_orders_value: po.reduce((a,o)=>a+(+o.total||0),0),
    supplier_transactions: stx.length, stx_in: stxIn, stx_out: stxOut };

  // ---- 5. PAYMENTS / CASH ----
  const pm = await fetchAll('payment_modes', 'id,name,balance', null);
  const pmt = await fetchAll('payment_movements', 'mode_id,delta,note,created_at', 'created_at').catch(()=>[]);
  const pmtByMode = {};
  for (const m of pmt) { pmtByMode[m.mode_id]=(pmtByMode[m.mode_id]||0)+(+m.delta||0); }
  out.modules.payments = { modes: pm.map(m=>({id:m.id,name:m.name,balance:m.balance})),
    movement_rows: pmt.length, net_by_mode: pmtByMode,
    total_in: Object.values(pmtByMode).filter(v=>v>0).reduce((a,v)=>a+v,0),
    total_out: Object.values(pmtByMode).filter(v=>v<0).reduce((a,v)=>a+Math.abs(v),0) };

  // ---- 6. CUSTOMER LEDGER ----
  const cl = await fetchAll('customer_ledger', 'customer_id,type,amount,created_at', 'created_at').catch(()=>[]);
  const clIn = cl.filter(t=>['sale','debit','charge'].includes(t.type)).reduce((a,t)=>a+(+t.amount||0),0);
  const clOut = cl.filter(t=>['payment','credit','refund'].includes(t.type)).reduce((a,t)=>a+(+t.amount||0),0);
  out.modules.customer_ledger = { rows: cl.length, in: clIn, out: clOut, net_balance: clIn-clOut };

  // ---- 7. AUDIT / INTEGRITY ----
  const mis = await fetchAll('stock_mismatches', '*', 'created_at').catch(()=>[]);
  const tom = await fetchAll('row_tombstones', 'table_name,ref_id,deleted_at', 'deleted_at').catch(()=>[]);
  const tomByTable = {}; for (const t of tom) tomByTable[t.table_name]=(tomByTable[t.table_name]||0)+1;
  const sal = await fetchAll('sale_audit_log', 'action,created_at', 'created_at').catch(()=>[]);
  const salByAction = {}; for (const a of sal) salByAction[a.action]=(salByAction[a.action]||0)+1;
  out.modules.audit = { stock_mismatches: mis.length, stock_mismatch_rows: mis.slice(0,50),
    tombstones_total: tom.length, tombstones_by_table: tomByTable,
    sale_audit_actions: salByAction };

  // ---- WRITE OUTPUTS ----
  fs.writeFileSync('db_movement_report.json', JSON.stringify(out, null, 2));
  buildMarkdown(out, fs);
  buildCsv(out, fs);
  console.log('DONE. mismatches(inv)=', out.modules.inventory.mismatches,
    'variant_mismatch=', out.modules.variant_inventory.mismatches,
    'stock_mismatches_table=', mis.length, 'tombstones=', tom.length);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });

function buildMarkdown(out, fs) {
  const L = [];
  L.push(`# DB Movement & Reconciliation Report`);
  L.push(`_Generated: ${out.generated_at}_`);
  L.push('');
  L.push(`## Table Counts`);
  L.push('| Table | Rows |');
  L.push('|-------|------|');
  for (const [k,v] of Object.entries(out.table_counts)) L.push(`| ${k} | ${v} |`);
  L.push('');

  const inv = out.modules.inventory;
  L.push(`## Module 1 — INVENTORY (stock_history → products.stock)`);
  L.push(`Products: **${inv.products_total}**, Stock-history rows: **${inv.stock_history_rows}**`);
  L.push(`Total IN: **${inv.in_total}**, Total OUT: **${inv.out_total}**`);
  L.push(`**Mismatches: ${inv.mismatches}**`);
  L.push('');
  L.push(`### Movement by type`);
  L.push('| Type | Δ qty |'); L.push('|------|-------|');
  for (const [k,v] of Object.entries(inv.type_totals)) L.push(`| ${k} | ${v} |`);
  L.push('');
  L.push(`### Reconciliation (expected = IN−OUT vs authoritative products.stock)`);
  L.push(`> NOTE: stock_history.balance_after is NOT maintained by the trigger (null on all rows except initial). Real drift = IN−OUT ≠ products.stock.`);
  L.push(`| SKU | Name | Category | Track | IN | OUT | Expected | ActualStock | StockOK | balance_after_gap |`);
  L.push(`|-----|------|----------|-------|----|-----|----------|-------------|---------|-------------------|`);
  for (const r of inv.reconciliation) {
    L.push(`| ${r.sku} | ${r.name} | ${r.category} | ${r.track} | ${r.in_total} | ${r.out_total} | ${r.expected_stock} | ${r.actual_stock} | ${r.stock_consistent} | ${r.balance_after_gap} |`);
  }
  L.push('');

  const vin = out.modules.variant_inventory;
  L.push(`## Module 2 — VARIANT INVENTORY (variant_stock_history)`);
  L.push(`Rows: **${vin.rows}**, Mismatches: **${vin.mismatches}**`);
  L.push('| Type | Δ qty |'); L.push('|------|-------|');
  for (const [k,v] of Object.entries(vin.type_totals)) L.push(`| ${k} | ${v} |`);
  L.push('');

  const s = out.modules.sales;
  L.push(`## Module 3 — SALES`);
  L.push(`Total: **${s.total}**, Net revenue (excl draft/deleted/cancelled): **${s.net_revenue_incl_refund}**, Refunded: **${s.total_refunded}**, Drafts: **${s.draft_count}**`);
  L.push('| Status | Count |'); L.push('|--------|-------|');
  for (const [k,v] of Object.entries(s.by_status)) L.push(`| ${k} | ${v} |`);
  L.push('');

  const p = out.modules.purchases;
  L.push(`## Module 4 — PURCHASES`);
  L.push(`Purchase records: **${p.purchase_records}** (value ${p.purchase_record_value}), PO: **${p.purchase_orders}** (value ${p.purchase_orders_value})`);
  L.push(`Supplier txns: **${p.supplier_transactions}**, IN ${p.stx_in}, OUT ${p.stx_out}`);
  L.push('');

  const pay = out.modules.payments;
  L.push(`## Module 5 — PAYMENTS / CASH`);
  L.push(`Movement rows: **${pay.movement_rows}**, Total IN ${pay.total_in}, Total OUT ${pay.total_out}`);
  L.push(`> NOTE: payment_modes.balance is a separately-tracked snapshot; net movement is sum of payment_movements deltas. Diff = balance − net.`);
  L.push('| Mode | Balance | Net movement | Diff |');
  L.push('|------|---------|--------------|------|');
  for (const m of pay.modes) { const net=pay.net_by_mode[m.id]||0; L.push(`| ${m.name} (${m.id}) | ${m.balance} | ${net} | ${((+m.balance)-net).toFixed(2)} |`); }
  L.push('');

  const cl = out.modules.customer_ledger;
  L.push(`## Module 6 — CUSTOMER LEDGER`);
  L.push(`Rows: **${cl.rows}**, IN ${cl.in}, OUT ${cl.out}, Net balance ${cl.net_balance}`);
  L.push('');

  const a = out.modules.audit;
  L.push(`## Module 7 — AUDIT / INTEGRITY`);
  L.push(`stock_mismatches table rows: **${a.stock_mismatches}**`);
  L.push(`Tombstones: **${a.tombstones_total}** — ${JSON.stringify(a.tombstones_by_table)}`);
  L.push(`Sale audit actions: ${JSON.stringify(a.sale_audit_actions)}`);
  L.push('');

  fs.writeFileSync('db_movement_report.md', L.join('\n'));
}

function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function toCsv(rows){ if(!rows.length) return ''; const cols=Object.keys(rows[0]);
  return [cols.join(','), ...rows.map(r=>cols.map(c=>csvEscape(r[c])).join(','))].join('\n'); }
function buildCsv(out, fs){
  fs.writeFileSync('inv_reconciliation.csv', toCsv(out.modules.inventory.reconciliation));
  fs.writeFileSync('variant_reconciliation.csv', toCsv(out.modules.variant_inventory.reconciliation));
  const payRows = out.modules.payments.modes.map(m=>({mode:m.id,name:m.name,balance:m.balance,net:out.modules.payments.net_by_mode[m.id]||0}));
  fs.writeFileSync('payment_movements.csv', toCsv(payRows));
  fs.writeFileSync('table_counts.csv', toCsv(Object.entries(out.table_counts).map(([t,c])=>({table:t,rows:c}))));
}
