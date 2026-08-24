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
