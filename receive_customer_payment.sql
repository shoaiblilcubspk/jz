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
