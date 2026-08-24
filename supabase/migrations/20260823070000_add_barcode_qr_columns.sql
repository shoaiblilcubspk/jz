-- [2026-08-23] Add missing barcode qr columns
ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS barcode_show_barcode BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode_show_qr BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS barcode_qr_size INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS receipt_show_barcode BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
