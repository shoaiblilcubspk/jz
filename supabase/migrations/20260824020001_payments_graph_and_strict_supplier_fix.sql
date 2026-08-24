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
