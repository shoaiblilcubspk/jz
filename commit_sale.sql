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
