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
