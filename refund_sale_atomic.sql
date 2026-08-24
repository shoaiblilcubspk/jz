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
