DROP FUNCTION IF EXISTS commit_sale(jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS delete_sale_atomic(uuid, jsonb, jsonb, jsonb, uuid, text, text);
DROP FUNCTION IF EXISTS refund_sale_atomic(uuid, jsonb, text, numeric, uuid, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS edit_sale_atomic(jsonb, jsonb, uuid, jsonb, uuid, text, text);
DROP FUNCTION IF EXISTS commit_expense(jsonb, jsonb);
DROP FUNCTION IF EXISTS receive_customer_payment(uuid, numeric, text, text, text, text, uuid, text);
DROP FUNCTION IF EXISTS refund_customer_payment(uuid, numeric, text, text, text, text, uuid, text);
DROP FUNCTION IF EXISTS apply_payment_movements(jsonb);
DROP FUNCTION IF EXISTS stock_adjustment(uuid, integer, text, text, text, text, text, uuid, uuid, text, text);
