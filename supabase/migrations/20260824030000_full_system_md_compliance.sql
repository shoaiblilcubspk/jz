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
