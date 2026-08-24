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
