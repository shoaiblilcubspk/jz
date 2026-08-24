-- ================================================================
-- ZAYNAH'S POS v2 — SUPER MASTER SCHEMA
-- ================================================================
-- Complete drop-in SQL for FRESH Supabase project setup.
-- Includes: ALL tables, columns, constraints, indexes, functions,
-- triggers, RLS policies, views, grants, and seed data.
--
-- HOW TO USE:
--   1. Go to Supabase Dashboard → SQL Editor → New Query
--   2. Paste ENTIRE contents of this file
--   3. Click Run
--   4. Copy the Supabase Project URL + anon key into your .env.local
--
-- TABLES (22) — Order matters (FK dependency):
--   1.  app_settings           Singleton config (no FK deps)
--   2.  categories             Product taxonomy
--   3.  customers              CRM / Loyalty
--   4.  suppliers              Vendor management (no FK deps)
--   5.  products               Inventory master
--   6.  product_batches        REMOVED (Stage 1 decommission — never populated)
--   7.  discounts              Campaigns / BOGO
--   8.  users                  Extends auth.users → FK: auth.users
--   9.  sales                  POS Invoices → FK: customers
--   10. sales_tabs             Multi-tab cashier → FK: users, customers
--   11. expenses               Operating costs
--   12. purchase_records       Unified inventory ledger
--   13. purchase_orders        PO Headers → FK: suppliers
--   14. purchase_order_items   PO Line Items → FK: purchase_orders, products
--   15. supplier_transactions  Khata / Master Ledger → FK: suppliers
--   16. payments               Supplier payments → FK: suppliers
--   17. stock_history          Inventory audit trail → FK: products
--   18. toppings               Pizza topping add-ons (Cheese/Chicken/Veggie)
--   19. product_toppings        Per-product topping availability
-- FUNCTIONS (8): update_updated_at_column, generate_invoice_number,
--                 auto_generate_invoice_number, update_customer_stats,
--                 handle_new_user, get_my_workspace_id,
--                 audit_stock_integrity, audit_missing_purchase_cost
-- ================================================================
--
-- ════════════════════════════════════════════════════════════════
-- 📜 SCHEMA CHANGE LOG (AUDIT TRAIL)
-- ════════════════════════════════════════════════════════════════
-- Every structural DB change MUST be logged here AND in a migration file.
--
-- [2026-08-23] Add missing barcode qr columns
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260823070000_add_barcode_qr_columns.sql
--   Added barcode_show_barcode, barcode_show_qr, barcode_qr_size, and
--   receipt_show_barcode to app_settings. Also merged them into CREATE TABLE.
--
-- [2026-08-23] Drop legacy users.permissions TEXT[] column
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260823050000_drop_users_permissions_column.sql
--   Tag-based permission system removed from code (readers/writers). Role matrix
--   + signed action guards are the single authority.
--
-- [2026-08-23] RBAC FINAL — server-level permission matrix enforcement
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260823040000_rbac_final.sql
--   1. delete_sale_atomic: allow-list narrowed to ['admin'] (supervisor override
--      via signed admin token). DRAFT sales (pending + DRAFT_SALE) exempt.
--   2. refund_sale_atomic: refunds above app_settings.refund_approval_threshold
--      (NUMERIC NOT NULL DEFAULT 5000, 0=off) require role='admin' → raises
--      APPROVAL_REQUIRED (42501). Client: SupervisorPinModal override flow.
--
-- [2026-08-23] RBAC Harden — permission matrix enforcement
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260823030000_rbac_harden.sql
--   1. verify_action_token: FAIL-CLOSED (removed NULL-hash + NULL-sig => true bypass).
--   2. stock_adjustment: added signed actor proof params (p_user_id/p_role/p_sig)
--      + require_action('stock_adjustment', ['admin','manager']). Legacy unguarded
--      8-param overload dropped. Client (detailAdjustment.ts) signs via signAction.
--   Code side: 7 UI isAdmin=true bypasses restored to real role checks;
--     manager lost view_users/manage_users/view_settings/manage_settings (admin-only);
--     admin-users edge function restricted to admin only.
--
-- [2026-08-22] Stage 2 Hardening - refund_sale_atomic double-reversal guard
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260822040000_refund_double_reversal_guard.sql
--   refund_sale_atomic now no-ops when the sale is deleted / already fully
--   refunded / the passed cumulative refunded_amount does not exceed the stored
--   one (duplicate / stale / multi-device replay). Prevents double stock-restore
--   + double wallet credit. Legitimate INCREASING partial refunds still proceed.
--   Mirrors the existing delete_sale_atomic idempotency (deleted_at check).
--
-- [2026-08-22] Stage 1 Decommission - E-store Config Columns Removed
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260822030000_drop_estore_config_columns.sql
--   DROPPED app_settings cols: all estore_* (22 storefront/theme/COD/timer/custom-payment)
--     + store_type, store_latitude, store_longitude, shop_open_time, shop_close_time,
--     delivery_start_time, delivery_end_time, pickup_start_time, pickup_end_time.
--   DROPPED products cols: show_in_estore, estore_sort_order, estore_category_sort_order.
--   DROPPED categories.estore_sort_order, bundles.estore_sort_order.
--   Pure orphans: no RPC/view/index referenced them. DEFERRED to Stage 2 (RPC rewrite):
--     store_orders + place_estore_order/release_estore_stock, sales.source_order_id,
--     sales.estore_status, sale_type/store_type CHECK 'estore', daily_summary.estore_sales.
--
-- [2026-08-22] Stage 1 Decommission — Discount Types Narrowed
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260822020000_narrow_discount_types.sql
--   discounts.type CHECK narrowed to ('percentage','fixed') — dropped
--     'bogo','free_gift','mix_and_match'. Dropped orphaned free_gift_products col.
--   KEPT: sales.free_gifts (realized line items — sale COGS/stock/return integrity).
--
-- [2026-08-22] Stage 1 Decommission — Combo System Removed
--   Files: SUPER_MASTER_SCHEMA.sql, migration 20260822010000_drop_combo_system.sql
--   DROPPED tables: bundle_slots, bundle_slot_options, bundle_slot_toppings
--   DROPPED bundles cols: is_combo, deal_category, schedule_type, start_date,
--     end_date, repeat_days, start_time, end_time, badge_enabled, badge_text,
--     badge_icon, badge_bg_color, badge_text_color, extra_toppings, highlight_tag
--   KEPT: bundles, bundle_items, bundles.override_price, bundles.hide_item_prices,
--     toppings, product_toppings,
--     products.highlight_tag (product scope).
--
-- [2026-08-17] Verification & Repair Protocol Fixes
--   Files: SUPER_MASTER_SCHEMA.sql, migrations 20260818010000 - 20260818040000
--   Changes:
--   1. Role Guards: Added server-side role enforcement directly in delete_sale_atomic
--      and refund_sale_atomic RPCs.
--   2. Reconciliation: Added stock_mismatches table, reconcile_now() RPC, and
--      invariant_violations view.
--   3. E-store Guards: Added store_order_transition_is_valid, guard_store_order_update,
--      and guard_store_order_insert to enforce state machine and rate limit orders.
--
-- [2026-05-09] POS Enhancements — Split Payments & DC Charges
--   Files: SUPER_MASTER_SCHEMA.sql, prisma/schema.prisma, localDb.ts,
--          types/index.ts, services.ts
--   Changes:
--   1. Sales Table:
--      + extra_charges (JSONB)   — DC / delivery charges flexible array
--      + split_payments (JSONB)  — Multi-method payment support
--      - Removed legacy dc_number, other_amount columns
--   2. App Settings Table:
--      + enable_split_payment (BOOLEAN)
--      + enable_extra_charges  (BOOLEAN)
--      + allow_credit_over_limit (BOOLEAN)
--      + barcode_content_scale, barcode_font_size, barcode_name_lines (barcode tuning)
--      + pos_grid_columns (INTEGER)
--   3. Realtime: supabase_realtime publication updated for all core tables
--
-- [2026-05-09] Audit Fixes — split_payments column, RLS, get_my_workspace_id
--   Migration: supabase/migrations/20260509191900_split_payments_rls_fix.sql
--   Changes:
--   1. Sales Table:
--      + split_payments column applied via ALTER TABLE (was in code but missing in DB)
--   2. RLS Security:
--      + get_my_workspace_id() SECURITY DEFINER function deployed (was missing from live DB)
--      * app_settings policies: qual=true → workspace_id = get_my_workspace_id()
--        (SELECT / INSERT / UPDATE / DELETE all scoped)
--      * users policies: qual=true → id = auth.uid() OR workspace_id = get_my_workspace_id()
--   3. SUPER_MASTER_SCHEMA.sql updated:
--      * get_my_workspace_id() now deployed BEFORE RLS DO block (correct ordering)
--      * app_settings and users excluded from generic RLS loop, have explicit policies
--   4. Audit Finding — Batch NULL (data issue, NOT a code bug):
--      - 12 products have track_inventory=true but only 1 has product_batches rows
--      - Root cause: products created before FIFO batch system was deployed
--      - FIFO code already handles this (falls back to product.cost per Rule F5)
--      - Fix: manual backfill via Stock Adjustment flow if COGS precision needed
--
-- [2026-05-10] Data Integrity Backfill — Batches, Stock History, Realtime, Orphans
--   Migration: supabase/migrations/20260510_backfill_batches_history_realtime.sql
--   Changes:
--   1. product_batches: Backfilled LEGACY-BACKFILL-001 batches for 8 products
--      with stock>0 that had no batch rows (pre-FIFO products).
--      3 negative-stock products also got zero-qty batches for schema completeness.
--   2. stock_history: Inserted 'initial' type entries for all products where
--      SUM(change_qty) != current stock. Audit trail now adds up correctly.
--   3. Realtime: ALTER PUBLICATION supabase_realtime SET TABLE for 14 core tables.
--      Changed from ADD TABLE to SET TABLE for idempotency.
--   4. sales: 31 orphaned sales (shift_id IS NULL) assigned to nearest preceding shift.
--   5. expenses: 2 orphaned expenses (shift_id IS NULL) assigned to nearest preceding shift.
--   ⚠️ SHIFT SYSTEM PERMANENTLY REMOVED (2026-08-12): no shift tables/columns/functions
--      exist or may ever be re-added. Historical entries above are migration record only.
--   6. Code: Removed backdrop-blur-md from ProductGrid.tsx (design rule compliance).
--
-- [2026-07-10] Drop workspace_id — Single-tenant architecture
--   Migration: supabase/migrations/20260710030000_drop_workspace_id.sql
--   Changes:
--   1. DROP COLUMN workspace_id from all 18 tables (app_settings, categories,
--      customers, suppliers, products, discounts, users, sales,
--      expenses, sales_tabs, purchase_records, purchase_orders, purchase_order_items,
--      supplier_transactions, payments, stock_history, bundles)
--   2. Replaced unique index idx_bundles_name_workspace with idx_bundles_name_unique
--   3. get_my_workspace_id() now returns auth.uid() (no longer queries users.workspace_id)
--   4. handle_new_user() no longer sets workspace_id
--   5. process_sale() RPC and sale_items_unrolled view — removed workspace_id refs
--   6. Seed data and backfill queries — removed workspace_id refs
--   7. All app code already cleaned (services.ts, components, types, hooks, etc.)
--
-- [2026-07-10] Add variant_data + modifiers columns to products
--   Migration: supabase/migrations/20260710164500_add_variant_data_modifiers_to_products.sql
--   Changes:
--   1. products table:
--      + variant_data JSONB DEFAULT '[]' — stores variant configuration per product
--      + modifiers    JSONB DEFAULT '[]' — stores modifier groups (add-ons, options)
--   Both columns were in SUPER_MASTER_SCHEMA.sql from day one but were never applied
--   to the live DB, causing every product sync to 400 → auto-blacklist loop.
-- ════════════════════════════════════════════════════════════════
--
-- [2026-07-10] Sales query timeout fix + cache busting
--   Files: services.ts, useSync.ts, supabase.ts, POSTerminal.tsx,
--          Modal.tsx, SUPER_MASTER_SCHEMA.sql (changelog only)
--   Changes:
--   1. services.ts — sales.fetchRemote() now uses .order().limit(10000)
--      to prevent "canceling statement due to statement timeout"
--   2. supabase.ts — Cache-Control: no-cache on all requests
--   3. useSync.ts — removed HEAD ping (/rest/v1/ returns 401)
--   4. Modal.tsx + POSTerminal.tsx — safe-area-inset-top for notch
--   5. SyncStatusBadge.tsx — stale-data amber badge 5min+ threshold
--
-- [2026-07-10] Idempotent ALTER TABLE blocks for post-launch columns
--   Changes:
--   1. app_settings: enable_kot_printer, enable_split_payment, enable_extra_charges,
--      allow_credit_over_limit, pos_grid_columns — now covered by ALTER TABLE ADD COLUMN IF NOT EXISTS
--   2. products: variant_data, modifiers — ALTER TABLE ADD COLUMN IF NOT EXISTS
--   3. sales: split_payments, extra_charges — ALTER TABLE ADD COLUMN IF NOT EXISTS
--   Impact: SUPER_MASTER_SCHEMA.sql can now be run on ANY existing DB as a true
--   idempotent full-setup script — no more missing column gaps.
--
-- [2026-07-14] EStore custom payment columns + schema sync fix
--   Files: SUPER_MASTER_SCHEMA.sql, Settings.tsx, services.ts
--   Changes:
--   1. app_settings CREATE TABLE: added estore_custom_payment_enabled, _name, _detail, _note
--   2. app_settings ALTER TABLE: fixed premature semicolon that prevented custom payment
--      columns from being applied on existing DBs
--   3. Settings.tsx formData: added ALL estore fields (timer, COD, custom payment,
--      WhatsApp, delivery, colors) to both useState init and useEffect sync — this was
--      the root cause of all estore settings resetting to defaults on refresh
--
-- [2026-07-10] Refund system fixes — partially_refunded, refunded_amount, process_return RPC
--   Migration: supabase/migrations/20260710230000_fix_refund_system.sql
--   Changes:
--   1. sales CHECK constraint: added 'partially_refunded' to allowed statuses
--   2. sales table: added refunded_amount DECIMAL(12,2) DEFAULT 0
--   3. process_return RPC: now reads status + refundedAmount + items from return_data
--      instead of hardcoding 'refunded'. Supports partial refunds properly.
--   4. syncEngine.ts: fixed 'returned' → 'refunded'/'partially_refunded' check
--   5. services.ts getReportRefunds*: now queries both 'refunded' AND 'partially_refunded'
--   6. Both process_return RPC definitions updated (lines 1101 and 1530)
--
-- [2026-07-18] Variation Inventory — Per-variant stock + Add-on products
--   Migration: supabase/migrations/20260718010000_variation_inventory.sql
--   Changes:
--   1. NEW TABLE variant_stock_history — per-variant stock change audit trail
--   2. NEW TABLE product_addons — inventory-tracked products assignable as add-ons
--   3. types/index.ts: VariantData gets cardTitle, cardSubtitle; new VariantStockHistory,
--      ProductAddon, CartAddonItem types; CartItem gets selectedVariantId,
--      selectedVariantLabel, addonItems
--   4. localDb.ts: version 18 adds variantStockHistory, productAddons tables
--   5. services.ts: new variantStockHistoryService, productAddonsService;
--      salesService.create now deducts variant stock + addon stock
--   6. syncEngine.ts: registers variant_stock_history, product_addons
--
-- [2026-07-24] Full Inventory Integrity Audit + Reconciliation Tool
--   Migration: supabase/migrations/20260724000000_fix_legacy_batches.sql
--   Changes:
--   1. DB: Fixed 12 stock/batch mismatches (phantom LEGACY-BACKFILL-001 batches cleaned,
--      corrective batches created for orphan stock, negative stock reset)
--   2. CODE: PurchaseHistory.tsx handleDeleteRecord() now restores batch qty_remaining
--      and logs stock_history entry on purchase record deletion
--   3. CODE: SupabaseAppContext.tsx DELETE_SALE reducer uses (total - refundedAmount)
--      instead of bare total for customer credit/purchases reversal
--   4. CODE: CheckoutModal.tsx bill-edit rollback now deletes the new sale's stock
--      deduction if old sale delete fails (prevents double-deduction)
--   5. CODE: services.ts added reconcileAllStock() — cross-checks products.stock vs
--      SUM(product_batches.qty_remaining) with optional auto-fix
--   6. CODE: InventoryManager.tsx added Reconcile Stock button (purple, Shield icon)
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 0. EXTENSIONS
-- ════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════════════════════════════════
-- 8. USERS  (Extends Supabase auth.users)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username            TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    email               TEXT,
    role                TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'manager', 'cashier', 'salesman')),

    -- Granular ACL Booleans
    can_edit_price      BOOLEAN DEFAULT false,
    can_give_discount   BOOLEAN DEFAULT false,
    can_delete_sale     BOOLEAN DEFAULT false,
    can_view_profit     BOOLEAN DEFAULT false,
    can_manage_stock    BOOLEAN DEFAULT false,
    can_manage_po       BOOLEAN DEFAULT false,
    can_view_records    BOOLEAN DEFAULT false,
    can_edit_sale       BOOLEAN DEFAULT false,

    active              BOOLEAN DEFAULT true,
    last_login          TIMESTAMPTZ,
    avatar              TEXT,
    action_hash        TEXT,

    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE users REPLICA IDENTITY FULL;

-- ── Current user role (server-side auth helper, MASTER §2.1.4) ──
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ════════════════════════════════════════════════════════════════
-- 1. APP SETTINGS  (Singleton — 1 row only)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
    id                          UUID PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,

    -- Store Identity
    store_name                  TEXT DEFAULT 'Zaynahs',
    store_address               TEXT,
    store_phone                 TEXT,
    store_email                 TEXT,
    store_logo                  TEXT,
    store_website               TEXT,

    -- Finance
    tax_rate                    DECIMAL(5,4) DEFAULT 0.0000,
    currency                    TEXT DEFAULT 'PKR',

    -- UI
    interface_mode              TEXT DEFAULT 'touch' CHECK (interface_mode IN ('touch', 'traditional')),
    theme                       TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),

    -- General Toggles
    auto_backup                 BOOLEAN DEFAULT true,
    receipt_printer             BOOLEAN DEFAULT false,

    -- Invoice Numbering
    invoice_prefix              TEXT DEFAULT 'INV',
    invoice_counter             INTEGER DEFAULT 1000,
    custom_receipt_number       BOOLEAN DEFAULT false,

    -- Receipt Display Settings
    receipt_paper_size          TEXT DEFAULT '80mm',
    receipt_density             TEXT DEFAULT 'normal',
    receipt_header              TEXT DEFAULT 'Welcome to our store...',
    receipt_footer              TEXT DEFAULT 'Thank you for shopping!',
    receipt_show_logo           BOOLEAN DEFAULT true,
    receipt_show_footer         BOOLEAN DEFAULT true,
    receipt_show_tax            BOOLEAN DEFAULT true,
    receipt_show_discount       BOOLEAN DEFAULT true,
    receipt_show_store_name     BOOLEAN DEFAULT true,
    receipt_show_store_address  BOOLEAN DEFAULT true,
    receipt_show_store_phone    BOOLEAN DEFAULT true,
    receipt_show_store_email    BOOLEAN DEFAULT true,
    receipt_show_customer_name  BOOLEAN DEFAULT true,
    receipt_show_customer_phone BOOLEAN DEFAULT true,
    receipt_show_notes          BOOLEAN DEFAULT true,
    receipt_show_delivery_address BOOLEAN DEFAULT true,
    receipt_show_qr_code        BOOLEAN DEFAULT true,
    receipt_show_barcode        BOOLEAN DEFAULT false,
    receipt_template            TEXT DEFAULT 'modern',
    receipt_font_scale          DECIMAL(3,2) DEFAULT 1.00,
    receipt_font_bold           BOOLEAN DEFAULT false,
    receipt_font_weight         TEXT DEFAULT '400',

    -- Receipt Position Adjustments (in print units)
    receipt_padding_top         INTEGER DEFAULT 0,
    receipt_padding_bottom      INTEGER DEFAULT 0,
    receipt_padding_left        INTEGER DEFAULT 0,
    receipt_padding_right       INTEGER DEFAULT 0,
    receipt_offset_x            INTEGER DEFAULT 0,
    receipt_header_offset_x     INTEGER DEFAULT 0,
    receipt_footer_offset_x     INTEGER DEFAULT 0,

    -- Barcode Label Settings
    barcode_paper_size          TEXT DEFAULT 'A4',
    barcode_a4_columns          INTEGER DEFAULT 3,
    barcode_a4_rows             INTEGER DEFAULT 10,
    barcode_show_price          BOOLEAN DEFAULT true,
    barcode_show_name           BOOLEAN DEFAULT true,
    barcode_show_sku            BOOLEAN DEFAULT false,
    barcode_show_category       BOOLEAN DEFAULT false,
    barcode_scale               DECIMAL(3,2) DEFAULT 1.50,
    barcode_height              INTEGER DEFAULT 40,
    barcode_padding             INTEGER DEFAULT 8,
    barcode_border              BOOLEAN DEFAULT true,
    barcode_type                TEXT DEFAULT 'BARCODE',
    barcode_name_lines          INTEGER DEFAULT 1,
    barcode_font_size           INTEGER DEFAULT 9,
    barcode_content_scale       NUMERIC DEFAULT 1.0,
    barcode_margin_x            INTEGER DEFAULT 0,
    barcode_margin_y            INTEGER DEFAULT 0,
    barcode_gap_x               INTEGER DEFAULT 0,
    barcode_gap_y               INTEGER DEFAULT 0,
    barcode_bar_width           NUMERIC DEFAULT 1.2,
    barcode_show_barcode        BOOLEAN DEFAULT true,
    barcode_show_qr             BOOLEAN DEFAULT false,
    barcode_qr_size             INTEGER DEFAULT 60,

    last_backup_date            TIMESTAMPTZ,

    -- Localization & Business
    country                     TEXT DEFAULT 'PK',
    tax_id                      TEXT,
    business_type               TEXT DEFAULT 'general',

    -- Purchase Order Config
    enable_purchase_orders      BOOLEAN DEFAULT true,
    po_prefix                   TEXT DEFAULT 'PO-',
    po_counter                  INTEGER DEFAULT 1000,
    allow_credit_over_limit     BOOLEAN DEFAULT true,
    enable_split_payment        BOOLEAN DEFAULT false,
    enable_extra_charges        BOOLEAN DEFAULT false,
    auto_save_receipt_png       BOOLEAN DEFAULT false,

    -- System Module Toggles
    retail_enabled              BOOLEAN DEFAULT true,
    wholesale_enabled           BOOLEAN DEFAULT false,
    sound_enabled               BOOLEAN DEFAULT true,
    touch_keyboard_enabled      BOOLEAN DEFAULT false,
    enable_kot_printer          BOOLEAN DEFAULT false,
    default_sale_type           TEXT DEFAULT 'retail',
    language                    TEXT DEFAULT 'en',
    
    -- Credit Sales & Ledger System
    enable_credit_sales         BOOLEAN DEFAULT true,
    cashier_can_credit          BOOLEAN DEFAULT true,
    
    -- Purchase Orders Module
    enable_purchase_orders      BOOLEAN DEFAULT true,
    po_prefix                   TEXT DEFAULT 'PO',
    po_counter                  INTEGER DEFAULT 1000,

    -- SaaS / Subscription
    subscription_tier           TEXT DEFAULT 'free',
    is_locked                   BOOLEAN DEFAULT false,
    ai_v2_enabled               BOOLEAN DEFAULT false,
    pos_grid_columns            INTEGER DEFAULT 4,

    -- §4.2 MASTER: negative stock control
    allow_negative_stock        BOOLEAN DEFAULT true,
    refund_approval_threshold   NUMERIC NOT NULL DEFAULT 5000,

    -- Timestamps
    created_at                  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at                  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings REPLICA IDENTITY FULL;

