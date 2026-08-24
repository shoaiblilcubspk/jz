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
