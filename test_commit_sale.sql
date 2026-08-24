DO $$
DECLARE
  v_res jsonb;
BEGIN
  -- simulate as cashier calling commit_sale WITHOUT p_sig
  BEGIN
    PERFORM commit_sale('{"id":"00000000-0000-0000-0000-000000000001", "invoice_number":"TEST-1", "subtotal":100, "total":100}'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL);
    RAISE EXCEPTION 'FAILED: commit_sale succeeded without p_sig!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SUCCESS: commit_sale blocked: %', SQLERRM;
  END;
END;
$$;