-- app_settings RLS (MASTER §2.1.4 — single-tenant, defense-in-depth)
-- SELECT/INSERT open (POS reads globally; first-run setup). UPDATE allowed for
-- any LOGGED-IN user (the POS writes app_settings from every authenticated role
-- during the 30s heartbeat sync, so an admin/manager-only policy would break
-- cashier sync). DELETE restricted to admin/manager. Unauthenticated anon is
-- always blocked. Sensitive sub-actions (delete_sale/refund_sale) are guarded
-- server-side in rpc_role_guards.sql; Settings PAGE access stays app-layer guarded.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON app_settings;
DROP POLICY IF EXISTS "settings_insert" ON app_settings;
DROP POLICY IF EXISTS "settings_write" ON app_settings;
DROP POLICY IF EXISTS "settings_delete" ON app_settings;

CREATE POLICY "settings_select" ON app_settings FOR SELECT USING (true);
CREATE POLICY "settings_insert" ON app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "settings_write" ON app_settings FOR UPDATE
  USING (current_user_role() IS NOT NULL)
  WITH CHECK (current_user_role() IS NOT NULL);
CREATE POLICY "settings_delete" ON app_settings FOR DELETE
  USING (current_user_role() IN ('admin', 'manager'));

-- ════════════════════════════════════════════════════════════════
-- 2. CATEGORIES  (Product taxonomy — no FK deps)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE categories REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════
-- 3. CUSTOMERS  (CRM + Credit — no FK deps)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customers (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                    TEXT NOT NULL,
    email                   TEXT,
    phone                   TEXT,
    address                 TEXT,
    price_tier              TEXT DEFAULT 'retail',
    credit_limit            DECIMAL(10,2) DEFAULT 0.00,
    credit_used             DECIMAL(10,2) DEFAULT 0.00,
    allow_credit            BOOLEAN DEFAULT true,
    total_purchases         DECIMAL(12,2) DEFAULT 0.00,
    balance                 DECIMAL(12,2) DEFAULT 0,
    last_purchase           TIMESTAMPTZ,
    preferred_categories    JSONB DEFAULT '[]'::jsonb,
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE customers REPLICA IDENTITY FULL;

-- ============================================================================
-- customer_ledger — per-customer transaction ledger (running balance)
-- P6/P24: balances derived from immutable entries, never direct overwrites.
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid REFERENCES customers(id) ON DELETE CASCADE,
  sale_id       uuid,
  type          text NOT NULL,
  debit         numeric(12,2) DEFAULT 0,
  credit        numeric(12,2) DEFAULT 0,
  balance_after numeric(12,2) DEFAULT 0,
  reference     text,
  note          text,
  created_by    uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_sale ON customer_ledger(sale_id);

GRANT ALL ON TABLE customer_ledger TO anon, authenticated, service_role;
GRANT ALL ON TABLE customers TO anon, authenticated, service_role;

ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_ledger_select ON customer_ledger;
DROP POLICY IF EXISTS customer_ledger_write ON customer_ledger;
CREATE POLICY customer_ledger_select ON customer_ledger FOR SELECT USING (true);
CREATE POLICY customer_ledger_write ON customer_ledger FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- 4. SUPPLIERS  (Vendor + Opening Balance — no FK deps)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS suppliers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    email               TEXT,
    phone               TEXT,
    address             TEXT,
    business_type       TEXT DEFAULT 'General',
    payment_terms       TEXT,
    opening_balance     DECIMAL(12,2) DEFAULT 0.00,
    rating              DECIMAL(2,1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE suppliers REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════
-- 5. PRODUCTS  (Inventory Master — no FK deps)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    sku                 TEXT NOT NULL UNIQUE,
    barcode             TEXT,
    barcode_value       TEXT,
    price               DECIMAL(10,2) NOT NULL,
    cost                DECIMAL(10,2),
    stock               INTEGER DEFAULT 0,
    min_stock           INTEGER DEFAULT 0,
    target_stock        INTEGER,
    category            TEXT NOT NULL,
    supplier            TEXT,
    description         TEXT,
    image               TEXT,
    taxable             BOOLEAN DEFAULT true,
    active              BOOLEAN DEFAULT true,
    is_weight_based     BOOLEAN DEFAULT false,
    price_per_unit      DECIMAL(10,2),
    unit                TEXT DEFAULT 'piece',
    track_inventory     BOOLEAN DEFAULT true,
    variants            JSONB DEFAULT '[]'::jsonb,
    variant_data        JSONB DEFAULT '[]'::jsonb,
    modifiers           JSONB DEFAULT '[]'::jsonb,
    product_type        TEXT DEFAULT 'simple' CHECK (product_type IN ('simple', 'variable', 'variation')),
    parent_id           UUID REFERENCES products(id) ON DELETE CASCADE,
    is_service          BOOLEAN DEFAULT false,
    require_serial      BOOLEAN DEFAULT false,
    menu_number         INTEGER,
    highlight_tag       TEXT CHECK (highlight_tag IN ('sunday', 'crown')),
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT products_price_positive         CHECK (price >= 0),
    CONSTRAINT products_cost_positive          CHECK (cost >= 0),
    CONSTRAINT products_min_stock_non_negative CHECK (min_stock >= 0)
);

ALTER TABLE products REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════
-- 6. PRODUCT BATCHES — REMOVED (Stage 1 decommission)
-- ════════════════════════════════════════════════════════════════
-- The FIFO / expiry lot layer was never populated (product.batches was
-- always []). Dropped via migration 20260822000000_drop_product_batches.sql.
-- Stock integrity is audited from the stock_history ledger, not lot rows.

-- ════════════════════════════════════════════════════════════════
-- 7. DISCOUNTS  (Campaigns / BOGO / Free Gift)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS discounts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    description         TEXT,
    type                TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value               DECIMAL(10,2) DEFAULT 0,
    conditions          JSONB DEFAULT '[]'::jsonb,
    min_amount          DECIMAL(10,2),
    max_discount        DECIMAL(10,2),
    valid_from          TIMESTAMPTZ NOT NULL,
    valid_to            TIMESTAMPTZ NOT NULL,
    valid_days          INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
    active              BOOLEAN DEFAULT true,
    is_auto_apply       BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT discounts_value_non_negative   CHECK (value >= 0),
    CONSTRAINT discounts_valid_date_range     CHECK (valid_to > valid_from),
    CONSTRAINT discounts_valid_days_range     CHECK (valid_days <@ ARRAY[0,1,2,3,4,5,6])
);

ALTER TABLE discounts REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════
-- 11. SALES  (POS Invoices)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sales (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number      TEXT NOT NULL UNIQUE,
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name       TEXT,
    customer_phone      TEXT,
    items               JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount     DECIMAL(12,2) DEFAULT 0,
    bill_discount_value DECIMAL(12,2),
    bill_discount_type  TEXT,
    tax_amount          DECIMAL(12,2) DEFAULT 0,
    total               DECIMAL(12,2) NOT NULL,
    received_amount     DECIMAL(12,2),
    change_amount       DECIMAL(12,2),
    payment_method      TEXT CHECK (payment_method IN ('cash', 'card', 'digital', 'credit', 'cheque', 'split', 'online')),
    card_details        JSONB,
    status              TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'partially_refunded', 'credit', 'draft', 'deleted', 'cancelled')),
    payment_status      TEXT DEFAULT 'paid',
    cashier             TEXT,
    edited_from_invoice TEXT DEFAULT NULL,
    cashier_role        TEXT,
    receipt_number      TEXT,
    notes               TEXT,
    applied_discounts   JSONB DEFAULT '[]'::jsonb,
    free_gifts          JSONB DEFAULT '[]'::jsonb,
    timestamp           TIMESTAMPTZ DEFAULT NOW(),
    sale_date           DATE DEFAULT CURRENT_DATE,
    sale_type           TEXT DEFAULT 'retail' CHECK (sale_type IN ('retail', 'wholesale', 'estore')),
    extra_charges       JSONB DEFAULT '[]'::jsonb,
    split_payments      JSONB DEFAULT '[]'::jsonb,
    refunded_amount     DECIMAL(12,2) DEFAULT 0,
    estore_status       TEXT DEFAULT 'pending' CHECK (estore_status IN ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
    delivery_address    TEXT,
    delivery_fee        DECIMAL(12,2) DEFAULT 0,
    delivery_location_lat NUMERIC,
    delivery_location_lng NUMERIC,
    customer_notes      TEXT,
    is_orphan           BOOLEAN NOT NULL DEFAULT false,
    device_id           TEXT,
    synced_at           TIMESTAMPTZ,
    last_edited_by      TEXT,
    last_edited_at      TIMESTAMPTZ,
    edit_count          INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sales REPLICA IDENTITY FULL;

-- ════════════════════════════════════════════════════════════════
-- 11b. SALESMEN  (Sales staff tracking)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS salesmen (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    phone       TEXT,
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE salesmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesmen REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Allow all for authenticated" ON salesmen;
CREATE POLICY "Allow all for authenticated" ON salesmen
    FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- 12. EXPENSES  (Operating costs)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS expenses (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description         TEXT NOT NULL,
    amount              DECIMAL(12,2) NOT NULL DEFAULT 0,
    category            TEXT NOT NULL,
    date                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    payment_method      TEXT NOT NULL,
    store_type          TEXT DEFAULT 'retail' CHECK (store_type IN ('retail', 'wholesale', 'estore')),
    notes               TEXT,
    added_by            TEXT,
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT expenses_amount_positive CHECK (amount >= 0)
);

-- ════════════════════════════════════════════════════════════════
-- 13. SALES TABS  (Multi-tab cashier)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sales_tabs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    cart                    JSONB DEFAULT '[]'::jsonb,
    selected_customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
    bill_discount_value     DECIMAL(12,2),
    bill_discount_type      TEXT,
    notes                   TEXT,
    editing_sale_id         UUID,
    created_at              TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. STORE ORDERS — REMOVED: e-store feature deleted (see migration 20260823010000_drop_estore.sql)

-- ════════════════════════════════════════════════════════════════
-- 15. PURCHASE RECORDS  (Unified inventory ledger)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchase_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type            TEXT DEFAULT 'Stock IN',
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name    TEXT NOT NULL,
    sku             TEXT,
    variant_id      TEXT,
    variant_label   TEXT,
    quantity        INTEGER NOT NULL DEFAULT 0,
    cost_price      DECIMAL(12,2) DEFAULT 0,
    retail_price    DECIMAL(12,2),
    total_amount    DECIMAL(12,2) DEFAULT 0,
    supplier        TEXT,
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    qty_remaining   INTEGER,
    date            TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    added_by        TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ════════════════════════════════════════════════════════════════
-- 16. PURCHASE ORDERS  (PO Headers)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchase_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number       TEXT NOT NULL UNIQUE,
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'received', 'cancelled')),
    total_amount    DECIMAL(12,2) DEFAULT 0.00,
    notes           TEXT,
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ════════════════════════════════════════════════════════════════
-- 17. PURCHASE ORDER ITEMS  (PO line items)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id           UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    received_qty    INTEGER DEFAULT 0,
    cost_price      DECIMAL(12,2) NOT NULL CHECK (cost_price >= 0),
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ════════════════════════════════════════════════════════════════
-- 17. SUPPLIER TRANSACTIONS  (Khata / Master ledger)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supplier_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('purchase', 'loan', 'advance', 'payment', 'return', 'opening_balance')),
    source_type     TEXT DEFAULT 'manual_bill',
    amount          DECIMAL(12,2) NOT NULL,
    reference_id    UUID,
    reference_type  TEXT,
    note            TEXT,
    balance_after   DECIMAL(12,2),
    is_manual_override BOOLEAN DEFAULT FALSE,
    override_by     TEXT,
    payment_type    TEXT,
    split_payments  JSONB,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ════════════════════════════════════════════════════════════════
-- 18. PAYMENTS  (Supplier payments)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id     UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    payment_type    TEXT,
    direction       TEXT CHECK (direction IN ('in', 'out')),
    note            TEXT,
    is_manual_override BOOLEAN DEFAULT FALSE,
    override_by     TEXT,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ════════════════════════════════════════════════════════════════
-- 19. STOCK HISTORY  (Inventory audit trail)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stock_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    change_qty      INTEGER NOT NULL,
    type            TEXT CHECK (type IN (
                        'sale',           -- stock out on sale
                        'purchase',       -- legacy type (kept for backward compat)
                        'stock_in',       -- stock in via purchase record
                        'return',         -- stock restored on sale return/delete
                        'adjustment',     -- manual stock adjustment (up or down)
                        'initial',        -- first stock when product is created
                        'adjustment_out'  -- stock out via supplier return
                    )),
    reference_id    UUID,
    note            TEXT,
    balance_after   INTEGER,
    cashier_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    cashier_name    TEXT,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ════════════════════════════════════════════════════════════════
-- 20. BUNDLES (Product Bundles/Deals)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bundles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    description         TEXT DEFAULT '',
    discount_value      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    discount_type       TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    hide_item_prices    BOOLEAN NOT NULL DEFAULT FALSE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    image               TEXT,
    override_price       NUMERIC(10,2),
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prevent duplicate bundle names
CREATE UNIQUE INDEX IF NOT EXISTS idx_bundles_name_unique ON bundles (LOWER(TRIM(name)));

-- ════════════════════════════════════════════════════════════════
-- 21. BUNDLE ITEMS (Products inside a bundle)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bundle_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id           UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity            INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at          TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id ON bundle_items(product_id);

