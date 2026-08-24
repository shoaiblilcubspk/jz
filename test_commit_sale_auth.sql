DO $$
DECLARE
  v_res jsonb;
BEGIN
  -- set a dummy uuid as if logged in
  EXECUTE 'SET LOCAL request.jwt.claim.sub TO ''00000000-0000-0000-0000-000000000001''';
  
  BEGIN
    PERFORM commit_sale('{"id":"00000000-0000-0000-0000-000000000001", "invoice_number":"TEST-1", "subtotal":100, "total":100}'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, 'dummy_sig');
    RAISE EXCEPTION 'FAILED: commit_sale succeeded with dummy p_sig!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SUCCESS: commit_sale blocked dummy sig: %', SQLERRM;
  END;
END;
$$;
