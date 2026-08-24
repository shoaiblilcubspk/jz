/* FULL DB BACKUP — all tables, all columns, all rows -> one JSON file. */
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
async function fetchAll(table, order = 'created_at') {
  let rows = [], from = 0, done = false, useOrder = order;
  while (!done) {
    let q = sb.from(table).select('*', { count: 'exact' });
    if (useOrder) q = q.order(useOrder, { ascending: true });
    q = q.range(from, from + PAGE - 1);
    const { data, error, count } = await q;
    if (error) {
      if (useOrder && /does not exist/.test(error.message)) { useOrder = null; from = 0; rows = []; continue; }
      console.error(`SKIP ${table}: ${error.message}`); return null;
    }
    if (data && data.length) rows = rows.concat(data);
    from += PAGE;
    if (!data || data.length < PAGE) done = true;
    if (count !== null && from >= count) done = true;
  }
  return rows;
}
(async () => {
  const tables = ['users','app_settings','categories','customers','customer_ledger','suppliers',
    'products','discounts','sales','salesmen','expenses','sales_tabs','purchase_records',
    'purchase_orders','purchase_order_items','supplier_transactions','payments','stock_history',
    'bundles','bundle_items','variant_stock_history','row_tombstones','product_addons','toppings',
    'product_toppings','payment_modes','payment_movements','sale_audit_log','stock_mismatches',
    'price_history','sessions'];
  const backup = { generated_at: new Date().toISOString(), project_url: URL, tables: {} };
  let totalRows = 0;
  for (const t of tables) {
    const rows = await fetchAll(t);
    if (rows === null) { backup.tables[t] = { error: 'fetch failed' }; continue; }
    backup.tables[t] = { row_count: rows.length, columns: rows.length ? Object.keys(rows[0]) : [], rows };
    totalRows += rows.length;
    console.log(`${t}: ${rows.length}`);
  }
  backup.total_rows = totalRows;
  fs.writeFileSync('db_full_backup.json', JSON.stringify(backup, null, 2));
  console.log('BACKUP DONE. total_rows =', totalRows, ' size =', fs.statSync('db_full_backup.json').size, 'bytes');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
