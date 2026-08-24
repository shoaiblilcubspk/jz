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
