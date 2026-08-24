/* Row-wise movement ledger — every transaction 1-by-1 with running balance + timestamp.
 * Output: DB_ANALYSIS_REPORT/ (one CSV per module + index.md) */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const URL = process.env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
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
const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = rows => { if (!rows.length) return ''; const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'); };

(async () => {
  const files = {};
  const write = (name, rows) => { const p = `DB_ANALYSIS_REPORT/${name}`; fs.writeFileSync(p, toCsv(rows)); files[name] = rows.length; };

  // ===== INVENTORY LEDGER (row by row, running balance per product) =====
  const products = await fetchAll('products', 'id,name,sku,category,stock');
  const prodMap = {}; for (const p of products) prodMap[p.id] = p;
  const sh = await fetchAll('stock_history', 'product_id,type,change_qty,balance_after,note,cashier_name,reference_id,created_at', 'created_at');
  const shByProd = {};
  for (const r of sh) (shByProd[r.product_id] = shByProd[r.product_id] || []).push(r);
  const invRows = [];
  for (const [pid, rows] of Object.entries(shByProd)) {
    let run = 0;
    for (const r of rows) {
      run += (r.change_qty || 0);
      const pr = prodMap[pid] || {};
      invRows.push({
        product_sku: pr.sku || '', product_name: pr.name || '', category: pr.category || '',
        created_at: r.created_at, type: r.type, change_qty: r.change_qty,
        running_balance: run, ledger_balance_after: r.balance_after,
        running_vs_ledger_ok: (r.balance_after == null ? '' : (run === r.balance_after ? 'yes' : 'NO')),
        note: r.note || '', cashier: r.cashier_name || '', reference_id: r.reference_id || ''
      });
    }
  }
  write('01_inventory_stock_history.csv', invRows);

  // ===== VARIANT LEDGER =====
  const vsh = await fetchAll('variant_stock_history', 'product_id,variant_id,variant_label,type,change_qty,balance_after,note,created_at', 'created_at');
  const vMap = {};
  for (const r of vsh) { const k = `${r.product_id}::${r.variant_id}`; (vMap[k] = vMap[k] || []).push(r); }
  const vRows = [];
  for (const [k, rows] of Object.entries(vMap)) { let run = 0; for (const r of rows) { run += (r.change_qty || 0);
    vRows.push({ variant_key: k, variant_label: r.variant_label || '', created_at: r.created_at, type: r.type,
      change_qty: r.change_qty, running_balance: run, ledger_balance_after: r.balance_after, note: r.note || '' }); } }
  write('02_variant_stock_history.csv', vRows);

  // ===== SALES LEDGER =====
  const sales = await fetchAll('sales', 'invoice_number,status,sale_type,total,refunded_amount,payment_method,cashier,customer_name,items,timestamp,created_at', 'created_at');
  const saleRows = sales.map(s => ({ invoice: s.invoice_number, status: s.status, sale_type: s.sale_type,
    total: s.total, refunded: s.refunded_amount, payment_method: s.payment_method, cashier: s.cashier,
    customer: s.customer_name || '', items_count: Array.isArray(s.items) ? s.items.length : 0,
    timestamp: s.timestamp || s.created_at, created_at: s.created_at }));
  write('03_sales_ledger.csv', saleRows);

  // ===== PAYMENT MOVEMENTS LEDGER (running per mode) =====
  const pmt = await fetchAll('payment_movements', 'mode_id,delta,note,reference_id,created_at', 'created_at');
  const pmtByMode = {};
  for (const r of pmt) (pmtByMode[r.mode_id] = pmtByMode[r.mode_id] || []).push(r);
  const pmtRows = [];
  for (const [mode, rows] of Object.entries(pmtByMode)) { let run = 0; for (const r of rows) { run += (+r.delta || 0);
    pmtRows.push({ mode_id: mode, created_at: r.created_at, delta: r.delta, running_balance: run, note: r.note || '', reference_id: r.reference_id || '' }); } }
  write('04_payment_movements.csv', pmtRows);

  // ===== PURCHASE LEDGER (records + PO + supplier txns) =====
  const pr = await fetchAll('purchase_records', 'id,supplier,total_amount,status,note,created_at', 'created_at').catch(()=>[]);
  const prRows = pr.map(r => ({ source: 'purchase_record', ref_id: r.id, party: r.supplier || '', amount: r.total_amount,
    status: r.status, note: r.note || '', created_at: r.created_at }));
  const stx = await fetchAll('supplier_transactions', 'id,supplier_id,type,amount,note,created_at', 'created_at').catch(()=>[]);
  const stxRows = stx.map(r => ({ source: 'supplier_transaction', ref_id: r.id, party: r.supplier_id || '', type: r.type,
    amount: r.amount, status: '', note: r.note || '', created_at: r.created_at }));
  write('05_purchase_ledger.csv', [...prRows, ...stxRows].sort((a,b)=> (a.created_at>b.created_at?1:-1)));

  // ===== CUSTOMER LEDGER =====
  const cl = await fetchAll('customer_ledger', 'customer_id,type,amount,note,reference_id,created_at', 'created_at').catch(()=>[]);
  const clRows = cl.map(r => ({ customer_id: r.customer_id, type: r.type, amount: r.amount, note: r.note || '',
    reference_id: r.reference_id || '', created_at: r.created_at }));
  write('06_customer_ledger.csv', clRows);

  // ===== AUDIT / INTEGRITY LEDGER =====
  const tom = await fetchAll('row_tombstones', 'table_name,ref_id,deleted_at', 'deleted_at').catch(()=>[]);
  const tomRows = tom.map(r => ({ type: 'TOMBSTONE', table_name: r.table_name, ref_id: r.ref_id, created_at: r.deleted_at, detail: '' }));
  const sal = await fetchAll('sale_audit_log', 'sale_id,invoice_number,action,performed_by_name,performed_by_role,note,created_at', 'created_at').catch(()=>[]);
  const salRows = sal.map(r => ({ type: 'SALE_AUDIT', sale_id: r.sale_id, invoice: r.invoice_number, action: r.action,
    by: r.performed_by_name || '', role: r.performed_by_role || '', created_at: r.created_at, detail: r.note || '' }));
  const mis = await fetchAll('stock_mismatches', 'product_id,computed_stock,actual_stock,diff,created_at', 'created_at').catch(()=>[]);
  const misRows = mis.map(r => ({ type: 'STOCK_MISMATCH', product_id: r.product_id, computed: r.computed_stock,
    actual: r.actual_stock, diff: r.diff, created_at: r.created_at, detail: '' }));
  write('07_audit_integrity.csv', [...misRows, ...tomRows, ...salRows].sort((a,b)=> (a.created_at>b.created_at?1:-1)));

  // ===== INDEX MD =====
  const L = ['# DB Row-Wise Movement Ledger', `_Generated: ${new Date().toISOString()}_`, '',
    'Har movement 1-by-1, time order mein, running balance ke saath. Verify karne ke liye CSV dekho.', '',
    '| File | Rows | Kya hai |', '|------|------|-----------|'];
  const desc = {
    '01_inventory_stock_history.csv': 'Stock in/out har row — kab aya, kitna, running balance',
    '02_variant_stock_history.csv': 'Variant-level stock movement',
    '03_sales_ledger.csv': 'Har sale — invoice, status, total, refunded, items',
    '04_payment_movements.csv': 'Cash/payment mode movement per mode running balance',
    '05_purchase_ledger.csv': 'Purchase records + supplier transactions',
    '06_customer_ledger.csv': 'Customer ledger entries',
    '07_audit_integrity.csv': 'Tombstones + sale audit + stock mismatches'
  };
  for (const [f, n] of Object.entries(files)) L.push(`| ${f} | ${n} | ${desc[f] || ''} |`);
  L.push('');
  // quick stock sanity
  const drift = invRows.filter(r => r.running_vs_ledger_ok === 'NO');
  L.push(`## Quick checks`);
  L.push(`- Inventory rows: **${invRows.length}**, running-vs-ledger mismatches: **${drift.length}**`);
  L.push(`- (ledger balance_after is null on most rows — so running balance is computed from change_qty, which is the reliable view)`);
  fs.writeFileSync('DB_ANALYSIS_REPORT/00_INDEX.md', L.join('\n'));

  console.log('ROW-WISE DONE:', JSON.stringify(files));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
