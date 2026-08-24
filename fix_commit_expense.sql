CREATE OR REPLACE FUNCTION commit_expense(
  p_expense jsonb,
  p_payment_move jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO expenses (
    id, category, amount, date, description, added_by, payment_method, created_at, updated_at
  ) VALUES (
    (p_expense->>'id')::uuid, p_expense->>'category', (p_expense->>'amount')::numeric,
    COALESCE((p_expense->>'date')::timestamptz, now()), p_expense->>'description', p_expense->>'added_by',
    p_expense->>'payment_method', COALESCE((p_expense->>'created_at')::timestamptz, now()), now()
  ) ON CONFLICT (id) DO NOTHING RETURNING id INTO v_id;

  IF v_id IS NULL THEN v_id := (p_expense->>'id')::uuid; END IF;

  IF p_payment_move IS NOT NULL AND jsonb_typeof(p_payment_move) = 'object' THEN
    INSERT INTO payment_movements (id, mode_id, delta, reference_id, note, created_at)
    VALUES (
      (p_payment_move->>'id')::uuid, (p_payment_move->>'mode_id')::uuid, (p_payment_move->>'delta')::numeric,
      v_id, p_payment_move->>'note',
      COALESCE((p_payment_move->>'created_at')::timestamptz, now())
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;