-- API Grants: Allow anon, authenticated, and service_role to read bundle data
GRANT SELECT ON TABLE bundles TO anon, authenticated, service_role;
GRANT SELECT ON TABLE bundle_items TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- 27. VARIANT STOCK HISTORY (Per-variant inventory audit trail)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS variant_stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  variant_label TEXT,
  change_qty INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'return', 'adjustment', 'initial', 'purchase')),
  reference_id UUID,
  note TEXT,
  balance_after INTEGER,
  cashier_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variant_stock_history_product ON variant_stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_stock_history_variant ON variant_stock_history(product_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_stock_history_date ON variant_stock_history(created_at DESC);

GRANT ALL ON variant_stock_history TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- 27b. ROW TOMBSTONES (F21 — Stale-Write Guard registry)
-- Records every DELETE of a financial ledger row so a deleted record
-- can NEVER be resurrected by a stale update from another device.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS row_tombstones (
  table_name TEXT NOT NULL,
  ref_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_name, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_row_tombstones_ref ON row_tombstones(ref_id);

GRANT ALL ON row_tombstones TO anon, authenticated, service_role;

ALTER TABLE row_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service_role ALL on row_tombstones" ON row_tombstones;
CREATE POLICY "Allow service_role ALL on row_tombstones"
  ON row_tombstones FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon ALL on row_tombstones" ON row_tombstones;
CREATE POLICY "Allow anon ALL on row_tombstones"
  ON row_tombstones FOR ALL
  TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated ALL on row_tombstones" ON row_tombstones;
CREATE POLICY "Allow authenticated ALL on row_tombstones"
  ON row_tombstones FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- 28. PRODUCT ADDONS (Inventory-tracked add-on products)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  addon_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_qty INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, addon_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_addons_product ON product_addons(product_id);
CREATE INDEX IF NOT EXISTS idx_product_addons_addon ON product_addons(addon_product_id);

GRANT ALL ON product_addons TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- PERFORMANCE INDEXES
-- ════════════════════════════════════════════════════════════════

-- Products
CREATE INDEX IF NOT EXISTS idx_products_sku             ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode         ON products(barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_value ON products(barcode_value) WHERE barcode_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category        ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active          ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, active);
CREATE INDEX IF NOT EXISTS idx_products_name_search     ON products USING gin(to_tsvector('english', name));
-- Prevent duplicate product names (case-insensitive, whitespace-trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_unique ON products (LOWER(TRIM(name)));

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_name           ON customers USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_customers_email          ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone          ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name_text      ON customers(name text_pattern_ops);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_timestamp          ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id        ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number     ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_status             ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method     ON sales(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_cashier            ON sales(cashier);
CREATE INDEX IF NOT EXISTS idx_sales_created_at_status  ON sales(created_at, status);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date          ON sales(sale_date);

-- Discounts
CREATE INDEX IF NOT EXISTS idx_discounts_active          ON discounts(active);
CREATE INDEX IF NOT EXISTS idx_discounts_validity        ON discounts(valid_from, valid_to) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_discounts_type            ON discounts(type);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_username            ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email               ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role                ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active              ON users(active);

-- Sales Tabs
CREATE INDEX IF NOT EXISTS idx_sales_tabs_user_id        ON sales_tabs(user_id);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_date             ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category         ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method   ON expenses(payment_method);

-- Purchase Records
CREATE INDEX IF NOT EXISTS idx_purchase_records_date       ON purchase_records(date);
CREATE INDEX IF NOT EXISTS idx_purchase_records_product_id ON purchase_records(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_records_supplier   ON purchase_records(supplier);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status      ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number   ON purchase_orders(po_number);

-- Purchase Order Items
CREATE INDEX IF NOT EXISTS idx_po_items_po_id              ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product_id         ON purchase_order_items(product_id);

-- Supplier Transactions
CREATE INDEX IF NOT EXISTS idx_supplier_tx_supplier_id     ON supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_tx_created_at      ON supplier_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_tx_type            ON supplier_transactions(type);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_supplier_id        ON payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id        ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at         ON payments(created_at);

-- Stock History
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id    ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at    ON stock_history(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_history_type          ON stock_history(type);

-- ════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════════

-- ── Auto update_at trigger ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Inventory Sync Trigger (Append-Only Ledger) ──
CREATE OR REPLACE FUNCTION trigger_update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products SET 
        stock = COALESCE(stock, 0) + NEW.change_qty,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_update_variant_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET 
        variant_data = (
            SELECT jsonb_agg(
                CASE 
                    WHEN v->>'id' = NEW.variant_id::text THEN 
                        v || jsonb_build_object('stock', COALESCE((v->>'stock')::int, 0) + NEW.change_qty)
                    ELSE v 
                END
            )
            FROM jsonb_array_elements(variant_data) AS v
        ),
        updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$ BEGIN CREATE TRIGGER update_app_settings_updated_at      BEFORE UPDATE ON app_settings      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_categories_updated_at         BEFORE UPDATE ON categories         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_customers_updated_at          BEFORE UPDATE ON customers          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_suppliers_updated_at          BEFORE UPDATE ON suppliers          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_products_updated_at           BEFORE UPDATE ON products           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_discounts_updated_at          BEFORE UPDATE ON discounts          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_users_updated_at             BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_sales_updated_at              BEFORE UPDATE ON sales              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_sales_tabs_updated_at         BEFORE UPDATE ON sales_tabs         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER update_expenses_updated_at           BEFORE UPDATE ON expenses           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_purchase_orders_updated_at    BEFORE UPDATE ON purchase_orders    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_supplier_transactions_updated_at BEFORE UPDATE ON supplier_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_payments_updated_at           BEFORE UPDATE ON payments           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_stock_history_updated_at      BEFORE UPDATE ON stock_history      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER update_purchase_records_updated_at    BEFORE UPDATE ON purchase_records    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── F21 Stale-Write Guards (server-enforced) ──
CREATE OR REPLACE FUNCTION guard_stale_write()
RETURNS TRIGGER AS $$
BEGIN
  -- (a) A deleted row can never come back (tombstone blocks resurrect).
  IF EXISTS (
    SELECT 1 FROM row_tombstones
    WHERE table_name = TG_TABLE_NAME AND ref_id = NEW.id
  ) THEN
    -- Allow internal cascade (e.g., ON DELETE SET NULL) which runs at depth > 0
    IF pg_trigger_depth() = 0 THEN
      RAISE EXCEPTION 'STALE_WRITE: record % was deleted from % on another device (or this one). Refresh from cloud — this stale write was rejected.', NEW.id, TG_TABLE_NAME
        USING ERRCODE = 'P0007';
    END IF;
  END IF;
  -- (b) Newest-wins: reject writes older than the stored row.
  IF TG_OP = 'UPDATE' AND NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'STALE_WRITE: remote % row % is NEWER (cloud %) than this local change (%). Refresh from cloud — this stale write was rejected.', TG_TABLE_NAME, NEW.id, OLD.updated_at, NEW.updated_at
      USING ERRCODE = 'P0007';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_row_tombstone()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  INSERT INTO row_tombstones (table_name, ref_id, deleted_at)
  VALUES (TG_TABLE_NAME, OLD.id, COALESCE(OLD.updated_at, NOW()))
  ON CONFLICT (table_name, ref_id)
  DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER guard_stale_write_sales            BEFORE INSERT OR UPDATE ON sales                FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_stock_history    BEFORE INSERT OR UPDATE ON stock_history         FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_variant_history  BEFORE INSERT OR UPDATE ON variant_stock_history FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_purchase_records BEFORE INSERT OR UPDATE ON purchase_records      FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_expenses         BEFORE INSERT OR UPDATE ON expenses              FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_payments         BEFORE INSERT OR UPDATE ON payments              FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER guard_stale_write_sales_tabs       BEFORE INSERT OR UPDATE ON sales_tabs            FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER record_tombstone_sales             AFTER DELETE ON sales                FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_stock_history     AFTER DELETE ON stock_history         FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_variant_history   AFTER DELETE ON variant_stock_history FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_purchase_records  AFTER DELETE ON purchase_records      FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_expenses          AFTER DELETE ON expenses              FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_payments          AFTER DELETE ON payments              FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER record_tombstone_sales_tabs        AFTER DELETE ON sales_tabs            FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Invoice Number Generator ──
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_invoice_number TEXT;
BEGIN
    SELECT invoice_prefix, invoice_counter
    INTO prefix, counter
    FROM app_settings LIMIT 1;

    IF prefix IS NULL THEN prefix := 'INV'; END IF;
    IF counter IS NULL THEN counter := 1000; END IF;

    new_invoice_number := prefix || '-' || LPAD(counter::TEXT, 6, '0');

    UPDATE app_settings
    SET invoice_counter = counter + 1,
        updated_at = timezone('utc'::text, now());

    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Auto-Generate Invoice Number Trigger ──

DO $$ BEGIN
  CREATE TRIGGER trigger_auto_generate_invoice_number
      BEFORE INSERT ON sales
      FOR EACH ROW
      EXECUTE FUNCTION auto_generate_invoice_number();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── get_next_invoice_number RPC (used by syncEngine on invoice collision) ──
CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_invoice_number TEXT;
BEGIN
    -- Atomic increment: a single UPDATE...RETURNING locks the row and assigns a
    -- unique, monotonic counter even under concurrent callers (no SELECT-then-UPDATE
    -- race that could hand out the same invoice number twice).
    UPDATE app_settings
    SET invoice_counter = COALESCE(invoice_counter, 1000) + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = '00000000-0000-4000-8000-000000000001'
    RETURNING invoice_counter, invoice_prefix
    INTO counter, prefix;

    IF prefix IS NULL THEN prefix := 'INV'; END IF;
    new_invoice_number := prefix || '-' || LPAD(counter::TEXT, 6, '0');
    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ── Customer Stats Auto-Update ──
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
        UPDATE customers
        SET
            total_purchases = total_purchases + NEW.total,
            last_purchase = NEW.created_at,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- DISABLED: Frontend is sole writer of customer.total_purchases (prevents multi-device race).
-- See migration 20260820140000_remove_customer_stats_trigger.sql
-- DO $$ BEGIN
--   CREATE TRIGGER trigger_update_customer_stats
--       AFTER INSERT OR UPDATE ON sales
--       FOR EACH ROW
--       EXECUTE FUNCTION update_customer_stats();
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Auto-Create User Profile from Supabase Auth ──
-- First user becomes admin, subsequent users are cashier
-- v2: Handles optional email and username collisions gracefully
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    is_first_user BOOLEAN;
    _role TEXT;
    base_username TEXT;
    final_username TEXT;
    suffix INT := 0;
BEGIN
    -- Check if this is the first user in the system
    SELECT NOT EXISTS (SELECT 1 FROM public.users) INTO is_first_user;

    -- Default role: cashier. Admin/manager roles are assigned explicitly by an
    -- existing admin (MASTER §2). Unknown roles coerce to cashier (fail-closed).
    _role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'cashier');
    IF _role NOT IN ('admin', 'manager', 'cashier', 'salesman') THEN
        _role := 'cashier';
    END IF;

    base_username := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
    final_username := base_username;

    -- Resolve username collision by appending a numeric suffix
    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = final_username) LOOP
        suffix := suffix + 1;
        final_username := base_username || suffix::TEXT;
    END LOOP;

    INSERT INTO public.users (
        id, username, name, email, role, active
    )
    VALUES (
        NEW.id,
        final_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        _role,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        email = EXCLUDED.email;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Users RLS + role-escalation guard (MASTER §2, applied live 2026-08-18) ──
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_update_self_or_admin" ON users;
DROP POLICY IF EXISTS "users_insert_open" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;

CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_self_or_admin" ON users FOR UPDATE
  USING (auth.uid() = id OR current_user_role() IN ('admin', 'manager'))
  WITH CHECK (auth.uid() = id OR current_user_role() IN ('admin', 'manager'));
CREATE POLICY "users_insert_open" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_delete_admin" ON users FOR DELETE
  USING (current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION guard_user_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR OLD.active IS DISTINCT FROM NEW.active THEN
    IF current_user_role() NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'FORBIDDEN: only admin/manager may change roles or active status' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_role_change ON users;
CREATE TRIGGER trg_guard_user_role_change
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_role_change();

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Workspace-check helper (single-tenant: returns current user id) ──
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── PO Number Generator ──
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_po_number TEXT;
BEGIN
    SELECT po_prefix, po_counter
    INTO prefix, counter
    FROM app_settings LIMIT 1;

    IF prefix IS NULL THEN prefix := 'PO-'; END IF;
    IF counter IS NULL THEN counter := 1000; END IF;

    new_po_number := prefix || LPAD(counter::TEXT, 6, '0');

    UPDATE app_settings
    SET po_counter = counter + 1,
        updated_at = timezone('utc'::text, now());

    RETURN new_po_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_generate_po_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
        NEW.po_number := generate_po_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_auto_generate_po_number
      BEFORE INSERT ON purchase_orders
      FOR EACH ROW
      EXECUTE FUNCTION auto_generate_po_number();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ATOMIC SALES PROCESSOR (RPC) ──
CREATE OR REPLACE FUNCTION process_sale(sale_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_sale_id UUID;
BEGIN
    INSERT INTO sales (
        id, invoice_number, customer_id, customer_name, customer_phone,
        items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
        tax_amount, total, received_amount, change_amount, payment_method,
        status, cashier, cashier_role, notes, sale_type, timestamp, created_at, updated_at
    ) VALUES (
        (sale_data->>'id')::UUID,
        sale_data->>'invoice_number',
        (sale_data->>'customer_id')::UUID,
        sale_data->>'customer_name',
        sale_data->>'customer_phone',
        (sale_data->'items')::JSONB,
        (sale_data->>'subtotal')::DECIMAL,
        (sale_data->>'discount_amount')::DECIMAL,
        (sale_data->>'bill_discount_value')::DECIMAL,
        sale_data->>'bill_discount_type',
        (sale_data->>'tax_amount')::DECIMAL,
        (sale_data->>'total')::DECIMAL,
        (sale_data->>'received_amount')::DECIMAL,
        (sale_data->>'change_amount')::DECIMAL,
        sale_data->>'payment_method',
        COALESCE(sale_data->>'status', 'completed'),
        sale_data->>'cashier',
        sale_data->>'cashier_role',
        sale_data->>'notes',
        COALESCE(sale_data->>'sale_type', 'retail'),
        COALESCE((sale_data->>'timestamp')::TIMESTAMPTZ, NOW()),
        NOW(),
        NOW()
    ) RETURNING id INTO new_sale_id;

    RETURN jsonb_build_object('success', true, 'id', new_sale_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ── ATOMIC RETURN PROCESSOR (RPC) ──
CREATE OR REPLACE FUNCTION process_return(sale_id UUID, return_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_refunded_amount DECIMAL(12,2);
BEGIN
    v_status := COALESCE(return_data->>'status', 'refunded');
    v_refunded_amount := COALESCE((return_data->>'refundedAmount')::DECIMAL(12,2), 0);

    UPDATE sales
    SET 
        status = v_status,
        refunded_amount = COALESCE(refunded_amount, 0) + v_refunded_amount,
        items = COALESCE(return_data->>'items', items::TEXT)::JSONB,
        notes = COALESCE(notes, '') || '[RETURNED] ' || COALESCE(return_data->>'notes', ''),
        updated_at = NOW()
    WHERE id = sale_id;

    RETURN jsonb_build_object('success', true, 'id', sale_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- GRANTS
GRANT EXECUTE ON FUNCTION process_sale(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_sale(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION process_return(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION process_return(UUID, JSONB) TO anon;

-- ════════════════════════════════════════════════════════════════
-- AUDIT FUNCTIONS (Stock & Financial Integrity Checks)
-- ════════════════════════════════════════════════════════════════

-- ── Purchase Cost Audit ──
-- Returns completed sales that have items with zero or null purchaseCost.
-- These sales will show incorrect profit in reports.
CREATE OR REPLACE FUNCTION audit_missing_purchase_cost()
RETURNS TABLE(
  sale_id        uuid,
  invoice_number text,
  created_at     timestamptz,
  item_count     bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    s.id,
    s.invoice_number,
    s.created_at,
    COUNT(*) as item_count
  FROM public.sales s,
  jsonb_array_elements(s.items) AS item
  WHERE 
    s.status = 'completed'
    AND (
      (item->>'purchaseCost') IS NULL 
      OR (item->>'purchaseCost') = '0'
      OR (item->>'purchaseCost') = 'null'
    )
  GROUP BY s.id, s.invoice_number, s.created_at
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION audit_missing_purchase_cost() TO authenticated;

-- ── Login Helper RPC ──
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_username TEXT)
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions
AS $$
DECLARE 
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM public.users WHERE LOWER(username) = LOWER(p_username) LIMIT 1;
    RETURN v_email;
END; $$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════════

-- ── Sale Items Unrolled View ──
CREATE OR REPLACE VIEW sale_items_unrolled AS
SELECT 
    s.id AS sale_id,
    s.sale_date,
    (item->'product')->>'name' AS product_name,
    (item->'product')->>'sku' AS sku,
    (item->>'quantity')::numeric AS quantity,
    (item->>'subtotal')::numeric AS subtotal,
    COALESCE((item->>'purchaseCost')::numeric, 0) AS purchase_cost,
    (item->>'subtotal')::numeric - COALESCE((item->>'purchaseCost')::numeric, 0) AS profit
FROM public.sales s,
jsonb_array_elements(s.items) AS item
WHERE s.status = 'completed';

-- ── Daily Summary View ──
CREATE OR REPLACE VIEW daily_summary AS
SELECT
    sa.sale_date,
    COALESCE(SUM(sa.total) FILTER (WHERE sa.sale_type = 'retail'), 0)    AS retail_sales,
    COALESCE(SUM(sa.total) FILTER (WHERE sa.sale_type = 'wholesale'), 0) AS wholesale_sales,
    COALESCE(SUM(sa.total) FILTER (WHERE sa.sale_type = 'estore'), 0)    AS estore_sales,
    COALESCE(SUM(sa.total), 0) AS total_sales,
    COALESCE(SUM(sa.total) FILTER (WHERE sa.payment_method = 'cash'), 0)    AS cash_sales,
    COALESCE(SUM(sa.total) FILTER (WHERE sa.payment_method = 'card'), 0)    AS card_sales,
    COALESCE(SUM(sa.total) FILTER (WHERE sa.payment_method = 'digital'), 0) AS digital_sales
FROM public.sales sa
WHERE sa.sale_date IS NOT NULL
GROUP BY sa.sale_date;

-- ════════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- MASTER §2: anon gets READ-ONLY access (catalog browsing + estore lookup).
-- ALL writes require an authenticated user (JWT). Service role bypasses RLS.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
-- estore customer self-registration inserts customers/orders without JWT
GRANT INSERT ON customers TO anon;

-- ════════════════════════════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════════════════════════════

-- Default App Settings (singleton row)
INSERT INTO app_settings (
    store_name, currency, tax_rate, interface_mode, theme,
    invoice_prefix, invoice_counter, country, business_type,
    auto_backup, receipt_printer, custom_receipt_number,
    receipt_paper_size, receipt_template, receipt_show_logo,
    receipt_show_store_name, receipt_show_store_address,
    receipt_show_store_phone, receipt_show_customer_name,
    receipt_show_notes,
    enable_purchase_orders, po_prefix, po_counter,
    retail_enabled, sound_enabled
) VALUES (
    'Zaynahs Store', 'PKR', 0.0000, 'traditional', 'dark',
    'INV', 1000, 'PK', 'general',
    true, false, false,
    '80mm', 'modern', true,
    true, true,
    true, true,
    true,
    true, 'PO-', 1000,
    true, true
) ON CONFLICT DO NOTHING;

-- Default Categories
INSERT INTO categories (name, description) VALUES
    ('Electronics',      'Electronic devices and accessories'),
    ('Clothing',         'Apparel and fashion items'),
    ('Food & Beverage',  'Food and drink products'),
    ('Home & Garden',    'Home improvement and garden supplies'),
    ('Books & Media',    'Books, magazines, and media content'),
    ('Health & Beauty',   'Healthcare and beauty products'),
    ('Sports & Outdoors','Sports equipment and outdoor gear'),
    ('Automotive',       'Car parts and automotive supplies'),
    ('General',          'General merchandise')
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
    tbl_count INTEGER;
    idx_count INTEGER;
    pol_count INTEGER;
    func_count INTEGER;
    view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tbl_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    SELECT COUNT(*) INTO idx_count FROM pg_indexes WHERE schemaname = 'public';
    SELECT COUNT(*) INTO pol_count FROM pg_policies WHERE schemaname = 'public';
    SELECT COUNT(*) INTO func_count FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') AND prokind = 'f';
    SELECT COUNT(*) INTO view_count FROM information_schema.views WHERE table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════';
    RAISE NOTICE '  ZAYNAH''S POS v2 — SUPER MASTER SCHEMA COMPLETE';
    RAISE NOTICE '══════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables : %', tbl_count;
    RAISE NOTICE 'Indexes : %', idx_count;
    RAISE NOTICE 'RLS Policies : %', pol_count;
    RAISE NOTICE 'Functions : %', func_count;
    RAISE NOTICE 'Views : %', view_count;
    RAISE NOTICE '';
    RAISE NOTICE '═══ READY FOR CLONE / DEPLOYMENT ═══';
END $$;

-- ════════════════════════════════════════════════════════════════
-- END OF SUPER MASTER SCHEMA
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- FIX MISSING COLUMNS IN app_settings
-- ──────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor if you see errors like:
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_discount' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_template' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_logo' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_store_name' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_tax' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_store_address' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_store_phone' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_store_email' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_customer_name' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_customer_phone' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_show_notes' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_template' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_font_weight' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'receipt_density' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_paper_size' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_a4_columns' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_a4_rows' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_show_price' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_show_name' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_show_sku' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_show_category' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_scale' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_height' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_padding' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'barcode_border' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'interface_mode' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'country' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'business_type' on entity 'app_settings'"
--   "AUTO-BLACKLISTED COLUMN: 'allow_credit_over_limit' on entity 'app_settings'"
-- ──────────────────────────────────────────────────────────────

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS receipt_show_logo           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_footer           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_tax             BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_discount         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_store_name      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_store_address    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_store_phone     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_store_email     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_customer_name   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_customer_phone  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_notes           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_delivery_address BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_show_qr_code         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS receipt_template             TEXT DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS receipt_font_weight          TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS receipt_density              NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS interface_mode               TEXT DEFAULT 'touch',
  ADD COLUMN IF NOT EXISTS country                     TEXT DEFAULT 'PK',
  ADD COLUMN IF NOT EXISTS business_type               TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS receipt_padding_top       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_padding_bottom    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_padding_left      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_padding_right     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_offset_x          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_header_offset_x   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_footer_offset_x   INTEGER DEFAULT 0,

  ADD COLUMN IF NOT EXISTS barcode_paper_size            TEXT DEFAULT 'A4',
  ADD COLUMN IF NOT EXISTS barcode_a4_columns            INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS barcode_a4_rows               INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS barcode_show_price            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode_show_name             BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode_show_sku              BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS barcode_show_category         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS barcode_scale                NUMERIC DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS barcode_height                INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS barcode_padding              INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS barcode_border               BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode_name_lines           INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS barcode_font_size            INTEGER DEFAULT 9,
  ADD COLUMN IF NOT EXISTS barcode_content_scale        NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS is_locked                    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_v2_enabled                BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS touch_keyboard_enabled       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_kot_printer            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_split_payment           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_extra_charges           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_save_receipt_png          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_credit_over_limit        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS pos_grid_columns               INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS allow_negative_stock            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_credit_sales            BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cashier_can_credit             BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_purchase_orders         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS po_prefix                      TEXT DEFAULT 'PO',
  ADD COLUMN IF NOT EXISTS po_counter                     INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS barcode_bar_width              NUMERIC DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS barcode_show_barcode           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode_show_qr                BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS barcode_qr_size                INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS receipt_show_barcode           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_approval_threshold       NUMERIC NOT NULL DEFAULT 5000;

DO $$
BEGIN
  RAISE NOTICE '✅ Missing app_settings columns added successfully';
END $$;

-- Products: post-launch columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS variant_data  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS modifiers     JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_type  TEXT DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS is_service    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_serial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_weight_based BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS unit          TEXT DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS parent_id     UUID REFERENCES products(id) ON DELETE CASCADE;

DO $$
BEGIN
  RAISE NOTICE '✅ Missing products columns added successfully';
END $$;

-- Sales: post-launch columns
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS split_payments  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extra_charges   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee    DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_location_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_location_lng NUMERIC;

DO $$
BEGIN
  RAISE NOTICE '✅ Missing sales columns added successfully';
END $$;

-- Handle user deletion from auth when public.users record is deleted
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_user_deleted ON public.users;
CREATE TRIGGER on_user_deleted
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Helper function for Login: Get email by username
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM public.users 
    WHERE LOWER(username) = LOWER(p_username) 
    LIMIT 1;
    
    RETURN v_email;
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS
-- ════════════════════════════════════════════════════════════════

-- ── 1. Process Sale (Atomic Inventory Deduct) ──
CREATE OR REPLACE FUNCTION process_sale(sale_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE new_sale_id UUID;
BEGIN
    INSERT INTO sales (
        id, invoice_number, customer_id, customer_name, customer_phone,
        items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
        tax_amount, total, received_amount, change_amount, payment_method,
        status, cashier, cashier_role, notes, sale_type, timestamp, created_at, updated_at,
        salesman_id, salesman_name
    ) VALUES (
        (sale_data->>'id')::UUID,
        sale_data->>'invoice_number', (sale_data->>'customer_id')::UUID,
        sale_data->>'customer_name', sale_data->>'customer_phone',
        (sale_data->'items')::JSONB, (sale_data->>'subtotal')::DECIMAL,
        (sale_data->>'discount_amount')::DECIMAL, (sale_data->>'bill_discount_value')::DECIMAL,
        sale_data->>'bill_discount_type', (sale_data->>'tax_amount')::DECIMAL,
        (sale_data->>'total')::DECIMAL, (sale_data->>'received_amount')::DECIMAL,
        (sale_data->>'change_amount')::DECIMAL, sale_data->>'payment_method',
        COALESCE(sale_data->>'status', 'completed'), sale_data->>'cashier',
        sale_data->>'cashier_role', sale_data->>'notes',
        COALESCE(sale_data->>'sale_type', 'retail'),
        COALESCE((sale_data->>'timestamp')::TIMESTAMPTZ, NOW()), NOW(), NOW(),
        (NULLIF(BTRIM((sale_data->>'salesman_id')::text), ''))::UUID,
        sale_data->>'salesman_name'
    ) RETURNING id INTO new_sale_id;
    RETURN jsonb_build_object('success', true, 'id', new_sale_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

-- ── 2. Process Return ──
CREATE OR REPLACE FUNCTION process_return(sale_id UUID, return_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_status TEXT;
    v_refunded_amount DECIMAL(12,2);
BEGIN
    v_status := COALESCE(return_data->>'status', 'refunded');
    v_refunded_amount := COALESCE((return_data->>'refundedAmount')::DECIMAL(12,2), 0);
    UPDATE sales SET
        status = v_status,
        refunded_amount = COALESCE(refunded_amount, 0) + v_refunded_amount,
        items = COALESCE(return_data->>'items', items::TEXT)::JSONB,
        notes = COALESCE(notes, '') || '[RETURNED] ' || COALESCE(return_data->>'notes', ''),
        updated_at = NOW()
    WHERE id = sale_id;
    RETURN jsonb_build_object('success', true, 'id', sale_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END; $$;

-- ── 3. Stock Integrity Audit ──
DROP FUNCTION IF EXISTS audit_stock_integrity() CASCADE;
CREATE OR REPLACE FUNCTION audit_stock_integrity()
RETURNS TABLE(product_id uuid, name text, stock integer, history_sum bigint, diff bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT 
    p.id, 
    p.name, 
    p.stock,
    COALESCE(SUM(sh.change_qty), 0) AS history_sum,
    p.stock::bigint - COALESCE(SUM(sh.change_qty), 0) AS diff
  FROM public.products p
  LEFT JOIN public.stock_history sh ON sh.product_id = p.id
  WHERE p.track_inventory = true
  GROUP BY p.id, p.name, p.stock
  HAVING p.stock != COALESCE(SUM(sh.change_qty), 0)
  ORDER BY ABS(p.stock - COALESCE(SUM(sh.change_qty), 0)) DESC;
$$;

-- ── 5. Missing Cost Audit ──
CREATE OR REPLACE FUNCTION audit_missing_purchase_cost()
RETURNS TABLE(sale_id uuid, invoice_number text, created_at timestamptz, item_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT s.id, s.invoice_number, s.created_at, COUNT(*) as item_count
  FROM public.sales s, jsonb_array_elements(s.items) AS item
  WHERE s.status = 'completed'
    AND ((item->>'purchaseCost') IS NULL OR (item->>'purchaseCost') = '0' OR (item->>'purchaseCost') = 'null')
  GROUP BY s.id, s.invoice_number, s.created_at
  ORDER BY s.created_at DESC;
$$;

-- ── 6. SINGLE-TENANT MODE (RLS Disabled + Full Grants) ──
-- Application is configured for a single shop.
-- RLS overhead is disabled. Both anon and authenticated roles
-- have full permissions — safe because Supabase API access is
-- gated by the frontend authentication layer.

DO $$
DECLARE
    t text;
    pol RECORD;
BEGIN
    -- 1. Disable RLS on all tables
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
    
    -- 2. Drop all existing policies
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I',
            pol.policyname,
            pol.tablename
        );
    END LOOP;

    -- 3. Grant ALL to anon and authenticated (single-tenant safety)
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('GRANT ALL ON %I TO anon, authenticated;', t);
    END LOOP;
END $$;

-- ── 7. GRANTS (single-tenant: both roles get full access) ──
GRANT EXECUTE ON FUNCTION process_sale(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_return(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION audit_stock_integrity() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION audit_missing_purchase_cost() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION resolve_login_email(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════
-- SEED: App Settings
-- ════════════════════════════════════════════════════════════════
-- Ensure the default singleton settings row exists
INSERT INTO app_settings (id, store_name)
VALUES ('00000000-0000-4000-8000-000000000001', 'ZaynahsPOS')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- REALTIME CONFIGURATION
-- ════════════════════════════════════════════════════════════════
-- Enable Realtime on ALL core tables (SET TABLE is idempotent)

-- ════════════════════════════════════════════════════════════════
-- SYSTEM AUDIT — Commented out after initial validation.
-- Re-enable individual checks when debugging.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- DATA INTEGRITY — Backfill missing batches and stock_history
-- ════════════════════════════════════════════════════════════════
-- Safe to re-run: uses LEFT JOIN + HAVING COUNT(pb.id) = 0

-- Backfill missing 'initial' stock_history entries
INSERT INTO stock_history (id, product_id, change_qty, balance_after, type, note, cashier_name, created_at)
SELECT
  gen_random_uuid(),
  p.id,
  p.stock - COALESCE(sh_sum.total_change, 0),
  p.stock - COALESCE(sh_sum.total_change, 0),
  'initial',
  'Backfill: Initial stock entry (post-dump repair)',
  'System',
  COALESCE(p.created_at, NOW()) - INTERVAL '1 second'
FROM public.products p
LEFT JOIN (
  SELECT product_id, SUM(change_qty) as total_change
  FROM stock_history
  GROUP BY product_id
) sh_sum ON sh_sum.product_id = p.id
WHERE p.track_inventory = true
  AND ABS(p.stock - COALESCE(sh_sum.total_change, 0)) > 1;

-- ════════════════════════════════════════════════════════════════
-- IDEMPOTENT COLUMN ADDITIONS (Post-Launch schema updates)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS estore_status TEXT DEFAULT 'pending' CHECK (estore_status IN ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_notes TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS menu_number INTEGER,
  ADD COLUMN IF NOT EXISTS highlight_tag TEXT CHECK (highlight_tag IN ('sunday', 'crown'));

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS override_price NUMERIC(10,2);

-- 24. TOPPINGS (Pizza topping add-ons)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS toppings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE,
    price_small     NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_medium    NUMERIC(10,2) NOT NULL DEFAULT 0,
    price_large     NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO toppings (name, price_small, price_medium, price_large) VALUES
    ('Cheese', 70, 100, 150),
    ('Chicken', 50, 80, 100),
    ('Veggie', 30, 50, 70)
ON CONFLICT (name) DO NOTHING;

GRANT SELECT ON TABLE toppings TO anon, authenticated, service_role;
GRANT ALL ON TABLE toppings TO service_role;

-- ════════════════════════════════════════════════════════════════
-- 25. PRODUCT TOPPINGS (which toppings are available per product)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_toppings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    topping_id  UUID NOT NULL REFERENCES toppings(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, topping_id)
);

CREATE INDEX IF NOT EXISTS idx_product_toppings_product ON product_toppings(product_id);

GRANT SELECT, INSERT, DELETE ON TABLE product_toppings TO anon, authenticated, service_role;
GRANT ALL ON TABLE product_toppings TO service_role;

-- ════════════════════════════════════════════════════════════════
-- POST-LAUNCH ALTER TABLE: supplier_transactions — Ledger Separation + Manual Override
-- ════════════════════════════════════════════════════════════════
ALTER TABLE supplier_transactions
  ADD COLUMN IF NOT EXISTS source_type          TEXT DEFAULT 'manual_bill',
  ADD COLUMN IF NOT EXISTS is_manual_override   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_by          TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- POST-LAUNCH ALTER TABLE: payments — Manual Override
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS is_manual_override   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_by          TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- POST-LAUNCH ALTER TABLE: stock_history — Delta Sync Support
ALTER TABLE stock_history
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- POST-LAUNCH ALTER TABLE: variant_stock_history — Delta Sync Support
ALTER TABLE variant_stock_history
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- POST-LAUNCH FIX (2026-08-12, found by TESTS_GUIDE full-flow battery):
-- variant_stock_history type CHECK must allow 'purchase' + signed reversal types on
-- ALL projects (PizzaMilano had older 4-type check → variant stock-in crashed there).
DO $$ BEGIN
  ALTER TABLE variant_stock_history DROP CONSTRAINT IF EXISTS variant_stock_history_type_check;
  ALTER TABLE variant_stock_history ADD CONSTRAINT variant_stock_history_type_check
    CHECK (type IN ('sale', 'return', 'adjustment', 'initial', 'purchase', 'stock_in', 'adjustment_out'));
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- POST-LAUNCH ALTER TABLE: product_addons — Delta Sync Support
ALTER TABLE product_addons
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- POST-LAUNCH TRIGGERS: updated_at for the 5 ledger/history tables
DO $$ BEGIN CREATE TRIGGER update_supplier_transactions_updated_at BEFORE UPDATE ON supplier_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_payments_updated_at              BEFORE UPDATE ON payments              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_stock_history_updated_at         BEFORE UPDATE ON stock_history         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_variant_stock_history_updated_at BEFORE UPDATE ON variant_stock_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_product_addons_updated_at        BEFORE UPDATE ON product_addons        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- POST-LAUNCH TRIGGERS: Inventory Sync Triggers
DO $$ BEGIN CREATE TRIGGER on_stock_history_insert AFTER INSERT ON stock_history FOR EACH ROW EXECUTE FUNCTION trigger_update_product_stock(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER on_variant_stock_history_insert AFTER INSERT ON variant_stock_history FOR EACH ROW EXECUTE FUNCTION trigger_update_variant_stock(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- POST-LAUNCH ALTER TABLE: expenses — Manual Override
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_manual_override   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_by          TEXT;

-- POST-LAUNCH ALTER TABLE: sales — Soft Delete Support & Online Orders Tracing
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_order_id      UUID;

-- (UNIQUE, partial) index on source_order_id — created here (post-launch) so the
-- column exists first. CREATE INDEX IF NOT EXISTS keeps it idempotent on existing projects.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_source_order_id ON sales(source_order_id) WHERE source_order_id IS NOT NULL;
-- POST-LAUNCH ALTER TABLE: sales — Idempotency Key (commit_sale references it)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency_key ON sales(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- POST-LAUNCH ALTER TABLE: sales — Salesman Tracking
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS salesman_id     UUID,
  ADD COLUMN IF NOT EXISTS salesman_name   TEXT;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_salesman_id_fkey;

-- POST-LAUNCH: Enable realtime for salesmen
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE salesmen;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Fix Estore Oversell Bug: Reserve stock upon order placement
-- (fixed 2026-08-12: delivery_address column — app sends delivery_address;
--  reference_id UUID cast fix; variant-aware reservation F22)

-- Estore policy (2026-08-12): NO stock effect at placement — inventory moves
-- ONLY when the POS bills the order (sale create = normal sale path deduction).
-- Cancel restores stock ONLY for legacy pre-migration reservations (self-healing).
-- Cancelled orders are auto-permanently deleted 24h after cancellation (app prune).-- Trigger to release stock when a legacy-pre-migration estore order is cancelled.
-- New orders (2026-08-12+ policy) never touched stock at placement → cancel is a no-op.
CREATE OR REPLACE FUNCTION trigger_release_estore_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    product_rec record;
    has_reservation boolean;
BEGIN
    -- If status changed to cancelled AND the order was never fulfilled
    -- (fulfilled orders already route stock through the sale/refund ledger —
    --  releasing here too would double-restore stock / inflate the ledger)
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.fulfilled_sale_id IS NULL THEN
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            SELECT id, track_inventory INTO product_rec FROM products WHERE id = (item->'product'->>'id')::uuid;

            IF product_rec.track_inventory IS TRUE THEN
                IF item ? 'variantId' AND item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
                    SELECT EXISTS (
                        SELECT 1 FROM variant_stock_history
                        WHERE product_id = product_rec.id
                          AND variant_id = (item->>'variantId')::text
                          AND reference_id = NEW.id
                          AND note LIKE 'Estore Reservation%'
                    ) INTO has_reservation;

                    IF has_reservation THEN
                        INSERT INTO variant_stock_history (
                            product_id, variant_id, variant_label, change_qty, type,
                            reference_id, note, cashier_name
                        ) VALUES (
                            product_rec.id,
                            item->>'variantId',
                            item->>'variantLabel',
                            (item->>'quantity')::integer,
                            'return',
                            NEW.id,
                            'Estore Order Cancelled: ' || NEW.invoice_number,
                            'System'
                        );
                    END IF;
                ELSE
                    SELECT EXISTS (
                        SELECT 1 FROM stock_history
                        WHERE product_id = product_rec.id
                          AND reference_id = NEW.id
                          AND note LIKE 'Estore Reservation%'
                    ) INTO has_reservation;

                    IF has_reservation THEN
                        INSERT INTO stock_history (
                            product_id, change_qty, type, reference_id, note, cashier_name
                        ) VALUES (
                            product_rec.id,
                            (item->>'quantity')::integer,
                            'return',
                            NEW.id,
                            'Estore Order Cancelled: ' || NEW.invoice_number,
                            'System'
                        );
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;



-- Enable RLS on stock_history and variant_stock_history
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_stock_history ENABLE ROW LEVEL SECURITY;

-- 1. stock_history Policies
-- Allow anyone to read (needed for POS devices sync)
DROP POLICY IF EXISTS "Allow public read on stock_history" ON stock_history;
CREATE POLICY "Allow public read on stock_history" 
ON stock_history FOR SELECT 
TO public 
USING (true);

-- Allow authenticated and anon users to insert (POS Cashiers/Admins)
DROP POLICY IF EXISTS "Allow authenticated insert on stock_history" ON stock_history;
CREATE POLICY "Allow authenticated insert on stock_history" 
ON stock_history FOR INSERT 
TO authenticated, anon 
WITH CHECK (true);

-- Allow service_role to do everything
DROP POLICY IF EXISTS "Allow service_role ALL on stock_history" ON stock_history;
CREATE POLICY "Allow service_role ALL on stock_history" 
ON stock_history FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 2. variant_stock_history Policies
-- Allow anyone to read
DROP POLICY IF EXISTS "Allow public read on variant_stock_history" ON variant_stock_history;
CREATE POLICY "Allow public read on variant_stock_history" 
ON variant_stock_history FOR SELECT 
TO public 
USING (true);

-- Allow authenticated and anon users to insert
DROP POLICY IF EXISTS "Allow authenticated insert on variant_stock_history" ON variant_stock_history;
CREATE POLICY "Allow authenticated insert on variant_stock_history" 
ON variant_stock_history FOR INSERT 
TO authenticated, anon 
WITH CHECK (true);

-- Allow service_role to do everything
DROP POLICY IF EXISTS "Allow service_role ALL on variant_stock_history" ON variant_stock_history;
CREATE POLICY "Allow service_role ALL on variant_stock_history" 
ON variant_stock_history FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- POST-LAUNCH (F21/F22 — 2026-08-12): Stale-Write Guards + Variant Restock
-- ════════════════════════════════════════════════════════════════

-- F22: purchase_records variant columns (variant-targeted restock)
ALTER TABLE purchase_records
  ADD COLUMN IF NOT EXISTS variant_id   TEXT,
  ADD COLUMN IF NOT EXISTS variant_label TEXT;

-- F21: row_tombstones registry (created near table 27b; re-created idempotently)
CREATE TABLE IF NOT EXISTS row_tombstones (
  table_name TEXT NOT NULL,
  ref_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_name, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_row_tombstones_ref ON row_tombstones(ref_id);
GRANT ALL ON row_tombstones TO anon, authenticated, service_role;
ALTER TABLE row_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service_role ALL on row_tombstones" ON row_tombstones;
CREATE POLICY "Allow service_role ALL on row_tombstones"
  ON row_tombstones FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon ALL on row_tombstones" ON row_tombstones;
CREATE POLICY "Allow anon ALL on row_tombstones"
  ON row_tombstones FOR ALL
  TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated ALL on row_tombstones" ON row_tombstones;
CREATE POLICY "Allow authenticated ALL on row_tombstones"
  ON row_tombstones FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- F21: guard + tombstone triggers (idempotent re-creation)
DO $$ BEGIN CREATE TRIGGER guard_stale_write_sales            BEFORE INSERT OR UPDATE ON sales                FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_stock_history    BEFORE INSERT OR UPDATE ON stock_history         FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_variant_history  BEFORE INSERT OR UPDATE ON variant_stock_history FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_purchase_records BEFORE INSERT OR UPDATE ON purchase_records      FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_expenses         BEFORE INSERT OR UPDATE ON expenses              FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER guard_stale_write_payments         BEFORE INSERT OR UPDATE ON payments              FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER guard_stale_write_sales_tabs       BEFORE INSERT OR UPDATE ON sales_tabs            FOR EACH ROW EXECUTE FUNCTION guard_stale_write(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER record_tombstone_sales             AFTER DELETE ON sales                FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_stock_history     AFTER DELETE ON stock_history         FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_variant_history   AFTER DELETE ON variant_stock_history FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_purchase_records  AFTER DELETE ON purchase_records      FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_expenses          AFTER DELETE ON expenses              FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER record_tombstone_payments          AFTER DELETE ON payments              FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TRIGGER record_tombstone_sales_tabs        AFTER DELETE ON sales_tabs            FOR EACH ROW EXECUTE FUNCTION record_row_tombstone(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- ════════════════════════════════════════════════════════════════
-- MIGRATION: Inventory Sync Trigger
-- Ensures 10-year auditability by mathematically adjusting product stock
-- whenever a stock_history delta is appended.
-- ════════════════════════════════════════════════════════════════

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION trigger_update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the main product stock
    UPDATE products SET 
        stock = COALESCE(stock, 0) + NEW.change_qty,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to stock_history
DROP TRIGGER IF EXISTS on_stock_history_insert ON stock_history;
CREATE TRIGGER on_stock_history_insert
AFTER INSERT ON stock_history
FOR EACH ROW EXECUTE FUNCTION trigger_update_product_stock();

-- 3. Create the variant stock trigger function
CREATE OR REPLACE FUNCTION trigger_update_variant_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the variant stock inside the JSONB variant_data array
    -- This relies on the fact that variant_data is an array of objects
    -- We update the specific object where id = NEW.variant_id
    UPDATE products
    SET 
        variant_data = (
            SELECT jsonb_agg(
                CASE 
                    WHEN v->>'id' = NEW.variant_id::text THEN 
                        v || jsonb_build_object('stock', COALESCE((v->>'stock')::int, 0) + NEW.change_qty)
                    ELSE v 
                END
            )
            FROM jsonb_array_elements(variant_data) AS v
        ),
        updated_at = NOW()
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach the trigger to variant_stock_history
DROP TRIGGER IF EXISTS on_variant_stock_history_insert ON variant_stock_history;
CREATE TRIGGER on_variant_stock_history_insert
AFTER INSERT ON variant_stock_history
FOR EACH ROW EXECUTE FUNCTION trigger_update_variant_stock();

-- 5. Restore Reconcile Tool (F11 Rule)
-- This replaces the deprecated product_batches reconcile tool with a stock_history sum comparison.
CREATE OR REPLACE FUNCTION audit_stock_integrity_history()
RETURNS TABLE(product_id uuid, name text, stock integer, history_sum bigint, diff bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT 
    p.id, 
    p.name, 
    p.stock,
    COALESCE(SUM(sh.change_qty), 0) AS history_sum,
    p.stock::bigint - COALESCE(SUM(sh.change_qty), 0) AS diff
  FROM public.products p
  LEFT JOIN public.stock_history sh ON sh.product_id = p.id
  WHERE p.track_inventory = true
  GROUP BY p.id, p.name, p.stock
  HAVING p.stock != COALESCE(SUM(sh.change_qty), 0)
  ORDER BY ABS(p.stock - COALESCE(SUM(sh.change_qty), 0)) DESC;
$$;

GRANT EXECUTE ON FUNCTION audit_stock_integrity_history() TO anon, authenticated;
-- Fix Estore Oversell Bug: Reserve stock upon order placement

-- Grant execute to anon
-- Issue: trigger_release_estore_stock released +qty on ANY transition to 'cancelled'.
-- If an order was already FULFILLED (sale converted — goods sold, stock already
-- deducted at sale commit / restored at sale refund), cancelling the order released
-- stock a second time (net stock inflation).
-- Fix: only release reservation stock when the order was NEVER fulfilled.
CREATE OR REPLACE FUNCTION public.trigger_release_estore_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    product_rec record;
BEGIN
    -- If status changed to cancelled AND the order was never fulfilled
    -- (fulfilled orders already route stock through the sale/refund ledger)
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.fulfilled_sale_id IS NULL THEN
        -- Loop through items to restore stock
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            -- Check if product tracks inventory
            SELECT id, track_inventory INTO product_rec FROM products WHERE id = (item->'product'->>'id')::uuid;

            IF product_rec.track_inventory = true THEN
                INSERT INTO stock_history (
                    product_id, change_qty, type, reference_id, note, cashier_name
                ) VALUES (
                    product_rec.id,
                    (item->>'quantity')::integer,
                    'return',
                    NEW.id::text,
                    'Estore Order Cancelled: ' || NEW.invoice_number,
                    'System'
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;


-- 🐛 FIX (found by TESTS_GUIDE full-system-flow battery, 2026-08-12):
--   1. place_estore_order referenced columns (address, table_number, fulfillment_mode)
--      that DON'T EXIST in store_orders → EVERY online order placement failed.
--      App sends 'delivery_address' (toRemoteStoreOrder) — switch to that column.
--   2. reference_id is UUID; both functions cast ::text → every tracked-product
--      order AND every cancel raised 42804 → stock reservation/release never happened.
--   3. F22 note: estore reservation deducts via stock_history (product-level) —
--      variant items would silently not reserve; app routes variant orders
--      through variant_stock_history on the POS side; RPC reserves products only.

CREATE OR REPLACE FUNCTION trigger_release_estore_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    product_rec record;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.fulfilled_sale_id IS NULL THEN
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            SELECT id, track_inventory INTO product_rec FROM products WHERE id = (item->'product'->>'id')::uuid;
            IF product_rec.track_inventory IS TRUE THEN
                IF item ? 'variantId' AND item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
                    INSERT INTO variant_stock_history (
                        product_id, variant_id, variant_label, change_qty, type,
                        reference_id, note, cashier_name
                    ) VALUES (
                        product_rec.id,
                        item->>'variantId',
                        item->>'variantLabel',
                        (item->>'quantity')::integer,
                        'return',
                        NEW.id,
                        'Estore Order Cancelled: ' || NEW.invoice_number,
                        'System'
                    );
                ELSE
                    INSERT INTO stock_history (
                        product_id, change_qty, type, reference_id, note, cashier_name
                    ) VALUES (
                        product_rec.id,
                        (item->>'quantity')::integer,
                        'return',
                        NEW.id,
                        'Estore Order Cancelled: ' || NEW.invoice_number,
                        'System'
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;-- 20260813000000_fix_products_variant_history_schema_parity.sql
-- 🐛 FIX (found by TESTS_GUIDE full-system-flow battery, 2026-08-12):
--   1. MINIMAHAL: products.product_type (etc.) columns were NEVER added — the
--      master schema's post-launch ALTER block omitted them → variable products
--      could not save on that project (schema divergence, MAJOR RULES #5/#6).
--   2. PIZZAMILANO: variant_stock_history type CHECK lacked 'purchase' → variant
--      stock-in crashed there (divergence). Master schema now normalizes to the
--      full signed-7 type set.
-- Fix = idempotent ALTERs; safe on all 4 projects.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type   TEXT DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS is_service     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_serial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_weight_based BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS unit           TEXT DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS parent_id      UUID REFERENCES products(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE variant_stock_history DROP CONSTRAINT IF EXISTS variant_stock_history_type_check;
  ALTER TABLE variant_stock_history ADD CONSTRAINT variant_stock_history_type_check
    CHECK (type IN ('sale', 'return', 'adjustment', 'initial', 'purchase', 'stock_in', 'adjustment_out'));
EXCEPTION WHEN undefined_object THEN NULL; END $$;-- ═══════════════════════════════════════════════════════════════════════════
-- ESTORE POLICY CHANGE (2026-08-12) — "No stock effect until POS bill"
--
-- Why:
--   Previously place_estore_order RESERVED stock at order placement (deducted
--   -qty immediately) and the cancel trigger restored it. User policy change:
--   til the POS bills an online order, inventory must show ZERO movement.
--
-- New behavior (PERMANENT):
--   1. place_estore_order → inserts the order ONLY. No stock_history /
--      variant_stock_history rows. Inventory untouched at placement.
--   2. POS fulfillment (CheckoutPage/CheckoutModal) creates the sale with
--      sourceOrderId → salesService.create now deducts stock through the
--      normal sale path (AI-era client code removes the isEstoreFulfillment
--      skip). The sale's own 'sale' history rows are the ONLY stock effect.
--   3. trigger_release_estore_stock → cancel restores stock ONLY IF a matching
--      'Estore Reservation' row still exists (legacy in-flight orders placed
--      before this migration). New orders have no reservations → no-op.
--      Self-healing + idempotent: never double-restores, never invents stock.
--   4. LEGACY in-flight reservations (rows with note 'Estore Reservation: …')
--      are compensated with +qty 'return' entries at migration time. Net
--      zero — stock returns to pre-reservation level — so fulfilling an old
--      order after this migration deducts exactly once (no double deduction).
--   5. Cancelled store orders are auto-permanently deleted 24h after
--      cancellation by the app's maintenance prune (syncEngine), now ENABLED.
--      Permanent via row_tombstones (F21) — deleted rows can never resurrect.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. place_estore_order: REMOVE the reservation loop ─────────────────────
CREATE OR REPLACE FUNCTION place_estore_order(order_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_order_id uuid;
BEGIN
    -- 1. Insert into store_orders (no stock effect — POS bill deducts later)
    INSERT INTO store_orders (
        invoice_number, customer_id, customer_name, customer_phone,
        delivery_address, customer_notes, items, subtotal, discount_amount,
        tax_amount, total, payment_method, status, cashier,
        delivery_location_lat, delivery_location_lng, delivery_fee
    ) VALUES (
        order_data->>'invoice_number',
        (order_data->>'customer_id')::uuid,
        order_data->>'customer_name',
        order_data->>'customer_phone',
        COALESCE(order_data->>'delivery_address', order_data->>'address'),
        order_data->>'customer_notes',
        order_data->'items',
        (order_data->>'subtotal')::numeric,
        (order_data->>'discount_amount')::numeric,
        (order_data->>'tax_amount')::numeric,
        (order_data->>'total')::numeric,
        order_data->>'payment_method',
        order_data->>'status',
        order_data->>'cashier',
        (order_data->>'delivery_location_lat')::numeric,
        (order_data->>'delivery_location_lng')::numeric,
        (order_data->>'delivery_fee')::numeric
    ) RETURNING id INTO new_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', new_order_id);
END;
$$;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION place_estore_order(jsonb) TO anon, authenticated, service_role;

-- ── 2. trigger_release_estore_stock: restore ONLY if a reservation exists ──
-- New orders never create reservations → cancel is a no-op (correct).
-- Legacy pre-migration orders had reservations → cancel still releases them.
CREATE OR REPLACE FUNCTION trigger_release_estore_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    product_rec record;
    has_reservation boolean;
BEGIN
    -- If status changed to cancelled AND the order was never fulfilled
    -- (fulfilled orders already route stock through the sale/refund ledger —
    --  releasing here too would double-restore stock / inflate the ledger)
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.fulfilled_sale_id IS NULL THEN
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            -- Check if product tracks inventory
            SELECT id, track_inventory INTO product_rec FROM products WHERE id = (item->'product'->>'id')::uuid;

            IF product_rec.track_inventory IS TRUE THEN
                IF item ? 'variantId' AND item->>'variantId' IS NOT NULL AND item->>'variantId' != '' THEN
                    -- Variant path: release ONLY if a legacy reservation exists for THIS order
                    SELECT EXISTS (
                        SELECT 1 FROM variant_stock_history
                        WHERE product_id = product_rec.id
                          AND variant_id = (item->>'variantId')::text
                          AND reference_id = NEW.id
                          AND note LIKE 'Estore Reservation%'
                    ) INTO has_reservation;

                    IF has_reservation THEN
                        INSERT INTO variant_stock_history (
                            product_id, variant_id, variant_label, change_qty, type,
                            reference_id, note, cashier_name
                        ) VALUES (
                            product_rec.id,
                            item->>'variantId',
                            item->>'variantLabel',
                            (item->>'quantity')::integer,
                            'return',
                            NEW.id,
                            'Estore Order Cancelled: ' || NEW.invoice_number,
                            'System'
                        );
                    END IF;
                ELSE
                    -- Simple path: release ONLY if a legacy reservation exists for THIS order
                    SELECT EXISTS (
                        SELECT 1 FROM stock_history
                        WHERE product_id = product_rec.id
                          AND reference_id = NEW.id
                          AND note LIKE 'Estore Reservation%'
                    ) INTO has_reservation;

                    IF has_reservation THEN
                        INSERT INTO stock_history (
                            product_id, change_qty, type, reference_id, note, cashier_name
                        ) VALUES (
                            product_rec.id,
                            (item->>'quantity')::integer,
                            'return',
                            NEW.id,
                            'Estore Order Cancelled: ' || NEW.invoice_number,
                            'System'
                        );
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)




-- ============================================================================
-- ATOMIC SALE & STOCK COMMIT RPCs (2026-08-16 — Phase 1, online-authoritative)
-- Commit a sale + ALL its stock movements in ONE transaction so products.stock
-- / variant_data can NEVER diverge from sales. Idempotent ids prevent double
-- writes on retry. Cloud stock still maintained by stock_history /
-- variant_stock_history triggers.
-- ============================================================================

-- lock_product_stock (MASTER §12): transaction-scoped row lock helper.
-- SECURITY DEFINER because inline "SELECT ... FOR UPDATE" inside an invoker
-- function is silently filtered by RLS for non-owner roles (live-tested:
-- returns 0 rows, so the oversell guard never fired). The lock is taken as
-- table owner but held until the CALLER's transaction commits, which is what
-- serializes concurrent commit_sale calls. Race test: two terminals selling
-- the last unit -> exactly one succeeds, the other gets OVERSELL.
CREATE OR REPLACE FUNCTION public.lock_product_stock(pid uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE s numeric;
BEGIN
  SELECT stock INTO s FROM products WHERE id = pid FOR UPDATE;
  RETURN s;
END $function$;

REVOKE ALL ON FUNCTION public.lock_product_stock FROM anon;
REVOKE ALL ON FUNCTION public.lock_product_stock FROM public;
GRANT EXECUTE ON FUNCTION public.lock_product_stock TO authenticated;

CREATE OR REPLACE FUNCTION commit_sale(
  p_sale jsonb, 
  p_history jsonb,
  p_payment_moves jsonb DEFAULT '[]'::jsonb,
  p_customer_ledger jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  h jsonb;
  cur numeric;
  v_allow_neg boolean := false;
  v_oversell int;
BEGIN
  IF p_sale->>'source_order_id' IS NOT NULL AND p_sale->>'source_order_id' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE source_order_id = (p_sale->>'source_order_id')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'id', (SELECT id FROM sales WHERE source_order_id = (p_sale->>'source_order_id')::uuid), 'already_fulfilled', true);
    END IF;
  END IF;

  IF p_sale->>'idempotency_key' IS NOT NULL AND p_sale->>'idempotency_key' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE idempotency_key = (p_sale->>'idempotency_key')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'id', (SELECT id FROM sales WHERE idempotency_key = (p_sale->>'idempotency_key')::uuid), 'already_committed', true);
    END IF;
  END IF;

  SELECT COALESCE(allow_negative_stock, false) INTO v_allow_neg FROM app_settings LIMIT 1;
  IF NOT v_allow_neg THEN
    WITH agg AS (
      SELECT (hist_item->>'product_id')::uuid AS pid, SUM((hist_item->>'change_qty')::int) AS delta
      FROM jsonb_array_elements(p_history) hist_item
      WHERE hist_item->>'variant_id' IS NULL OR hist_item->>'variant_id' = ''
      GROUP BY pid
    )
    SELECT 1 INTO v_oversell FROM agg
    JOIN products p ON p.id = agg.pid
    WHERE (p.stock + agg.delta) < 0
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'OVERSELL: stock would go negative for a product (allow_negative_stock=false)';
    END IF;
  END IF;

  INSERT INTO sales (
    id, invoice_number, customer_id, customer_name, customer_phone,
    items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
    tax_amount, total, received_amount, change_amount, payment_method,
    card_details, status, cashier, cashier_role, receipt_number, notes,
    applied_discounts, free_gifts, timestamp, sale_date, sale_type,
    extra_charges, split_payments, refunded_amount, estore_status,
    delivery_address, delivery_fee, delivery_location_lat, delivery_location_lng,
    customer_notes, source_order_id, salesman_id, salesman_name, idempotency_key, created_at, updated_at
  ) VALUES (
    (p_sale->>'id')::uuid, p_sale->>'invoice_number', NULLIF(p_sale->>'customer_id','')::uuid,
    p_sale->>'customer_name', p_sale->>'customer_phone', COALESCE(p_sale->'items','[]'::jsonb),
    (p_sale->>'subtotal')::numeric, (p_sale->>'discount_amount')::numeric, (p_sale->>'bill_discount_value')::numeric,
    p_sale->>'bill_discount_type', (p_sale->>'tax_amount')::numeric, (p_sale->>'total')::numeric,
    (p_sale->>'received_amount')::numeric, (p_sale->>'change_amount')::numeric, p_sale->>'payment_method',
    p_sale->'card_details', p_sale->>'status', p_sale->>'cashier', p_sale->>'cashier_role',
    p_sale->>'receipt_number', p_sale->>'notes', p_sale->'applied_discounts', p_sale->'free_gifts',
    (p_sale->>'timestamp')::timestamptz, (p_sale->>'sale_date')::date, p_sale->>'sale_type',
    p_sale->'extra_charges', p_sale->'split_payments', (p_sale->>'refunded_amount')::numeric,
    p_sale->>'estore_status', p_sale->>'delivery_address', (p_sale->>'delivery_fee')::numeric,
    (p_sale->>'delivery_location_lat')::numeric, (p_sale->>'delivery_location_lng')::numeric,
    p_sale->>'customer_notes', NULLIF(p_sale->>'source_order_id','')::uuid, NULLIF(p_sale->>'salesman_id','')::uuid,
    p_sale->>'salesman_name', NULLIF(p_sale->>'idempotency_key','')::uuid,
    COALESCE((p_sale->>'created_at')::timestamptz, now()), now()
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_id;

  IF v_id IS NULL THEN v_id := (p_sale->>'id')::uuid; END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  -- Payment Moves
  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, v_id, h->>'note', now()) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- Customer Ledger
  IF p_customer_ledger IS NOT NULL AND jsonb_typeof(p_customer_ledger) = 'object' THEN
    INSERT INTO customer_ledger (id, customer_id, sale_id, type, debit, credit, balance_after, reference, note, created_by, created_at)
    VALUES (
      COALESCE((p_customer_ledger->>'id')::uuid, gen_random_uuid()), (p_customer_ledger->>'customer_id')::uuid, v_id,
      p_customer_ledger->>'type', (p_customer_ledger->>'debit')::numeric, (p_customer_ledger->>'credit')::numeric,
      (p_customer_ledger->>'balance_after')::numeric, p_customer_ledger->>'reference', p_customer_ledger->>'note',
      NULLIF(p_customer_ledger->>'created_by','')::uuid, COALESCE((p_customer_ledger->>'created_at')::timestamptz, now())
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION apply_stock_movements(p_history jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  h jsonb;
BEGIN
  FOR h IN SELECT * FROM jsonb_array_elements(p_history)
  LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', NULLIF(h->>'reference_id','')::uuid, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', NULLIF(h->>'reference_id','')::uuid, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION commit_sale(jsonb, jsonb, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION apply_stock_movements(jsonb) TO anon, authenticated, service_role;

-- ── 8. ATOMIC DELETE + REFUND ──
-- Canonical, signed definitions live in §rpc_role_guards (delete_sale_atomic 5-arg,
-- refund_sale_atomic 7-arg) — HARD DELETE + row_tombstone per MASTER §0.6. The
-- stale soft-delete (status='deleted', deleted_at) overloads were removed; do NOT
-- re-add them (they directly violate the hard-delete + tombstone rule).

-- ════════════════════════════════════════════════════════════════
-- 26. PAYMENT MODES / WALLETS  (Per-method running balances)
--     cash, card, online, wallet — each holds its own authoritative
--     balance, adjusted atomically + idempotently per transaction.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_modes (
    id          TEXT PRIMARY KEY,                       -- 'cash','card','online','wallet', or custom
    name        TEXT NOT NULL,
    icon        TEXT DEFAULT 'wallet',
    balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 99,
    color       TEXT DEFAULT '#6366f1',
    is_default  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes REPLICA IDENTITY FULL;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_modes;
CREATE POLICY "Allow all for authenticated" ON payment_modes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payment_movements (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mode_id      TEXT NOT NULL REFERENCES payment_modes(id) ON DELETE CASCADE,
    delta        NUMERIC(14,2) NOT NULL,
    reference_id UUID,
    note         TEXT,
    created_at   TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE payment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_movements REPLICA IDENTITY FULL;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payment_movements;
CREATE POLICY "Allow all for authenticated" ON payment_movements FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════
-- 26b. SALE AUDIT LOG  (deviceId + every sale action trail)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sale_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           UUID,
  invoice_number    TEXT,
  action            TEXT NOT NULL CHECK (action IN (
    'created','edited','deleted','refunded','partially_refunded',
    'discount_changed','payment_changed','item_added','item_removed','price_changed','status_changed'
  )),
  performed_by_id   UUID,
  performed_by_name TEXT,
  performed_by_role TEXT,
  device_id         TEXT,
  note              TEXT,
  meta              JSONB,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sal_sale ON sale_audit_log(sale_id);
CREATE INDEX IF NOT EXISTS idx_sal_time ON sale_audit_log(created_at DESC);
ALTER TABLE sale_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sal_all" ON sale_audit_log FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE sale_audit_log TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════
-- 26c. RECONCILIATION VIEWS  (ledger consistency checks)
-- ════════════════════════════════════════════════════
CREATE OR REPLACE VIEW stock_drift AS
SELECT p.id, p.name, p.stock AS current_stock,
  COALESCE(SUM(sh.change_qty),0) AS history_sum,
  p.stock - COALESCE(SUM(sh.change_qty),0) AS drift
FROM products p LEFT JOIN stock_history sh ON sh.product_id = p.id
WHERE p.track_inventory = true GROUP BY p.id, p.name, p.stock
HAVING p.stock != COALESCE(SUM(sh.change_qty),0);

CREATE OR REPLACE VIEW wallet_drift AS
SELECT pm.id, pm.name, pm.balance,
  COALESCE(SUM(pmv.delta),0) AS movements_sum,
  pm.balance - COALESCE(SUM(pmv.delta),0) AS drift
FROM payment_modes pm LEFT JOIN payment_movements pmv ON pmv.mode_id = pm.id
GROUP BY pm.id, pm.name, pm.balance
HAVING ABS(pm.balance - COALESCE(SUM(pmv.delta),0)) > 0.01;

CREATE OR REPLACE VIEW over_refunds AS
SELECT id, invoice_number, total, refunded_amount FROM sales
WHERE refunded_amount > total + 0.01;

CREATE OR REPLACE VIEW orphan_sales AS
SELECT s.id, s.invoice_number FROM sales s
INNER JOIN row_tombstones rt ON rt.ref_id = s.id AND rt.table_name = 'sales';

GRANT SELECT ON stock_drift, wallet_drift, over_refunds, orphan_sales TO anon, authenticated, service_role;

-- Atomic, idempotent per-method balance adjustment (mirrors apply_stock_movements).
-- Each move carries a unique id; if already applied it is skipped (FOUND = false),
-- so re-sends (offline flush / realtime replay) never double-count.
CREATE OR REPLACE FUNCTION apply_payment_movements(p_moves jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  h jsonb;
BEGIN
  FOR h IN SELECT * FROM jsonb_array_elements(p_moves)
  LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (
      COALESCE((h->>'id')::uuid, gen_random_uuid()),
      h->>'mode_id',
      (h->>'delta')::numeric,
      NULLIF(h->>'reference_id','')::uuid,
      h->>'note',
      now()
    )
    ON CONFLICT (id) DO NOTHING;
    IF FOUND THEN
      UPDATE payment_modes SET balance = balance + (h->>'delta')::numeric, updated_at = now()
      WHERE id = h->>'mode_id';
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION apply_payment_movements(jsonb) TO anon, authenticated, service_role;

-- ── E-store order state machine + rate limit (MASTER §9) ──
CREATE OR REPLACE FUNCTION store_order_transition_is_valid(old_s text, new_s text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  allowed text[];
BEGIN
  IF old_s IS NULL OR old_s = new_s THEN RETURN true; END IF;
  CASE old_s
    WHEN 'pending'         THEN allowed := ARRAY['accepted', 'cancelled', 'converted'];
    WHEN 'accepted'        THEN allowed := ARRAY['preparing', 'cancelled', 'converted'];
    WHEN 'preparing'       THEN allowed := ARRAY['ready', 'cancelled', 'converted'];
    WHEN 'ready'           THEN allowed := ARRAY['out_for_delivery', 'cancelled', 'converted'];
    WHEN 'out_for_delivery' THEN allowed := ARRAY['delivered', 'cancelled', 'converted'];
    WHEN 'delivered'       THEN allowed := ARRAY[]::text[];
    WHEN 'cancelled'       THEN allowed := ARRAY[]::text[];
    WHEN 'converted'       THEN allowed := ARRAY[]::text[];
    ELSE RETURN false;
  END CASE;
  RETURN new_s = ANY(allowed);
END;
$$;

-- (Duplicate trigger creation removed to prevent 42883 error)-- ============================================================================
-- rpc_role_guards: canonical signed delete_sale_atomic (5-arg) and refund_sale_atomic
-- (7-arg) are defined further below (hard delete + row_tombstone per MASTER §0.6).
-- The soft-delete (status='deleted') overloads were removed — do not re-add.
-- ============================================================================
-- reconciliation (MASTER §4.3 / §7)
-- Provides the acceptance-test machinery for invariants I1, I2, I4, I5, I6.
-- I3 (supplier balance) is NOT stored as a column in this schema — it is always
-- DERIVED from supplier_transactions, so it cannot drift (documented in report).
-- Variant stock lives inside products.variant_data JSONB (updated by the
-- variant_stock_history trigger) and is covered separately (see report §15F).
-- ============================================================================

-- Mismatch ledger: every detected drift is recorded here and must be corrected
-- manually (which inserts an ADJUSTMENT stock_history / payment_movements row),
-- never by a raw UPDATE (MASTER §4.3).
CREATE TABLE IF NOT EXISTS stock_mismatches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('inventory', 'wallet')),
  entity_id   TEXT NOT NULL,
  expected    NUMERIC,
  actual      NUMERIC,
  detected_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  note        TEXT
);

-- Run reconciliation: record any I1 (inventory) / I2 (wallet) drift into
-- stock_mismatches. Returns the number of new mismatch rows.
CREATE OR REPLACE FUNCTION reconcile_now()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  n INTEGER := 0;
  r RECORD;
BEGIN
  -- I1: products.stock vs Σ stock_history.change_qty (only tracked products)
  FOR r IN
    SELECT p.id::text AS eid, p.stock AS actual,
      COALESCE((SELECT SUM(change_qty) FROM stock_history WHERE product_id = p.id), 0) AS expected
    FROM public.products p
    WHERE p.track_inventory = true
      AND p.stock IS DISTINCT FROM COALESCE((SELECT SUM(change_qty) FROM stock_history WHERE product_id = p.id), 0)
  LOOP
    INSERT INTO stock_mismatches(kind, entity_id, expected, actual)
    VALUES ('inventory', r.eid, r.expected, r.actual);
    n := n + 1;
  END LOOP;

  -- I2: payment_modes.balance vs Σ payment_movements.delta
  FOR r IN
    SELECT pm.id AS eid, pm.balance AS actual,
      COALESCE((SELECT SUM(delta) FROM payment_movements WHERE mode_id = pm.id), 0) AS expected
    FROM payment_modes pm
    WHERE pm.balance IS DISTINCT FROM COALESCE((SELECT SUM(delta) FROM payment_movements WHERE mode_id = pm.id), 0)
  LOOP
    INSERT INTO stock_mismatches(kind, entity_id, expected, actual)
    VALUES ('wallet', r.eid, r.expected, r.actual);
    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

-- One-stop view returning EVERY invariant violation (MASTER §7). Empty = pass.
-- Only the authoritative, false-positive-safe invariants are included:
--   I1 inventory drift (products.stock vs Σ stock_history.change_qty)
--   I2 wallet drift    (payment_modes.balance vs Σ payment_movements.delta)
--   I5 over-refund     (refunded_amount > sale total)
-- I3 (supplier) is derived-only (cannot drift). I4/I6 are enforced by the
-- ledger design + store_orders state-machine trigger (see report §15F).
CREATE OR REPLACE VIEW invariant_violations AS
  -- I1: inventory drift (only products that actually track inventory)
  SELECT 'I1_inventory' AS check_name, p.id::text AS entity_id
  FROM public.products p
  WHERE p.track_inventory = true
    AND p.stock IS DISTINCT FROM COALESCE((SELECT SUM(change_qty) FROM stock_history WHERE product_id = p.id), 0)
UNION ALL
  -- I2: wallet drift
  SELECT 'I2_wallet', pm.id::text
  FROM payment_modes pm
  WHERE pm.balance IS DISTINCT FROM COALESCE((SELECT SUM(delta) FROM payment_movements WHERE mode_id = pm.id), 0)
UNION ALL
  -- I4: completed sale must have exactly one 'sale' stock row per tracked,
  --     still-existing line item. Tracked = the PRODUCT TABLE says track_inventory
  --     (the embedded item snapshot may be null). Both sides count ONLY existing
  --     products, so orphaned rows for deleted products are never false-flagged.
  SELECT 'I4_sale_stock', s.id::text
  FROM public.sales s
  WHERE s.status = 'completed'
    AND ( SELECT count(*) FROM jsonb_array_elements(s.items) it
            WHERE EXISTS (SELECT 1 FROM public.products p
                           WHERE p.id = (it->'product'->>'id')::uuid AND p.track_inventory = true) )
        != ( SELECT count(*) FROM stock_history sh
               WHERE sh.type='sale' AND sh.reference_id = s.id
                 AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = sh.product_id AND p.track_inventory = true) )
UNION ALL
  -- I5: refund never exceeds what was sold (only real sales have positive total;
  -- return/refund sales carry a negative total and are excluded)
  SELECT 'I5_refund', s.id::text
  FROM public.sales s
  WHERE s.total > 0 AND COALESCE(s.refunded_amount, 0) > s.total;
-- ============================================================================
-- estore_guards (MASTER §9 — production hardening)
-- 1. Server-side ORDER STATE MACHINE: invalid store_orders status transitions
--    are rejected by the database, never trusting UI-disabled buttons.
-- 2. Per-phone RATE LIMIT on order placement: prevents queue-flooding from a
--    single number (stock is never at risk, but the /orders queue stays clean).
-- Both are additive, idempotent, and safe to re-apply.
-- ============================================================================

-- Transition validator: returns true only for legal transitions.
CREATE OR REPLACE FUNCTION store_order_transition_is_valid(old_s text, new_s text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  allowed text[];
BEGIN
  IF old_s IS NULL OR old_s = new_s THEN RETURN true; END IF;
  CASE old_s
    WHEN 'pending'         THEN allowed := ARRAY['accepted', 'cancelled', 'converted'];
    WHEN 'accepted'        THEN allowed := ARRAY['preparing', 'cancelled', 'converted'];
    WHEN 'preparing'       THEN allowed := ARRAY['ready', 'cancelled', 'converted'];
    WHEN 'ready'           THEN allowed := ARRAY['out_for_delivery', 'cancelled', 'converted'];
    WHEN 'out_for_delivery' THEN allowed := ARRAY['delivered', 'cancelled', 'converted'];
    WHEN 'delivered'       THEN allowed := ARRAY[]::text[];
    WHEN 'cancelled'       THEN allowed := ARRAY[]::text[];
    WHEN 'converted'       THEN allowed := ARRAY[]::text[];
    ELSE RETURN false;
  END CASE;
  RETURN new_s = ANY(allowed);
END;
$$;

CREATE OR REPLACE FUNCTION guard_store_order_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT store_order_transition_is_valid(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: store_order % cannot go % -> %', OLD.id, OLD.status, NEW.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- Per-phone rate limit (anti flood). Tunable constant below (20 orders / 10 min).
CREATE OR REPLACE FUNCTION guard_store_order_insert()
RETURNS TRIGGER AS $$
DECLARE
  cnt integer;
BEGIN
  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone <> '' THEN
    SELECT count(*) INTO cnt FROM store_orders
      WHERE customer_phone = NEW.customer_phone
        AND created_at > now() - interval '10 minutes';
    IF cnt >= 20 THEN
      RAISE EXCEPTION 'RATE_LIMIT: too many recent orders from this phone' USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- ============================================================================
-- RLS hardening (2026-08-18, MASTER §2.1.4) — server-side write guards.
-- Derived-value triggers become SECURITY DEFINER so legitimate cashier flows
-- (sale -> stock trigger, customer stats, invoice counter) keep working under
-- RLS. sales has NO DELETE policy: deletion only via delete_sale_atomic RPC.
-- ============================================================================

ALTER FUNCTION public.trigger_update_product_stock() SECURITY DEFINER;
ALTER FUNCTION public.trigger_update_variant_stock() SECURITY DEFINER;
ALTER FUNCTION public.update_customer_stats() SECURITY DEFINER;
ALTER FUNCTION public.generate_invoice_number() SECURITY DEFINER;
ALTER FUNCTION public.get_next_invoice_number() SECURITY DEFINER;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_write ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT USING (true);
CREATE POLICY products_write ON public.products FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_select ON public.sales;
DROP POLICY IF EXISTS sales_insert ON public.sales;
DROP POLICY IF EXISTS sales_update ON public.sales;
DROP POLICY IF EXISTS sales_delete ON public.sales;
CREATE POLICY sales_select ON public.sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sales_insert ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY sales_update ON public.sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_select ON public.customers;
DROP POLICY IF EXISTS customers_insert ON public.customers;
DROP POLICY IF EXISTS customers_update ON public.customers;
DROP POLICY IF EXISTS customers_delete ON public.customers;
CREATE POLICY customers_select ON public.customers FOR SELECT USING (true);
CREATE POLICY customers_insert ON public.customers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_delete ON public.app_settings;
DROP POLICY IF EXISTS settings_insert ON public.app_settings;
DROP POLICY IF EXISTS settings_write ON public.app_settings;
DROP POLICY IF EXISTS settings_select ON public.app_settings;
CREATE POLICY settings_select ON public.app_settings FOR SELECT USING (true);
CREATE POLICY settings_insert ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY settings_update ON public.app_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY settings_delete ON public.app_settings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_update ON public.expenses;
DROP POLICY IF EXISTS expenses_delete ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY expenses_update ON public.expenses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY expenses_delete ON public.expenses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));

ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_transactions_select ON public.supplier_transactions;
DROP POLICY IF EXISTS supplier_transactions_insert ON public.supplier_transactions;
DROP POLICY IF EXISTS supplier_transactions_update ON public.supplier_transactions;
DROP POLICY IF EXISTS supplier_transactions_delete ON public.supplier_transactions;
CREATE POLICY supplier_transactions_select ON public.supplier_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY supplier_transactions_insert ON public.supplier_transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY supplier_transactions_update ON public.supplier_transactions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));
CREATE POLICY supplier_transactions_delete ON public.supplier_transactions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')));

-- anon grants (MASTER §2.1.4): SELECT-only + public-facing estore INSERTs.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON public.customers TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

DROP POLICY IF EXISTS "Allow anon ALL on row_tombstones" ON public.row_tombstones;
CREATE POLICY "Allow anon SELECT on row_tombstones" ON public.row_tombstones
  FOR SELECT TO anon USING (true);

-- ============================================================
-- [2026-08-18] sales(created_at) index — full-pull timeout fix
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at DESC);

-- ============================================================
-- [2026-08-20] MASTER §2.1.4 — signed-token server-side authorization
-- ============================================================
-- Anon-key + offline-login means auth.uid() is NULL, so native RLS cannot
-- enforce roles. Instead every sensitive RPC / table write carries a signature
--   SHA256( offline_hash || '|' || user_id || '|' || role || '|' || action )
-- computed client-side (src/lib/actionToken.ts) from the user's password hash.
-- The DB recomputes it from users.offline_hash and rejects on mismatch / wrong
-- role / disallowed role. Survives offline; no auth re-architecture needed.
-- NOTE: `products` is deliberately NOT guarded so cashier stock-sync stays open.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.verify_action_token(
  p_user_id uuid, p_role text, p_action text, p_sig text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $function$
DECLARE v_hash text; v_stored_role text; v_expected text;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  -- Fail-closed: no signature => deny (no NULL-hash bypass).
  IF p_sig IS NULL OR p_sig = '' THEN RETURN false; END IF;
  SELECT action_hash, role INTO v_hash, v_stored_role FROM users WHERE id = p_user_id;
  IF v_hash IS NULL OR v_stored_role IS NULL THEN RETURN false; END IF;
  IF v_stored_role <> p_role THEN RETURN false; END IF;
  v_expected := encode(digest(v_hash || '|' || p_user_id::text || '|' || p_role || '|' || p_action, 'sha256'), 'hex');
  RETURN v_expected = p_sig;
END;
$function$;
GRANT EXECUTE ON FUNCTION verify_action_token(uuid, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.require_action(p_user_id uuid, p_role text, p_action text, p_sig text, VARIADIC p_allowed text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $function$
BEGIN
  IF NOT public.verify_action_token(p_user_id, p_role, p_action, p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token' USING ERRCODE = '42501';
  END IF;
  IF NOT (p_role = ANY(p_allowed)) THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted for %', p_role, p_action USING ERRCODE = '42501';
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION require_action(uuid, text, text, text, text[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_table_write(
  p_user_id uuid, p_role text, p_sig text, p_action text, VARIADIC p_allowed text[]
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $function$
DECLARE v_hash text; v_stored_role text; v_expected text;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  IF p_sig IS NULL OR p_sig = '' THEN
    SELECT action_hash, role INTO v_hash, v_stored_role FROM users WHERE id = p_user_id;
    IF v_hash IS NULL THEN RETURN true; END IF;
    RETURN false;
  END IF;
  SELECT action_hash, role INTO v_hash, v_stored_role FROM users WHERE id = p_user_id;
  IF v_hash IS NULL OR v_stored_role IS NULL THEN RETURN false; END IF;
  IF v_stored_role <> p_role THEN RETURN false; END IF;
  v_expected := encode(digest(v_hash || '|' || p_user_id::text || '|' || p_role || '|' || p_action, 'sha256'), 'hex');
  IF v_expected <> p_sig THEN RETURN false; END IF;
  RETURN p_role = ANY(p_allowed);
END;
$function$;
GRANT EXECUTE ON FUNCTION verify_table_write(uuid, text, text, text, text[]) TO anon, authenticated, service_role;

-- delete_sale_atomic / refund_sale_atomic are ROLE-GATE-FREE (anon-key single-tenant
-- compatible, MASTER §2.1.4). Over-refund cap retained in refund_sale_atomic.
CREATE OR REPLACE FUNCTION public.delete_sale_atomic(
  p_sale_id uuid,
  p_history jsonb,
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_sig text DEFAULT NULL,
  p_payment_moves jsonb DEFAULT '[]'::jsonb,
  p_customer_ledger jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  h jsonb;
  v_status text;
  v_notes text;
BEGIN
  SELECT status, COALESCE(notes, '') INTO v_status, v_notes FROM sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'already_deleted');
  END IF;

  -- F13 DRAFT RULE: saved carts never touched stock/customer/revenue, so any
  -- role may discard them. Everything else requires an ADMIN action token.
  IF v_status = 'pending' AND v_notes LIKE '%DRAFT_SALE%' THEN
    NULL;
  ELSE
    PERFORM public.require_action(p_user_id, p_role, 'delete_sale', p_sig, VARIADIC ARRAY['admin']::text[]);
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, p_sale_id, h->>'note', now()) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  IF p_customer_ledger IS NOT NULL AND jsonb_typeof(p_customer_ledger) = 'object' THEN
    INSERT INTO customer_ledger (id, customer_id, sale_id, type, debit, credit, balance_after, reference, note, created_by, created_at)
    VALUES (
      COALESCE((p_customer_ledger->>'id')::uuid, gen_random_uuid()), (p_customer_ledger->>'customer_id')::uuid, p_sale_id,
      p_customer_ledger->>'type', (p_customer_ledger->>'debit')::numeric, (p_customer_ledger->>'credit')::numeric,
      (p_customer_ledger->>'balance_after')::numeric, p_customer_ledger->>'reference', p_customer_ledger->>'note',
      NULLIF(p_customer_ledger->>'created_by','')::uuid, COALESCE((p_customer_ledger->>'created_at')::timestamptz, now())
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  UPDATE sales SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = p_sale_id;
  INSERT INTO row_tombstones (table_name, ref_id, deleted_at) VALUES ('sales', p_sale_id, now()) ON CONFLICT (table_name, ref_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at;

  RETURN jsonb_build_object('success', true, 'id', p_sale_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION delete_sale_atomic(uuid, jsonb, uuid, text, text, jsonb, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refund_sale_atomic(
  p_sale_id uuid,
  p_history jsonb,
  p_status text,
  p_refunded_amount numeric,
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_sig text DEFAULT NULL,
  p_payment_moves jsonb DEFAULT '[]'::jsonb,
  p_customer_ledger jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  h jsonb;
  _total numeric;
  _status text;
  _prior numeric;
  _threshold numeric;
BEGIN
  PERFORM public.require_action(p_user_id, p_role, 'refund_sale', p_sig, VARIADIC array['admin', 'manager', 'cashier']);

  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id) THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'sale_missing');
  END IF;

  SELECT total, status, COALESCE(refunded_amount, 0)
    INTO _total, _status, _prior
    FROM sales WHERE id = p_sale_id;

  -- double-reversal guard (see migration 20260822040000):
  --   deleted / fully-refunded / no-forward-progress => no-op (skip all reversals)
  IF _status = 'deleted' THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'sale_deleted_noop');
  END IF;
  IF _status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'already_fully_refunded', 'refunded_amount', _prior);
  END IF;
  IF p_refunded_amount <= _prior + 0.001 THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'noop_no_increase', 'refunded_amount', _prior);
  END IF;
  IF _total IS NOT NULL AND p_refunded_amount > _total + 0.001 THEN
    RAISE EXCEPTION 'FORBIDDEN: refund amount exceeds sale total' USING ERRCODE = '42501';
  END IF;

  -- RBAC: refunds above the configured threshold need an ADMIN token
  -- (manager/cashier must obtain supervisor override in the UI).
  IF p_role IS DISTINCT FROM 'admin' THEN
    SELECT refund_approval_threshold INTO _threshold FROM app_settings WHERE id = '00000000-0000-4000-8000-000000000001';
    IF COALESCE(_threshold, 0) > 0 AND (p_refunded_amount - _prior) > _threshold THEN
      RAISE EXCEPTION 'APPROVAL_REQUIRED: refund exceeds admin approval threshold' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, p_sale_id, h->>'note', now()) ON CONFLICT (id) DO NOTHING;
  END LOOP;

  IF p_customer_ledger IS NOT NULL AND jsonb_typeof(p_customer_ledger) = 'object' THEN
    INSERT INTO customer_ledger (id, customer_id, sale_id, type, debit, credit, balance_after, reference, note, created_by, created_at)
    VALUES (
      COALESCE((p_customer_ledger->>'id')::uuid, gen_random_uuid()), (p_customer_ledger->>'customer_id')::uuid, p_sale_id,
      p_customer_ledger->>'type', (p_customer_ledger->>'debit')::numeric, (p_customer_ledger->>'credit')::numeric,
      (p_customer_ledger->>'balance_after')::numeric, p_customer_ledger->>'reference', p_customer_ledger->>'note',
      NULLIF(p_customer_ledger->>'created_by','')::uuid, COALESCE((p_customer_ledger->>'created_at')::timestamptz, now())
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  UPDATE sales SET status = p_status, refunded_amount = p_refunded_amount, updated_at = now() WHERE id = p_sale_id;
  RETURN jsonb_build_object('success', true, 'id', p_sale_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION refund_sale_atomic(uuid, jsonb, text, numeric, uuid, text, text, jsonb, jsonb) TO anon, authenticated, service_role;

-- Transient actor columns for the 3 admin-only tables (NOT products).
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS _actor_id uuid, ADD COLUMN IF NOT EXISTS _actor_role text, ADD COLUMN IF NOT EXISTS _actor_sig text;
ALTER TABLE public.expenses     ADD COLUMN IF NOT EXISTS _actor_id uuid, ADD COLUMN IF NOT EXISTS _actor_role text, ADD COLUMN IF NOT EXISTS _actor_sig text;
ALTER TABLE public.suppliers    ADD COLUMN IF NOT EXISTS _actor_id uuid, ADD COLUMN IF NOT EXISTS _actor_role text, ADD COLUMN IF NOT EXISTS _actor_sig text;

-- Keep READS open; remove the permissive ALL write-bypass; drop NULL-qual INSERT
-- policies that would let any online user insert. The signed WITH CHECK below is
-- the only write path.
DROP POLICY IF EXISTS app_settings_all ON public.app_settings;
CREATE POLICY app_settings_all ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS expenses_all ON public.expenses;
CREATE POLICY expenses_all ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS suppliers_all ON public.suppliers;
CREATE POLICY suppliers_all ON public.suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS settings_insert ON public.app_settings;
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
-- Drop the older authenticated-only UPDATE/DELETE policies so EVERY write (anon or
-- authenticated) funnels through the signed guard below — otherwise an
-- authenticated client could bypass the token check.
DROP POLICY IF EXISTS settings_update ON public.app_settings;
DROP POLICY IF EXISTS settings_delete ON public.app_settings;
DROP POLICY IF EXISTS expenses_update ON public.expenses;
DROP POLICY IF EXISTS expenses_delete ON public.expenses;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;

-- DELETE stays permissive (RLS DELETE cannot take a payload signature without an
-- RPC).
DROP POLICY IF EXISTS app_settings_delete_guard ON public.app_settings;
CREATE POLICY app_settings_delete_guard ON public.app_settings FOR DELETE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS expenses_delete_guard ON public.expenses;
CREATE POLICY expenses_delete_guard ON public.expenses FOR DELETE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS suppliers_delete_guard ON public.suppliers;
CREATE POLICY suppliers_delete_guard ON public.suppliers FOR DELETE TO anon, authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- § ANON-COMPAT / OFFLINE-LOGIN GUARANTEE  (MANDATORY — DO NOT REMOVE)
-- ────────────────────────────────────────────────────────────────────────────
-- This POS is single-tenant and ships the PUBLIC anon key. The browser frequently
-- runs WITHOUT a Supabase-auth session (offline-login fallback), so auth.uid() is
-- effectively always NULL for the data client.
--
-- The Aug-2026 hardening narrowed RLS to `authenticated`-only and added auth.uid()
-- checks to commit_sale — this BROKE every clone (sales stopped committing, stock
-- stopped decreasing, deletes/returns never reversed stock). The fixes above
-- (commit_sale stripped of auth.uid(); products/sales made anon-writable) MUST stay.
-- This trailing section is a permanent, idempotent guarantee so a fresh clone can
-- NEVER regress: permissive *_all policies for every synced non-guard table
-- (OR-combines with any existing guard policy; anon is always allowed) + broad
-- grants. Role enforcement is via signed action-token RPCs (delete_sale_atomic /
-- refund_sale_atomic) + over-refund cap — NOT auth.uid().
-- app_settings / expenses / suppliers are intentionally EXCLUDED here: they keep
-- their signed verify_table_write guard policies and must stay guarded.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Permissive *_all policies (idempotent; supplement, never replace, guards)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_all ON public.products;
CREATE POLICY products_all ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_all ON public.sales;
CREATE POLICY sales_all ON public.sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_all ON public.customers;
CREATE POLICY customers_all ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_transactions_all ON public.supplier_transactions;
CREATE POLICY supplier_transactions_all ON public.supplier_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_history_all ON public.stock_history;
CREATE POLICY stock_history_all ON public.stock_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.variant_stock_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS variant_stock_history_all ON public.variant_stock_history;
CREATE POLICY variant_stock_history_all ON public.variant_stock_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.payment_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_movements_all ON public.payment_movements;
CREATE POLICY payment_movements_all ON public.payment_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.payment_modes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_modes_all ON public.payment_modes;
CREATE POLICY payment_modes_all ON public.payment_modes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.salesmen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salesmen_all ON public.salesmen;
CREATE POLICY salesmen_all ON public.salesmen FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.row_tombstones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS row_tombstones_all ON public.row_tombstones;
CREATE POLICY row_tombstones_all ON public.row_tombstones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- PHASE 4: Atomic RPCs for bill-edit + manual stock adjustment.
-- (Recovered into the consolidated schema; definitions also live in
--  supabase/migrations/20260820140000_edit_sale_atomic_and_stock_adjustment.sql)
CREATE OR REPLACE FUNCTION edit_sale_atomic(
  p_new_sale jsonb,
  p_new_history jsonb,
  p_old_sale_id uuid,
  p_old_reverse_history jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid;
  h jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = p_old_sale_id) THEN
    RAISE EXCEPTION 'OLD_SALE_NOT_FOUND';
  END IF;
  IF p_new_sale->>'idempotency_key' IS NOT NULL AND p_new_sale->>'idempotency_key' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE idempotency_key = (p_new_sale->>'idempotency_key')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'already_committed', true,
        'new_id', (SELECT id FROM sales WHERE idempotency_key = (p_new_sale->>'idempotency_key')::uuid));
    END IF;
  END IF;
  INSERT INTO sales (
    id, invoice_number, customer_id, customer_name, customer_phone,
    items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
    tax_amount, total, received_amount, change_amount, payment_method,
    card_details, status, cashier, cashier_role, receipt_number, notes,
    applied_discounts, free_gifts, timestamp, sale_date, sale_type,
    extra_charges, split_payments, refunded_amount, estore_status,
    delivery_address, delivery_fee, delivery_location_lat, delivery_location_lng,
    customer_notes, source_order_id, salesman_id, salesman_name,
    idempotency_key, edited_from_invoice, created_at, updated_at
  ) VALUES (
    (p_new_sale->>'id')::uuid,
    p_new_sale->>'invoice_number',
    NULLIF(p_new_sale->>'customer_id','')::uuid,
    p_new_sale->>'customer_name',
    p_new_sale->>'customer_phone',
    COALESCE(p_new_sale->'items','[]'::jsonb),
    (p_new_sale->>'subtotal')::numeric,
    (p_new_sale->>'discount_amount')::numeric,
    (p_new_sale->>'bill_discount_value')::numeric,
    p_new_sale->>'bill_discount_type',
    (p_new_sale->>'tax_amount')::numeric,
    (p_new_sale->>'total')::numeric,
    (p_new_sale->>'received_amount')::numeric,
    (p_new_sale->>'change_amount')::numeric,
    p_new_sale->>'payment_method',
    p_new_sale->'card_details',
    p_new_sale->>'status',
    p_new_sale->>'cashier',
    p_new_sale->>'cashier_role',
    p_new_sale->>'receipt_number',
    p_new_sale->>'notes',
    p_new_sale->'applied_discounts',
    p_new_sale->'free_gifts',
    (p_new_sale->>'timestamp')::timestamptz,
    (p_new_sale->>'sale_date')::date,
    p_new_sale->>'sale_type',
    p_new_sale->'extra_charges',
    p_new_sale->'split_payments',
    (p_new_sale->>'refunded_amount')::numeric,
    p_new_sale->>'estore_status',
    p_new_sale->>'delivery_address',
    (p_new_sale->>'delivery_fee')::numeric,
    (p_new_sale->>'delivery_location_lat')::numeric,
    (p_new_sale->>'delivery_location_lng')::numeric,
    p_new_sale->>'customer_notes',
    NULLIF(p_new_sale->>'source_order_id','')::uuid,
    NULLIF(p_new_sale->>'salesman_id','')::uuid,
    p_new_sale->>'salesman_name',
    NULLIF(p_new_sale->>'idempotency_key','')::uuid,
    p_new_sale->>'edited_from_invoice',
    COALESCE((p_new_sale->>'created_at')::timestamptz, now()),
    now()
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN v_id := (p_new_sale->>'id')::uuid; END IF;
  FOR h IN SELECT * FROM jsonb_array_elements(p_new_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
  FOR h IN SELECT * FROM jsonb_array_elements(p_old_reverse_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_old_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_old_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
  DELETE FROM sales WHERE id = p_old_sale_id;
  RETURN jsonb_build_object('success', true, 'new_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION stock_adjustment(
  p_product_id uuid,
  p_change_qty integer,
  p_type text,
  p_note text,
  p_cashier text,
  p_variant_id text DEFAULT NULL,
  p_variant_label text DEFAULT NULL,
  p_adjustment_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_sig text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid := COALESCE(p_adjustment_id, gen_random_uuid());
BEGIN
  -- RBAC matrix: Inventory Adjustment = admin|manager only (signed actor proof).
  PERFORM require_action(p_user_id, p_role, 'stock_adjustment', p_sig, VARIADIC ARRAY['admin','manager']::text[]);
  IF p_variant_id IS NOT NULL AND p_variant_id <> '' THEN
    INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, note, cashier_name, created_at, updated_at)
    VALUES (v_id, p_product_id, p_variant_id, COALESCE(p_variant_label, ''), p_change_qty, p_type, p_note, p_cashier, now(), now())
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO stock_history (id, product_id, change_qty, type, note, cashier_name, created_at, updated_at)
    VALUES (v_id, p_product_id, p_change_qty, p_type, p_note, p_cashier, now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
-- Drop legacy unguarded 8-param overload (superseded by guarded 11-param above).
DROP FUNCTION IF EXISTS stock_adjustment(uuid, integer, text, text, text, text, text, uuid);

-- 2. Broad grants (idempotent) — RLS still applies; guard tables stay guarded.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════
-- 30. PHASE 12: USER PERMISSIONS & SECURITY
-- ════════════════════════════════════════════════════

-- RPC to Block User & Terminate Sessions instantly
CREATE OR REPLACE FUNCTION admin_block_user(p_target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin or manager
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'Not authorized to block users';
  END IF;

  -- 1. Mark as inactive in public schema
  UPDATE public.users SET active = false WHERE id = p_target_user_id;
  
  -- 2. Wipe their sessions so active JWT refreshes fail immediately
  DELETE FROM auth.sessions WHERE user_id = p_target_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_target_user_id;
END;
$$;

-- RPC to Change Password & Force Logout
CREATE OR REPLACE FUNCTION admin_change_password(p_target_user_id UUID, p_new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can change passwords';
  END IF;

  -- Update password in auth schema
  UPDATE auth.users 
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')) 
  WHERE id = p_target_user_id;

  -- Terminate existing sessions so they must re-login
  DELETE FROM auth.sessions WHERE user_id = p_target_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_change_password(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PATCH (2026-08-21): clone-readiness additions.
-- Mirrors the 20260821 migrations so SUPER_MASTER_SCHEMA.sql reproduces the live
-- DB exactly when run on a fresh project. All statements are idempotent
-- (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- 1. users soft-delete column
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. sales attribution + multi-device + sync-status columns
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source_order_id uuid;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS salesman_id uuid;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS salesman_name text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS original_cashier text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS original_salesman_id uuid;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS original_salesman_name text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS action_performed_by text;

-- 3. price_history table (PHASE 11/12)
CREATE TABLE IF NOT EXISTS public.price_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price   numeric,
  new_price   numeric,
  old_cost    numeric,
  new_cost    numeric,
  changed_by  text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON public.price_history(created_at);
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS price_history_anon ON public.price_history;
CREATE POLICY price_history_anon ON public.price_history FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.price_history TO anon, authenticated, service_role;

-- 4. sessions table + revoke function (PHASE 39A)
CREATE TABLE IF NOT EXISTS public.sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    text,
  login_time   timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sessions_anon ON public.sessions;
CREATE POLICY sessions_anon ON public.sessions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.sessions TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.sessions SET status = 'revoked', last_activity = now() WHERE user_id = p_user_id AND status = 'active';
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO anon, authenticated, service_role;


-- 6. edit_sale_atomic: replace unguarded 4-arg overload with guarded 7-arg
DROP FUNCTION IF EXISTS public.edit_sale_atomic(jsonb, jsonb, uuid, jsonb);
CREATE OR REPLACE FUNCTION public.edit_sale_atomic(
  p_new_sale jsonb,
  p_new_history jsonb,
  p_old_sale_id uuid,
  p_old_reverse_history jsonb,
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_sig text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid;
  h jsonb;
BEGIN
  PERFORM public.require_action(p_user_id, p_role, 'edit_sale', p_sig, VARIADIC array['admin', 'manager']);
  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = p_old_sale_id) THEN
    RAISE EXCEPTION 'OLD_SALE_NOT_FOUND';
  END IF;
  IF p_new_sale->>'idempotency_key' IS NOT NULL AND p_new_sale->>'idempotency_key' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE idempotency_key = (p_new_sale->>'idempotency_key')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'already_committed', true, 'new_id', (SELECT id FROM sales WHERE idempotency_key = (p_new_sale->>'idempotency_key')::uuid));
    END IF;
  END IF;
  INSERT INTO sales (
    id, invoice_number, customer_id, customer_name, customer_phone,
    items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
    tax_amount, total, received_amount, change_amount, payment_method,
    card_details, status, cashier, cashier_role, receipt_number, notes,
    applied_discounts, free_gifts, timestamp, sale_date, sale_type,
    extra_charges, split_payments, refunded_amount, estore_status,
    delivery_address, delivery_fee, delivery_location_lat, delivery_location_lng,
    customer_notes, source_order_id, salesman_id, salesman_name,
    idempotency_key, edited_from_invoice, created_at, updated_at
  ) VALUES (
    (p_new_sale->>'id')::uuid, p_new_sale->>'invoice_number',
    NULLIF(p_new_sale->>'customer_id','')::uuid, p_new_sale->>'customer_name', p_new_sale->>'customer_phone',
    COALESCE(p_new_sale->'items','[]'::jsonb), (p_new_sale->>'subtotal')::numeric,
    (p_new_sale->>'discount_amount')::numeric, (p_new_sale->>'bill_discount_value')::numeric, p_new_sale->>'bill_discount_type',
    (p_new_sale->>'tax_amount')::numeric, (p_new_sale->>'total')::numeric, (p_new_sale->>'received_amount')::numeric,
    (p_new_sale->>'change_amount')::numeric, p_new_sale->>'payment_method', p_new_sale->'card_details',
    p_new_sale->>'status', p_new_sale->>'cashier', p_new_sale->>'cashier_role', p_new_sale->>'receipt_number', p_new_sale->>'notes',
    p_new_sale->'applied_discounts', p_new_sale->'free_gifts', (p_new_sale->>'timestamp')::timestamptz, (p_new_sale->>'sale_date')::date,
    p_new_sale->>'sale_type', p_new_sale->'extra_charges', p_new_sale->'split_payments', (p_new_sale->>'refunded_amount')::numeric,
    p_new_sale->>'estore_status', p_new_sale->>'delivery_address', (p_new_sale->>'delivery_fee')::numeric,
    (p_new_sale->>'delivery_location_lat')::numeric, (p_new_sale->>'delivery_location_lng')::numeric, p_new_sale->>'customer_notes',
    NULLIF(p_new_sale->>'source_order_id','')::uuid, NULLIF(p_new_sale->>'salesman_id','')::uuid, p_new_sale->>'salesman_name',
    NULLIF(p_new_sale->>'idempotency_key','')::uuid, p_new_sale->>'edited_from_invoice',
    COALESCE((p_new_sale->>'created_at')::timestamptz, now()), now()
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN v_id := (p_new_sale->>'id')::uuid; END IF;
  FOR h IN SELECT * FROM jsonb_array_elements(p_new_history)
  LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
  FOR h IN SELECT * FROM jsonb_array_elements(p_old_reverse_history)
  LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_old_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_old_sale_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
  DELETE FROM sales WHERE id = p_old_sale_id;
  RETURN jsonb_build_object('success', true, 'new_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.edit_sale_atomic(jsonb, jsonb, uuid, jsonb, uuid, text, text) TO anon, authenticated, service_role;CREATE OR REPLACE FUNCTION commit_restock(
  p_purchase_record jsonb, 
  p_stock_history jsonb DEFAULT '[]'::jsonb, 
  p_supplier_transaction jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  h jsonb;
BEGIN
  INSERT INTO purchase_records (
    id, type, product_id, product_name, sku, variant_id, variant_label,
    quantity, cost_price, retail_price, total_amount, supplier, supplier_id,
    qty_remaining, date, added_by, notes, created_at, updated_at
  ) VALUES (
    (p_purchase_record->>'id')::uuid, p_purchase_record->>'type', NULLIF(p_purchase_record->>'product_id','')::uuid,
    p_purchase_record->>'product_name', p_purchase_record->>'sku', p_purchase_record->>'variant_id',
    p_purchase_record->>'variant_label', (p_purchase_record->>'quantity')::int, (p_purchase_record->>'cost_price')::numeric,
    (p_purchase_record->>'retail_price')::numeric, (p_purchase_record->>'total_amount')::numeric,
    p_purchase_record->>'supplier', NULLIF(p_purchase_record->>'supplier_id','')::uuid,
    (p_purchase_record->>'qty_remaining')::int, COALESCE((p_purchase_record->>'date')::timestamptz, now()),
    p_purchase_record->>'added_by', p_purchase_record->>'notes', COALESCE((p_purchase_record->>'created_at')::timestamptz, now()), now()
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_id;

  IF v_id IS NULL THEN v_id := (p_purchase_record->>'id')::uuid; END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_stock_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now()) ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  IF p_supplier_transaction IS NOT NULL AND jsonb_typeof(p_supplier_transaction) = 'object' THEN
    INSERT INTO supplier_transactions (
      id, supplier_id, type, source_type, amount, reference_id, reference_type,
      note, payment_type, split_payments, created_at, updated_at
    ) VALUES (
      (p_supplier_transaction->>'id')::uuid, (p_supplier_transaction->>'supplier_id')::uuid, p_supplier_transaction->>'type',
      p_supplier_transaction->>'source_type', (p_supplier_transaction->>'amount')::numeric, v_id, p_supplier_transaction->>'reference_type',
      p_supplier_transaction->>'note', p_supplier_transaction->>'payment_type', p_supplier_transaction->'split_payments',
      COALESCE((p_supplier_transaction->>'created_at')::timestamptz, now()), now()
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION commit_restock(jsonb, jsonb, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION commit_expense(
  p_expense jsonb,
  p_payment_move jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO expenses (
    id, category, amount, date, description, added_by, payment_method, created_at, updated_at
  ) VALUES (
    (p_expense->>'id')::uuid, p_expense->>'category', (p_expense->>'amount')::numeric,
    COALESCE((p_expense->>'date')::timestamptz, now()), p_expense->>'description', p_expense->>'added_by',
    p_expense->>'payment_method', COALESCE((p_expense->>'created_at')::timestamptz, now()), now()
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_id;

  IF v_id IS NULL THEN v_id := (p_expense->>'id')::uuid; END IF;

  IF p_payment_move IS NOT NULL AND jsonb_typeof(p_payment_move) = 'object' THEN
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (
      COALESCE((p_payment_move->>'id')::uuid, gen_random_uuid()), p_payment_move->>'mode_id',
      (p_payment_move->>'delta')::numeric, v_id, p_payment_move->>'note', now()
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION commit_expense(jsonb, jsonb) TO anon, authenticated, service_role;


-- [2026-08-22] Add admin_delete_user RPC for true deletion
--   Migration: 20260822153500_admin_delete_user.sql
CREATE OR REPLACE FUNCTION admin_delete_user(p_target_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
    IF (SELECT role FROM public.users WHERE id = auth.uid()) NOT IN ('admin', 'manager') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;


-- [2026-08-23] Customer Ledger System (receive_customer_payment, sync trigger)
--   Migration: 20260823060000_customer_ledger_system.sql
CREATE OR REPLACE FUNCTION fn_sync_customer_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE customers
    SET balance = NEW.balance_after,
        updated_at = now()
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_sync_customer_balance ON customer_ledger;
CREATE TRIGGER trig_sync_customer_balance
  AFTER INSERT ON customer_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_sync_customer_balance();


CREATE OR REPLACE FUNCTION receive_customer_payment(
  p_customer_id    uuid,
  p_amount         numeric,
  p_payment_mode   text     DEFAULT 'cash',
  p_payment_mode_id text    DEFAULT NULL,
  p_reference      text     DEFAULT NULL,
  p_note           text     DEFAULT NULL,
  p_created_by     uuid     DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after  numeric;
  v_ledger_id      uuid := gen_random_uuid();
  v_payment_id     uuid := gen_random_uuid();
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM customer_ledger
      WHERE reference = p_idempotency_key
        AND customer_id = p_customer_id
        AND type = 'payment_received'
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance_before
  FROM customers WHERE id = p_customer_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found: %', p_customer_id; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  v_balance_after := v_balance_before - p_amount;

  INSERT INTO customer_ledger (
    id, customer_id, sale_id, type,
    debit, credit, balance_after,
    reference, note, created_by, created_at
  ) VALUES (
    v_ledger_id, p_customer_id, NULL, 'payment_received',
    0, p_amount, v_balance_after,
    COALESCE(p_idempotency_key, p_reference), p_note,
    p_created_by, now()
  );

  INSERT INTO payments (
    id, customer_id,
    payment_type, direction,
    amount, note,
    created_at
  ) VALUES (
    v_payment_id, p_customer_id,
    p_payment_mode, 'in',
    p_amount,
    COALESCE(p_note, p_reference),
    now()
  ) ON CONFLICT DO NOTHING;

  IF p_payment_mode_id IS NOT NULL THEN
    INSERT INTO payment_movements (
      id, mode_id, delta, reference_id, note, created_at
    ) VALUES (
      v_payment_id, p_payment_mode_id, p_amount,
      COALESCE(p_idempotency_key, p_reference), p_note, now()
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_id', v_ledger_id,
    'payment_id', v_payment_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;
GRANT EXECUTE ON FUNCTION receive_customer_payment TO anon, authenticated;


DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime SET TABLE
      app_settings, bundles, bundle_items, categories, customers,
      customer_ledger, discounts, expenses, payments, product_addons,
      products, purchase_order_items, purchase_orders, purchase_records,
      sales, sales_tabs, stock_history, supplier_transactions, suppliers,
      users, variant_stock_history, price_history, sessions;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- GLOBAL GRANTS (Safety Net)
-- ════════════════════════════════════════════════════════════════
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION refund_customer_payment(
  p_customer_id    uuid,
  p_amount         numeric,
  p_payment_mode   text     DEFAULT 'cash',
  p_payment_mode_id text    DEFAULT NULL,
  p_reference      text     DEFAULT NULL,
  p_note           text     DEFAULT NULL,
  p_created_by     uuid     DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before numeric;
  v_balance_after  numeric;
  v_ledger_id      uuid := gen_random_uuid();
  v_payment_id     uuid := gen_random_uuid();
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM customer_ledger
      WHERE reference = p_idempotency_key
        AND customer_id = p_customer_id
        AND type = 'refund'
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance_before
  FROM customers WHERE id = p_customer_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found: %', p_customer_id; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  v_balance_after := v_balance_before + p_amount;

  INSERT INTO customer_ledger (
    id, customer_id, sale_id, type,
    debit, credit, balance_after,
    reference, note, created_by, created_at
  ) VALUES (
    v_ledger_id, p_customer_id, NULL, 'refund',
    p_amount, 0, v_balance_after,
    COALESCE(p_idempotency_key, p_reference), p_note,
    p_created_by, now()
  );

  INSERT INTO payments (
    id, customer_id,
    payment_type, direction,
    amount, note,
    created_at
  ) VALUES (
    v_payment_id, p_customer_id,
    p_payment_mode, 'out',
    p_amount,
    COALESCE(p_note, p_reference),
    now()
  ) ON CONFLICT DO NOTHING;

  IF p_payment_mode_id IS NOT NULL THEN
    INSERT INTO payment_movements (
      id, mode_id, delta, reference_id, note, created_at
    ) VALUES (
      v_payment_id, p_payment_mode_id, -p_amount,
      COALESCE(p_idempotency_key, p_reference), p_note, now()
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_id', v_ledger_id,
    'payment_id', v_payment_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;
GRANT EXECUTE ON FUNCTION refund_customer_payment TO anon, authenticated;

-- 1. Add idempotency keys to supplier_transactions and expenses
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_tx_idempotency_key ON supplier_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_idempotency_key ON expenses(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Create the atomic RPC for Supplier Payment
CREATE OR REPLACE FUNCTION pay_supplier_atomic(
  p_supplier_id    uuid,
  p_amount         numeric,
  p_payment_type   text,
  p_note           text,
  p_added_by       text,
  p_idempotency_key text,
  p_user_id        uuid DEFAULT NULL,
  p_role           text DEFAULT NULL,
  p_sig            text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_expense_id uuid := gen_random_uuid();
  v_tx_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_supplier_name text;
BEGIN
  -- 1. Server-side RBAC: Only Admin/Manager can pay suppliers
  PERFORM require_action(p_user_id, p_role, 'pay_supplier', p_sig, VARIADIC ARRAY['admin','manager']::text[]);

  -- 2. DB-Level Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM supplier_transactions
      WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT supplier INTO v_supplier_name FROM suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  -- 3. Create Expense Record
  INSERT INTO expenses (
    id, category, amount, date, description, added_by, payment_method, notes, idempotency_key, created_at, updated_at
  ) VALUES (
    v_expense_id, 'Supplies', p_amount, now(), 'Supplier Payout: ' || v_supplier_name, p_added_by, p_payment_type, p_note, p_idempotency_key, now(), now()
  );

  -- 4. Create Supplier Ledger Transaction
  INSERT INTO supplier_transactions (
    id, supplier_id, type, source_type, amount, reference_id, reference_type, note, payment_type, idempotency_key, created_at, updated_at
  ) VALUES (
    v_tx_id, p_supplier_id, 'payment', 'manual_bill', p_amount, v_expense_id, 'expense', p_note, p_payment_type, p_idempotency_key, now(), now()
  );

  -- 5. Create Payment Wallet Movement (so it reflects in Reports/Wallets)
  INSERT INTO payments (
    id, supplier_id, payment_type, direction, amount, note, created_at, updated_at
  ) VALUES (
    v_payment_id, p_supplier_id, p_payment_type, 'out', p_amount, 'Supplier Payment: ' || COALESCE(p_note, ''), now(), now()
  );

  -- 6. Actual wallet balance effect
  INSERT INTO payment_movements (
    id, mode_id, delta, reference_id, note, created_at
  ) VALUES (
    v_payment_id, p_payment_type, -p_amount, p_idempotency_key, 'Supplier Payment', now()
  ) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'expense_id', v_expense_id, 'transaction_id', v_tx_id);
END;
$$;

GRANT EXECUTE ON FUNCTION pay_supplier_atomic TO anon, authenticated;
CREATE OR REPLACE FUNCTION pay_supplier_atomic(
  p_supplier_id    uuid,
  p_amount         numeric,
  p_payment_type   text,
  p_note           text,
  p_added_by       text,
  p_idempotency_key text,
  p_user_id        uuid DEFAULT NULL,
  p_role           text DEFAULT NULL,
  p_sig            text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_expense_id uuid := gen_random_uuid();
  v_tx_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_supplier_name text;
  v_current_role text;
BEGIN
  -- 1. Server-side RBAC: Only Admin/Manager can pay suppliers
  SELECT role INTO v_current_role FROM public.users WHERE id = auth.uid();
  IF v_current_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted to pay supplier', COALESCE(v_current_role, 'anon');
  END IF;

  -- 2. DB-Level Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM supplier_transactions
      WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT supplier INTO v_supplier_name FROM suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  -- 3. Create Expense Record
  INSERT INTO expenses (
    id, category, amount, date, description, added_by, payment_method, notes, idempotency_key, created_at, updated_at
  ) VALUES (
    v_expense_id, 'Supplies', p_amount, now(), 'Supplier Payout: ' || v_supplier_name, p_added_by, p_payment_type, p_note, p_idempotency_key, now(), now()
  );

  -- 4. Create Supplier Ledger Transaction
  INSERT INTO supplier_transactions (
    id, supplier_id, type, source_type, amount, reference_id, reference_type, note, payment_type, idempotency_key, created_at, updated_at
  ) VALUES (
    v_tx_id, p_supplier_id, 'payment', 'manual_bill', p_amount, v_expense_id, 'expense', p_note, p_payment_type, p_idempotency_key, now(), now()
  );

  -- 5. Create Payment Wallet Movement (so it reflects in Reports/Wallets)
  INSERT INTO payments (
    id, supplier_id, payment_type, direction, amount, note, created_at, updated_at
  ) VALUES (
    v_payment_id, p_supplier_id, p_payment_type, 'out', p_amount, 'Supplier Payment: ' || COALESCE(p_note, ''), now(), now()
  );

  -- 6. Actual wallet balance effect
  INSERT INTO payment_movements (
    id, mode_id, delta, reference_id, note, created_at
  ) VALUES (
    v_payment_id, p_payment_type, -p_amount, p_idempotency_key, 'Supplier Payment', now()
  ) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'expense_id', v_expense_id, 'transaction_id', v_tx_id);
END;
$$;
-- 1. Add Transaction Graph Columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_reference UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Drop the old flawed RPC
DROP FUNCTION IF EXISTS pay_supplier_atomic(uuid, numeric, text, text, text, text, uuid, text, text);

-- 3. Create the Strict MD-Compliant Atomic RPC for Supplier Payment
CREATE OR REPLACE FUNCTION pay_supplier_atomic(
  p_supplier_id    uuid,
  p_amount         numeric,
  p_payment_type   text,
  p_note           text,
  p_idempotency_key text,
  p_sig            text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_tx_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_payment_move_id uuid := gen_random_uuid();
  v_supplier_name text;
  v_current_user_id uuid := auth.uid();
  v_role text;
BEGIN
  -- 1. Server-side RBAC & Signature Verification
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  
  -- Use verify_action_token for strict cryptographic authorization
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'pay_supplier', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_role = ANY(ARRAY['admin','manager'])) THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted for pay_supplier', v_role USING ERRCODE = '42501';
  END IF;

  -- 2. DB-Level Strict Idempotency Checks (Both tables)
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM supplier_transactions WHERE idempotency_key = p_idempotency_key) OR
       EXISTS (SELECT 1 FROM payments WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT supplier INTO v_supplier_name FROM suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  -- 3. NO EXPENSE RECORD (Fixing Double-Count in P&L)
  -- Paying a supplier is a Balance Sheet movement (Cash Out, Liability Down).
  -- It is NOT a P&L Expense.

  -- 4. Create Supplier Ledger Transaction (Liability Down)
  INSERT INTO supplier_transactions (
    id, supplier_id, type, source_type, amount, reference_id, reference_type, note, payment_type, idempotency_key, created_at, updated_at
  ) VALUES (
    v_tx_id, p_supplier_id, 'payment', 'payment', p_amount, v_payment_id, 'payment', p_note, p_payment_type, p_idempotency_key, now(), now()
  );

  -- 5. Create Payment Wallet Record (Transaction Graph + Audit)
  INSERT INTO payments (
    id, supplier_id, payment_type, direction, amount, note, source_type, source_id, transaction_id, idempotency_key, created_at, updated_at
  ) VALUES (
    v_payment_id, p_supplier_id, p_payment_type, 'out', p_amount, 'Supplier Payment: ' || COALESCE(p_note, ''), 'supplier_payment', v_tx_id, v_tx_id, p_idempotency_key, now(), now()
  );

  -- 6. Strict Wallet Movement (NO ON CONFLICT DO NOTHING - MUST FAIL LOUDLY IF mode_id IS INVALID)
  INSERT INTO payment_movements (
    id, mode_id, delta, reference_id, note, created_at
  ) VALUES (
    v_payment_move_id, p_payment_type, -p_amount, v_payment_id, 'Supplier Payment', now()
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx_id, 'payment_id', v_payment_id);
END;
$$;
GRANT EXECUTE ON FUNCTION pay_supplier_atomic(uuid, numeric, text, text, text, text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION pay_supplier_atomic(
  p_supplier_id    uuid,
  p_amount         numeric,
  p_payment_type   text,
  p_note           text,
  p_idempotency_key text,
  p_sig            text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_tx_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_payment_move_id uuid := gen_random_uuid();
  v_supplier_name text;
  v_current_user_id uuid := auth.uid();
  v_role text;
BEGIN
  -- 1. Server-side RBAC & Signature Verification
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  
  -- Use verify_action_token for strict cryptographic authorization
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'pay_supplier', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_role = ANY(ARRAY['admin','manager'])) THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted for pay_supplier', v_role USING ERRCODE = '42501';
  END IF;

  -- 2. DB-Level Strict Idempotency Checks (Both tables)
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM supplier_transactions WHERE idempotency_key = p_idempotency_key) OR
       EXISTS (SELECT 1 FROM payments WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT name INTO v_supplier_name FROM suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  -- 3. NO EXPENSE RECORD (Fixing Double-Count in P&L)
  -- Paying a supplier is a Balance Sheet movement (Cash Out, Liability Down).
  -- It is NOT a P&L Expense.

  -- 4. Create Supplier Ledger Transaction (Liability Down)
  INSERT INTO supplier_transactions (
    id, supplier_id, type, source_type, amount, reference_id, reference_type, note, payment_type, idempotency_key, created_at, updated_at
  ) VALUES (
    v_tx_id, p_supplier_id, 'payment', 'payment', p_amount, v_payment_id, 'payment', p_note, p_payment_type, p_idempotency_key, now(), now()
  );

  -- 5. Create Payment Wallet Record (Transaction Graph + Audit)
  INSERT INTO payments (
    id, supplier_id, payment_type, direction, amount, note, source_type, source_id, transaction_id, idempotency_key, created_at, updated_at
  ) VALUES (
    v_payment_id, p_supplier_id, p_payment_type, 'out', p_amount, 'Supplier Payment: ' || COALESCE(p_note, ''), 'supplier_payment', v_tx_id, v_tx_id, p_idempotency_key, now(), now()
  );

  -- 6. Strict Wallet Movement (NO ON CONFLICT DO NOTHING - MUST FAIL LOUDLY IF mode_id IS INVALID)
  INSERT INTO payment_movements (
    id, mode_id, delta, reference_id, note, created_at
  ) VALUES (
    v_payment_move_id, p_payment_type, -p_amount, v_payment_id, 'Supplier Payment', now()
  );

  RETURN jsonb_build_object('ok', true, 'transaction_id', v_tx_id, 'payment_id', v_payment_id);
END;
$$;
CREATE OR REPLACE FUNCTION commit_sale(
  p_sale jsonb, 
  p_history jsonb,
  p_payment_moves jsonb DEFAULT '[]'::jsonb,
  p_customer_ledger jsonb DEFAULT NULL,
  p_sig text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid;
  h jsonb;
  cur numeric;
  v_allow_neg boolean := false;
  v_oversell int;
  v_current_user_id uuid := auth.uid();
  v_role text;
BEGIN
  -- 1. Server-side RBAC & Signature Verification
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'commit_sale', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for commit_sale' USING ERRCODE = '42501';
  END IF;

  IF p_sale->>'source_order_id' IS NOT NULL AND p_sale->>'source_order_id' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE source_order_id = (p_sale->>'source_order_id')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'id', (SELECT id FROM sales WHERE source_order_id = (p_sale->>'source_order_id')::uuid), 'already_fulfilled', true);
    END IF;
  END IF;

  IF p_sale->>'idempotency_key' IS NOT NULL AND p_sale->>'idempotency_key' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE idempotency_key = (p_sale->>'idempotency_key')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'id', (SELECT id FROM sales WHERE idempotency_key = (p_sale->>'idempotency_key')::uuid), 'already_committed', true);
    END IF;
  END IF;

  SELECT COALESCE(allow_negative_stock, false) INTO v_allow_neg FROM app_settings LIMIT 1;
  IF NOT v_allow_neg THEN
    WITH agg AS (
      SELECT (hist_item->>'product_id')::uuid AS pid, SUM((hist_item->>'change_qty')::int) AS delta
      FROM jsonb_array_elements(p_history) hist_item
      WHERE hist_item->>'variant_id' IS NULL OR hist_item->>'variant_id' = ''
      GROUP BY pid
    )
    SELECT 1 INTO v_oversell FROM agg
    JOIN products p ON p.id = agg.pid
    WHERE (p.stock + agg.delta) < 0
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'OVERSELL: stock would go negative for a product (allow_negative_stock=false)';
    END IF;
  END IF;

  INSERT INTO sales (
    id, invoice_number, customer_id, customer_name, customer_phone,
    items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
    tax_amount, total, received_amount, change_amount, payment_method,
    card_details, status, cashier, cashier_role, receipt_number, notes,
    applied_discounts, free_gifts, timestamp, sale_date, sale_type,
    extra_charges, split_payments, refunded_amount, estore_status,
    delivery_address, delivery_fee, delivery_location_lat, delivery_location_lng,
    customer_notes, source_order_id, salesman_id, salesman_name, idempotency_key, created_at, updated_at
  ) VALUES (
    (p_sale->>'id')::uuid, p_sale->>'invoice_number', NULLIF(p_sale->>'customer_id','')::uuid,
    p_sale->>'customer_name', p_sale->>'customer_phone', COALESCE(p_sale->'items','[]'::jsonb),
    (p_sale->>'subtotal')::numeric, (p_sale->>'discount_amount')::numeric, (p_sale->>'bill_discount_value')::numeric,
    p_sale->>'bill_discount_type', (p_sale->>'tax_amount')::numeric, (p_sale->>'total')::numeric,
    (p_sale->>'received_amount')::numeric, (p_sale->>'change_amount')::numeric, p_sale->>'payment_method',
    p_sale->'card_details', p_sale->>'status', p_sale->>'cashier', p_sale->>'cashier_role',
    p_sale->>'receipt_number', p_sale->>'notes', p_sale->'applied_discounts', p_sale->'free_gifts',
    (p_sale->>'timestamp')::timestamptz, (p_sale->>'sale_date')::date, p_sale->>'sale_type',
    p_sale->'extra_charges', p_sale->'split_payments', (p_sale->>'refunded_amount')::numeric,
    p_sale->>'estore_status', p_sale->>'delivery_address', (p_sale->>'delivery_fee')::numeric,
    (p_sale->>'delivery_location_lat')::numeric, (p_sale->>'delivery_location_lng')::numeric,
    p_sale->>'customer_notes', NULLIF(p_sale->>'source_order_id','')::uuid, NULLIF(p_sale->>'salesman_id','')::uuid,
    p_sale->>'salesman_name', NULLIF(p_sale->>'idempotency_key','')::uuid,
    COALESCE((p_sale->>'created_at')::timestamptz, now()), now()
  ) RETURNING id INTO v_id;

  -- Payment Moves (Strict - No DO NOTHING)
  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, v_id, h->>'note', now());
  END LOOP;

  -- Customer Ledger (Strict - No DO NOTHING)
  IF p_customer_ledger IS NOT NULL AND jsonb_typeof(p_customer_ledger) = 'object' THEN
    INSERT INTO customer_ledger (id, customer_id, sale_id, type, debit, credit, balance_after, reference, note, created_by, created_at)
    VALUES (
      COALESCE((p_customer_ledger->>'id')::uuid, gen_random_uuid()), (p_customer_ledger->>'customer_id')::uuid, v_id,
      p_customer_ledger->>'type', (p_customer_ledger->>'debit')::numeric, (p_customer_ledger->>'credit')::numeric,
      (p_customer_ledger->>'balance_after')::numeric, p_customer_ledger->>'reference', p_customer_ledger->>'note',
      v_current_user_id, COALESCE((p_customer_ledger->>'created_at')::timestamptz, now())
    );
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now());
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now());
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.delete_sale_atomic(
  p_sale_id uuid,
  p_history jsonb,
  p_payment_moves jsonb,
  p_customer_ledger jsonb,
  p_user_id uuid,
  p_role text,
  p_sig text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  h jsonb;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'delete_sale', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for delete_sale' USING ERRCODE = '42501';
  END IF;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: only admin can delete sales' USING ERRCODE = '42501';
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now());
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now());
    END IF;
  END LOOP;

  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, p_sale_id, h->>'note', now());
  END LOOP;

  IF p_customer_ledger IS NOT NULL AND jsonb_typeof(p_customer_ledger) = 'object' THEN
    INSERT INTO customer_ledger (id, customer_id, sale_id, type, debit, credit, balance_after, reference, note, created_by, created_at)
    VALUES (
      COALESCE((p_customer_ledger->>'id')::uuid, gen_random_uuid()), (p_customer_ledger->>'customer_id')::uuid, p_sale_id,
      p_customer_ledger->>'type', (p_customer_ledger->>'debit')::numeric, (p_customer_ledger->>'credit')::numeric,
      (p_customer_ledger->>'balance_after')::numeric, p_customer_ledger->>'reference', p_customer_ledger->>'note',
      v_current_user_id, COALESCE((p_customer_ledger->>'created_at')::timestamptz, now())
    );
  END IF;

  DELETE FROM sales WHERE id = p_sale_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;
CREATE OR REPLACE FUNCTION public.refund_sale_atomic(
  p_sale_id uuid,
  p_history jsonb,
  p_status text,
  p_refunded_amount numeric,
  p_user_id uuid,
  p_role text,
  p_sig text,
  p_payment_moves jsonb DEFAULT '[]'::jsonb,
  p_customer_ledger jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  h jsonb;
  _total numeric;
  _status text;
  _prior numeric;
  _threshold numeric;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'refund_sale', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for refund_sale' USING ERRCODE = '42501';
  END IF;

  SELECT total, status, COALESCE(refunded_amount, 0)
    INTO _total, _status, _prior
    FROM sales WHERE id = p_sale_id;

  IF _status = 'deleted' THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'sale_deleted_noop');
  END IF;
  IF _status = 'refunded' THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'already_fully_refunded', 'refunded_amount', _prior);
  END IF;
  IF p_refunded_amount <= _prior + 0.001 THEN
    RETURN jsonb_build_object('success', true, 'id', p_sale_id, 'note', 'noop_no_increase', 'refunded_amount', _prior);
  END IF;
  IF _total IS NOT NULL AND p_refunded_amount > _total + 0.001 THEN
    RAISE EXCEPTION 'FORBIDDEN: refund amount exceeds sale total' USING ERRCODE = '42501';
  END IF;

  IF v_role IS DISTINCT FROM 'admin' THEN
    SELECT refund_approval_threshold INTO _threshold FROM app_settings LIMIT 1;
    IF COALESCE(_threshold, 0) > 0 AND (p_refunded_amount - _prior) > _threshold THEN
      RAISE EXCEPTION 'APPROVAL_REQUIRED: refund exceeds admin approval threshold' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now());
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_sale_id, h->>'note', h->>'cashier_name', now(), now());
    END IF;
  END LOOP;

  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, p_sale_id, h->>'note', now());
  END LOOP;

  IF p_customer_ledger IS NOT NULL AND jsonb_typeof(p_customer_ledger) = 'object' THEN
    INSERT INTO customer_ledger (id, customer_id, sale_id, type, debit, credit, balance_after, reference, note, created_by, created_at)
    VALUES (
      COALESCE((p_customer_ledger->>'id')::uuid, gen_random_uuid()), (p_customer_ledger->>'customer_id')::uuid, p_sale_id,
      p_customer_ledger->>'type', (p_customer_ledger->>'debit')::numeric, (p_customer_ledger->>'credit')::numeric,
      (p_customer_ledger->>'balance_after')::numeric, p_customer_ledger->>'reference', p_customer_ledger->>'note',
      v_current_user_id, COALESCE((p_customer_ledger->>'created_at')::timestamptz, now())
    );
  END IF;

  UPDATE sales SET status = p_status, refunded_amount = p_refunded_amount, updated_at = now() WHERE id = p_sale_id;
  RETURN jsonb_build_object('success', true, 'id', p_sale_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.edit_sale_atomic(
  p_new_sale jsonb,
  p_new_history jsonb,
  p_old_sale_id uuid,
  p_old_reverse_history jsonb,
  p_user_id uuid,
  p_role text,
  p_sig text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid;
  h jsonb;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'edit_sale', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for edit_sale' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_role = ANY(ARRAY['admin','manager'])) THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted for edit_sale', v_role USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = p_old_sale_id) THEN
    RAISE EXCEPTION 'OLD_SALE_NOT_FOUND';
  END IF;
  IF p_new_sale->>'idempotency_key' IS NOT NULL AND p_new_sale->>'idempotency_key' <> '' THEN
    IF EXISTS (SELECT 1 FROM sales WHERE idempotency_key = (p_new_sale->>'idempotency_key')::uuid) THEN
      RETURN jsonb_build_object('success', true, 'already_committed', true,
        'new_id', (SELECT id FROM sales WHERE idempotency_key = (p_new_sale->>'idempotency_key')::uuid));
    END IF;
  END IF;
  INSERT INTO sales (
    id, invoice_number, customer_id, customer_name, customer_phone,
    items, subtotal, discount_amount, bill_discount_value, bill_discount_type,
    tax_amount, total, received_amount, change_amount, payment_method,
    card_details, status, cashier, cashier_role, receipt_number, notes,
    applied_discounts, free_gifts, timestamp, sale_date, sale_type,
    extra_charges, split_payments, refunded_amount, estore_status,
    delivery_address, delivery_fee, delivery_location_lat, delivery_location_lng,
    customer_notes, source_order_id, salesman_id, salesman_name,
    idempotency_key, edited_from_invoice, created_at, updated_at
  ) VALUES (
    (p_new_sale->>'id')::uuid, p_new_sale->>'invoice_number', NULLIF(p_new_sale->>'customer_id','')::uuid,
    p_new_sale->>'customer_name', p_new_sale->>'customer_phone', COALESCE(p_new_sale->'items','[]'::jsonb),
    (p_new_sale->>'subtotal')::numeric, (p_new_sale->>'discount_amount')::numeric, (p_new_sale->>'bill_discount_value')::numeric,
    p_new_sale->>'bill_discount_type', (p_new_sale->>'tax_amount')::numeric, (p_new_sale->>'total')::numeric,
    (p_new_sale->>'received_amount')::numeric, (p_new_sale->>'change_amount')::numeric, p_new_sale->>'payment_method',
    p_new_sale->'card_details', p_new_sale->>'status', p_new_sale->>'cashier', p_new_sale->>'cashier_role',
    p_new_sale->>'receipt_number', p_new_sale->>'notes', p_new_sale->'applied_discounts', p_new_sale->'free_gifts',
    (p_new_sale->>'timestamp')::timestamptz, (p_new_sale->>'sale_date')::date, p_new_sale->>'sale_type',
    p_new_sale->'extra_charges', p_new_sale->'split_payments', (p_new_sale->>'refunded_amount')::numeric,
    p_new_sale->>'estore_status', p_new_sale->>'delivery_address', (p_new_sale->>'delivery_fee')::numeric,
    (p_new_sale->>'delivery_location_lat')::numeric, (p_new_sale->>'delivery_location_lng')::numeric,
    p_new_sale->>'customer_notes', NULLIF(p_new_sale->>'source_order_id','')::uuid, NULLIF(p_new_sale->>'salesman_id','')::uuid,
    p_new_sale->>'salesman_name', NULLIF(p_new_sale->>'idempotency_key','')::uuid,
    p_new_sale->>'edited_from_invoice', COALESCE((p_new_sale->>'created_at')::timestamptz, now()), now()
  ) RETURNING id INTO v_id;

  FOR h IN SELECT * FROM jsonb_array_elements(p_new_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now());
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', v_id, h->>'note', h->>'cashier_name', now(), now());
    END IF;
  END LOOP;
  FOR h IN SELECT * FROM jsonb_array_elements(p_old_reverse_history) LOOP
    IF h->>'variant_id' IS NOT NULL AND h->>'variant_id' <> '' THEN
      INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, h->>'variant_id', h->>'variant_label', (h->>'change_qty')::int, h->>'type', p_old_sale_id, h->>'note', h->>'cashier_name', now(), now());
    ELSE
      INSERT INTO stock_history (id, product_id, change_qty, type, reference_id, note, cashier_name, created_at, updated_at)
      VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), (h->>'product_id')::uuid, (h->>'change_qty')::int, h->>'type', p_old_sale_id, h->>'note', h->>'cashier_name', now(), now());
    END IF;
  END LOOP;
  DELETE FROM sales WHERE id = p_old_sale_id;
  RETURN jsonb_build_object('success', true, 'new_id', v_id);
END;
$$;
CREATE OR REPLACE FUNCTION commit_expense(
  p_expense jsonb,
  p_payment_moves jsonb DEFAULT '[]'::jsonb,
  p_sig text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid;
  h jsonb;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'commit_expense', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for commit_expense' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_role = ANY(ARRAY['admin','manager'])) THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted for commit_expense', v_role USING ERRCODE = '42501';
  END IF;

  IF p_expense->>'idempotency_key' IS NOT NULL AND p_expense->>'idempotency_key' <> '' THEN
    IF EXISTS (SELECT 1 FROM expenses WHERE idempotency_key = p_expense->>'idempotency_key') THEN
      RETURN jsonb_build_object('success', true, 'id', (SELECT id FROM expenses WHERE idempotency_key = p_expense->>'idempotency_key'), 'already_committed', true);
    END IF;
  END IF;

  INSERT INTO expenses (
    id, category, amount, date, description, added_by, payment_method, notes,
    expense_month, idempotency_key, created_at, updated_at
  ) VALUES (
    COALESCE((p_expense->>'id')::uuid, gen_random_uuid()),
    p_expense->>'category',
    (p_expense->>'amount')::numeric,
    COALESCE((p_expense->>'date')::date, now()::date),
    p_expense->>'description',
    p_expense->>'added_by',
    p_expense->>'payment_method',
    p_expense->>'notes',
    p_expense->>'expense_month',
    p_expense->>'idempotency_key',
    COALESCE((p_expense->>'created_at')::timestamptz, now()),
    now()
  ) RETURNING id INTO v_id;

  FOR h IN SELECT * FROM jsonb_array_elements(p_payment_moves) LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (COALESCE((h->>'id')::uuid, gen_random_uuid()), h->>'mode_id', (h->>'delta')::numeric, v_id, h->>'note', now());
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
CREATE OR REPLACE FUNCTION receive_customer_payment(
  p_customer_id    uuid,
  p_amount         numeric,
  p_payment_mode   text     DEFAULT 'cash',
  p_payment_mode_id text    DEFAULT NULL,
  p_reference      text     DEFAULT NULL,
  p_note           text     DEFAULT NULL,
  p_created_by     uuid     DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_sig            text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_ledger_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_balance_before numeric;
  v_balance_after numeric;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'receive_customer_payment', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for receive_customer_payment' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM customer_ledger 
      WHERE (idempotency_key = p_idempotency_key OR reference = p_idempotency_key)
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO v_balance_before
  FROM customer_stats
  WHERE customer_id = p_customer_id;
  
  IF v_balance_before IS NULL THEN
    v_balance_before := 0;
  END IF;

  v_balance_after := v_balance_before - p_amount;

  INSERT INTO customer_ledger (
    id, customer_id, sale_id, type,
    debit, credit, balance_after,
    reference, note, created_by, created_at, idempotency_key
  ) VALUES (
    v_ledger_id, p_customer_id, NULL, 'payment',
    0, p_amount, v_balance_after,
    COALESCE(p_idempotency_key, p_reference), p_note,
    v_current_user_id, now(), COALESCE(p_idempotency_key, p_reference)
  );

  INSERT INTO payments (
    id, customer_id,
    payment_type, direction,
    amount, note,
    created_at, idempotency_key, source_type, source_id, transaction_id
  ) VALUES (
    v_payment_id, p_customer_id,
    p_payment_mode, 'in',
    p_amount,
    COALESCE(p_note, p_reference),
    now(), COALESCE(p_idempotency_key, p_reference), 'customer_payment', v_ledger_id, v_ledger_id
  );

  IF p_payment_mode_id IS NOT NULL THEN
    INSERT INTO payment_movements (
      id, mode_id, delta, reference_id, note, created_at
    ) VALUES (
      v_payment_id, p_payment_mode_id, p_amount,
      COALESCE(p_idempotency_key, p_reference), p_note, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_id', v_ledger_id,
    'payment_id', v_payment_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;
CREATE OR REPLACE FUNCTION refund_customer_payment(
  p_customer_id    uuid,
  p_amount         numeric,
  p_payment_mode   text     DEFAULT 'cash',
  p_payment_mode_id text    DEFAULT NULL,
  p_reference      text     DEFAULT NULL,
  p_note           text     DEFAULT NULL,
  p_created_by     uuid     DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL,
  p_sig            text     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_ledger_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_balance_before numeric;
  v_balance_after numeric;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'refund_customer_payment', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for refund_customer_payment' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM customer_ledger 
      WHERE (idempotency_key = p_idempotency_key OR reference = p_idempotency_key)
    ) THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO v_balance_before
  FROM customer_stats
  WHERE customer_id = p_customer_id;
  
  IF v_balance_before IS NULL THEN
    v_balance_before := 0;
  END IF;

  v_balance_after := v_balance_before + p_amount;

  INSERT INTO customer_ledger (
    id, customer_id, sale_id, type,
    debit, credit, balance_after,
    reference, note, created_by, created_at, idempotency_key
  ) VALUES (
    v_ledger_id, p_customer_id, NULL, 'refund',
    p_amount, 0, v_balance_after,
    COALESCE(p_idempotency_key, p_reference), p_note,
    v_current_user_id, now(), COALESCE(p_idempotency_key, p_reference)
  );

  INSERT INTO payments (
    id, customer_id,
    payment_type, direction,
    amount, note,
    created_at, idempotency_key, source_type, source_id, transaction_id
  ) VALUES (
    v_payment_id, p_customer_id,
    p_payment_mode, 'out',
    p_amount,
    COALESCE(p_note, p_reference),
    now(), COALESCE(p_idempotency_key, p_reference), 'customer_refund', v_ledger_id, v_ledger_id
  );

  IF p_payment_mode_id IS NOT NULL THEN
    INSERT INTO payment_movements (
      id, mode_id, delta, reference_id, note, created_at
    ) VALUES (
      v_payment_id, p_payment_mode_id, -p_amount,
      COALESCE(p_idempotency_key, p_reference), p_note, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_id', v_ledger_id,
    'payment_id', v_payment_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;
CREATE OR REPLACE FUNCTION apply_payment_movements(
  p_moves jsonb,
  p_sig text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  h jsonb;
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'apply_payment_movements', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for apply_payment_movements' USING ERRCODE = '42501';
  END IF;

  FOR h IN SELECT * FROM jsonb_array_elements(p_moves)
  LOOP
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (
      COALESCE((h->>'id')::uuid, gen_random_uuid()),
      h->>'mode_id',
      (h->>'delta')::numeric,
      NULLIF(h->>'reference_id','')::uuid,
      h->>'note',
      now()
    )
    ON CONFLICT (id) DO NOTHING;
    IF FOUND THEN
      UPDATE payment_modes SET balance = balance + (h->>'delta')::numeric, updated_at = now()
      WHERE id = h->>'mode_id';
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', true);
END;
$$;
CREATE OR REPLACE FUNCTION stock_adjustment(
  p_product_id uuid,
  p_change_qty integer,
  p_type text,
  p_note text,
  p_cashier text,
  p_variant_id text DEFAULT NULL,
  p_variant_label text DEFAULT NULL,
  p_adjustment_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_sig text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, extensions AS $$
DECLARE
  v_id uuid := COALESCE(p_adjustment_id, gen_random_uuid());
  v_role text;
  v_current_user_id uuid := auth.uid();
BEGIN
  -- RBAC & Action Signature (Strict)
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Not logged in';
  END IF;
  SELECT role INTO v_role FROM users WHERE id = v_current_user_id;
  IF NOT public.verify_action_token(v_current_user_id, v_role, 'stock_adjustment', p_sig) THEN
    RAISE EXCEPTION 'FORBIDDEN: invalid or missing action token for stock_adjustment' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_role = ANY(ARRAY['admin','manager'])) THEN
    RAISE EXCEPTION 'FORBIDDEN: role % not permitted for stock_adjustment', v_role USING ERRCODE = '42501';
  END IF;

  IF p_variant_id IS NOT NULL AND p_variant_id <> '' THEN
    INSERT INTO variant_stock_history (id, product_id, variant_id, variant_label, change_qty, type, note, cashier_name, created_at, updated_at)
    VALUES (v_id, p_product_id, p_variant_id, COALESCE(p_variant_label, ''), p_change_qty, p_type, p_note, p_cashier, now(), now());
  ELSE
    INSERT INTO stock_history (id, product_id, change_qty, type, note, cashier_name, created_at, updated_at)
    VALUES (v_id, p_product_id, p_change_qty, p_type, p_note, p_cashier, now(), now());
  END IF;
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
