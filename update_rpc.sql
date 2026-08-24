CREATE OR REPLACE FUNCTION receive_customer_payment(
  p_customer_id    uuid,
  p_amount         numeric,
  p_payment_mode   text     DEFAULT 'cash',
  p_payment_mode_id uuid    DEFAULT NULL,
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
