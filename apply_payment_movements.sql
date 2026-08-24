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
