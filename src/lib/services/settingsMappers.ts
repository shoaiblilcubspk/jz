import { AppSettings } from '../../types';
import { SETTINGS_ID } from '../localDb';

export const mapSettings = (item: any): AppSettings => {
  if (!item) return null as any;
  const s = item;
  return {
    id: s.id || SETTINGS_ID,
    // Core Identity
    storeName: s.store_name !== undefined ? s.store_name : s.storeName,
    storeAddress: s.store_address !== undefined ? s.store_address : s.storeAddress,
    storePhone: s.store_phone !== undefined ? s.store_phone : s.storePhone,
    storeEmail: s.store_email !== undefined ? s.store_email : s.storeEmail,
    storeLogo: s.store_logo !== undefined ? s.store_logo : s.storeLogo,
    storeWebsite: s.store_website !== undefined ? s.store_website : s.storeWebsite,

    // Finance & UI
    taxRate: s.tax_rate ?? s.taxRate ?? 0,
    currency: s.currency || 'PKR',
    interfaceMode: s.interface_mode ?? s.interfaceMode ?? 'touch',
    theme: s.theme || 'dark',

    // Receipt Settings
    receiptPaperSize: s.receipt_paper_size ?? s.receiptPaperSize ?? '80mm',
    receiptDensity: s.receipt_density ?? s.receiptDensity ?? 'normal',
    receiptHeader: s.receipt_header ?? s.receiptHeader,
    receiptFooter: s.receipt_footer ?? s.receiptFooter,
    receiptShowLogo: s.receipt_show_logo ?? s.receiptShowLogo ?? true,
    receiptShowFooter: s.receipt_show_footer ?? s.receiptShowFooter ?? true,
    receiptShowTax: s.receipt_show_tax ?? s.receiptShowTax ?? true,
    receiptShowDiscount: s.receipt_show_discount ?? s.receiptShowDiscount ?? true,
    receiptShowStoreName: s.receipt_show_store_name ?? s.receiptShowStoreName ?? true,
    receiptShowStoreAddress: s.receipt_show_store_address ?? s.receiptShowStoreAddress ?? true,
    receiptShowStorePhone: s.receipt_show_store_phone ?? s.receiptShowStorePhone ?? true,
    receiptShowStoreEmail: s.receipt_show_store_email ?? s.receiptShowStoreEmail ?? true,
    receiptShowCustomerName: s.receipt_show_customer_name ?? s.receiptShowCustomerName ?? true,
    receiptShowCustomerPhone: s.receipt_show_customer_phone ?? s.receiptShowCustomerPhone ?? true,
    receiptShowNotes: s.receipt_show_notes ?? s.receiptShowNotes ?? true,
    receiptShowDeliveryAddress: s.receipt_show_delivery_address ?? s.receiptShowDeliveryAddress ?? true,
    receiptShowQrCode: s.receipt_show_qr_code ?? s.receiptShowQrCode ?? true,
    receiptShowBarcode: s.receipt_show_barcode ?? s.receiptShowBarcode ?? true,
    receiptTemplate: s.receipt_template ?? s.receiptTemplate ?? 'modern',
    receiptFontScale: s.receipt_font_scale ?? s.receiptFontScale ?? 1.0,
    receiptFontBold: s.receipt_font_bold ?? s.receiptFontBold ?? false,
    receiptFontWeight: s.receipt_font_weight ?? s.receiptFontWeight ?? 400,

    // Receipt Calibration
    receiptPaddingTop: s.receipt_padding_top ?? s.receiptPaddingTop ?? 0,
    receiptPaddingBottom: s.receipt_padding_bottom ?? s.receiptPaddingBottom ?? 0,
    receiptPaddingLeft: s.receipt_padding_left ?? s.receiptPaddingLeft ?? 0,
    receiptPaddingRight: s.receipt_padding_right ?? s.receiptPaddingRight ?? 0,
    receiptOffsetX: s.receipt_offset_x ?? s.receiptOffsetX ?? 0,
    receiptHeaderOffsetX: s.receipt_header_offset_x ?? s.receiptHeaderOffsetX ?? 0,
    receiptFooterOffsetX: s.receipt_footer_offset_x ?? s.receiptFooterOffsetX ?? 0,

    // Barcode Settings
    barcodePaperSize: s.barcode_paper_size ?? s.barcodePaperSize ?? 'A4',
    barcodeA4Columns: s.barcode_a4_columns ?? s.barcodeA4Columns ?? 3,
    barcodeA4Rows: s.barcode_a4_rows ?? s.barcodeA4Rows ?? 10,
    barcodeShowPrice: s.barcode_show_price ?? s.barcodeShowPrice ?? true,
    barcodeShowName: s.barcode_show_name ?? s.barcodeShowName ?? true,
    barcodeShowSku: s.barcode_show_sku ?? s.barcodeShowSku ?? false,
    barcodeShowCategory: s.barcode_show_category ?? s.barcodeShowCategory ?? false,
    barcodeScale: s.barcode_scale ?? s.barcodeScale ?? 1.0,
    barcodeHeight: s.barcode_height ?? s.barcodeHeight ?? 30,
    barcodePadding: s.barcode_padding ?? s.barcodePadding ?? 8,
    barcodeBorder: s.barcode_border ?? s.barcodeBorder ?? true,
    barcodeType: s.barcode_type ?? s.barcodeType ?? 'BARCODE',
    barcodeNameLines: s.barcode_name_lines ?? s.barcodeNameLines ?? 1,
    barcodeFontSize: s.barcode_font_size ?? s.barcodeFontSize ?? 8,
    barcodeContentScale: Number(s.barcode_content_scale ?? s.barcodeContentScale ?? 1.0),
    barcodeMarginX: Number(s.barcode_margin_x ?? s.barcodeMarginX ?? 0),
    barcodeMarginY: Number(s.barcode_margin_y ?? s.barcodeMarginY ?? 0),
    barcodeGapX: Number(s.barcode_gap_x ?? s.barcodeGapX ?? 0),
    barcodeGapY: Number(s.barcode_gap_y ?? s.barcodeGapY ?? 0),
    barcodeBarWidth: Number(s.barcode_bar_width ?? s.barcodeBarWidth ?? 0.8),

    // Toggles & System
    retailEnabled: s.retail_enabled ?? s.retailEnabled ?? true,
    wholesaleEnabled: s.wholesale_enabled ?? s.wholesaleEnabled ?? false,
    defaultSaleType: s.default_sale_type ?? s.defaultSaleType ?? 'retail',
    touchKeyboardEnabled: s.touch_keyboard_enabled ?? s.touchKeyboardEnabled ?? false,
    soundEnabled: s.sound_enabled ?? s.soundEnabled ?? true,
    autoBackup: s.auto_backup ?? s.autoBackup ?? true,
    receiptPrinter: s.receipt_printer ?? s.receiptPrinter ?? false,

    invoicePrefix: s.invoice_prefix ?? s.invoicePrefix ?? 'INV',
    invoiceCounter: s.invoice_counter ?? s.invoiceCounter ?? 1000,

    country: s.country ?? s.country ?? 'PK',
    taxId: s.tax_id ?? s.taxId,
    businessType: s.business_type ?? s.businessType ?? 'general',

    // SaaS
    subscriptionTier: s.subscription_tier ?? s.subscriptionTier ?? 'free',
    isLocked: s.is_locked ?? s.isLocked ?? false,
    aiV2Enabled: s.ai_v2_enabled ?? s.aiV2Enabled ?? false,
    posGridColumns: s.pos_grid_columns ?? s.posGridColumns ?? 4,
    enableSplitPayment: s.enable_split_payment ?? s.enableSplitPayment ?? false,
    enableExtraCharges: s.enable_extra_charges ?? s.enableExtraCharges ?? false,
    enableKotPrinter: s.enable_kot_printer ?? s.enableKotPrinter ?? false,
    autoSaveReceiptPng: s.auto_save_receipt_png ?? s.autoSaveReceiptPng ?? false,

    // §4.2 MASTER: negative stock control (default FALSE = spec compliant, oversell blocked)
    allowNegativeStock: s.allow_negative_stock ?? s.allowNegativeStock ?? false,

    // RBAC: refund approval threshold (admin override above this amount)
    refundApprovalThreshold: Number(s.refund_approval_threshold ?? s.refundApprovalThreshold ?? 5000),

    // Credit Sales System
    enableCreditSales: s.enable_credit_sales ?? s.enableCreditSales ?? true,
    cashierCanCredit: s.cashier_can_credit ?? s.cashierCanCredit ?? true,
    allowCreditOverLimit: s.allow_credit_over_limit ?? s.allowCreditOverLimit ?? false,

    // Purchase Orders
    enablePurchaseOrders: s.enable_purchase_orders ?? s.enablePurchaseOrders ?? true,

    // Localization
    language: s.language ?? 'en',

    // Invoice / PO numbering
    customReceiptNumber: s.custom_receipt_number ?? s.customReceiptNumber ?? false,
    poPrefix: s.po_prefix ?? s.poPrefix ?? 'PO',
    poCounter: s.po_counter ?? s.poCounter ?? 1000,


    createdAt: s.created_at ? new Date(s.created_at) : (s.createdAt ? new Date(s.createdAt) : new Date()),
    updatedAt: s.updated_at ? new Date(s.updated_at) : (s.updatedAt ? new Date(s.updatedAt) : new Date())
  } as AppSettings;
};

export const toRemoteSettings = (s: Partial<AppSettings>) => {
  const remote: any = {};

  // Mapping logic: Send ONLY snake_case to Supabase to prevent 400 errors
  // for columns that do not exist in camelCase format.

  if ('storeName' in s) { remote.store_name = s.storeName ?? null; }
  if ('storeAddress' in s) { remote.store_address = s.storeAddress ?? null; }
  if ('storePhone' in s) { remote.store_phone = s.storePhone ?? null; }
  if ('storeEmail' in s) { remote.store_email = s.storeEmail ?? null; }
  if ('storeLogo' in s) { remote.store_logo = s.storeLogo ?? null; }
  if ('storeWebsite' in s) { remote.store_website = s.storeWebsite ?? null; }

  if ('taxRate' in s) { remote.tax_rate = s.taxRate; }
  if ('currency' in s) { remote.currency = s.currency; }
  if ('interfaceMode' in s) { remote.interface_mode = s.interfaceMode; }
  if ('theme' in s) { remote.theme = s.theme; }
  if ('autoBackup' in s) { remote.auto_backup = s.autoBackup; }
  if ('receiptPrinter' in s) { remote.receipt_printer = s.receiptPrinter; }
  if ('invoicePrefix' in s) { remote.invoice_prefix = s.invoicePrefix; }
  if ('invoiceCounter' in s) { remote.invoice_counter = s.invoiceCounter; }

  if ('receiptPaperSize' in s) { remote.receipt_paper_size = s.receiptPaperSize; }
  if ('receiptDensity' in s) { remote.receipt_density = s.receiptDensity; }
  if ('receiptTemplate' in s) { remote.receipt_template = s.receiptTemplate; }
  if ('receiptHeader' in s) { remote.receipt_header = s.receiptHeader ?? null; }
  if ('receiptFooter' in s) { remote.receipt_footer = s.receiptFooter ?? null; }

  if ('receiptShowLogo' in s) { remote.receipt_show_logo = s.receiptShowLogo; }
  if ('receiptShowFooter' in s) { remote.receipt_show_footer = s.receiptShowFooter; }
  if ('receiptShowTax' in s) { remote.receipt_show_tax = s.receiptShowTax; }
  if ('receiptShowDiscount' in s) { remote.receipt_show_discount = s.receiptShowDiscount; }
  if ('receiptShowStoreName' in s) { remote.receipt_show_store_name = s.receiptShowStoreName; }
  if ('receiptShowStoreAddress' in s) { remote.receipt_show_store_address = s.receiptShowStoreAddress; }
  if ('receiptShowStorePhone' in s) { remote.receipt_show_store_phone = s.receiptShowStorePhone; }
  if ('receiptShowStoreEmail' in s) { remote.receipt_show_store_email = s.receiptShowStoreEmail; }
  if ('receiptShowCustomerName' in s) { remote.receipt_show_customer_name = s.receiptShowCustomerName; }
  if ('receiptShowCustomerPhone' in s) { remote.receipt_show_customer_phone = s.receiptShowCustomerPhone; }
  if ('receiptShowNotes' in s) { remote.receipt_show_notes = s.receiptShowNotes; }
  if ('receiptShowDeliveryAddress' in s) { remote.receipt_show_delivery_address = s.receiptShowDeliveryAddress; }
  if ('receiptShowQrCode' in s) { remote.receipt_show_qr_code = s.receiptShowQrCode; }

  if ('receiptFontScale' in s) { remote.receipt_font_scale = s.receiptFontScale; }
  if ('receiptFontBold' in s) { remote.receipt_font_bold = s.receiptFontBold; }
  if ('receiptFontWeight' in s) { remote.receipt_font_weight = String(s.receiptFontWeight); }

  if ('receiptPaddingTop' in s) { remote.receipt_padding_top = s.receiptPaddingTop; }
  if ('receiptPaddingBottom' in s) { remote.receipt_padding_bottom = s.receiptPaddingBottom; }
  if ('receiptPaddingLeft' in s) { remote.receipt_padding_left = s.receiptPaddingLeft; }
  if ('receiptPaddingRight' in s) { remote.receipt_padding_right = s.receiptPaddingRight; }
  if ('receiptOffsetX' in s) { remote.receipt_offset_x = s.receiptOffsetX; }
  if ('receiptHeaderOffsetX' in s) { remote.receipt_header_offset_x = s.receiptHeaderOffsetX; }
  if ('receiptFooterOffsetX' in s) { remote.receipt_footer_offset_x = s.receiptFooterOffsetX; }

  if ('barcodePaperSize' in s) { remote.barcode_paper_size = s.barcodePaperSize; }
  if ('barcodeA4Columns' in s) { remote.barcode_a4_columns = s.barcodeA4Columns; }
  if ('barcodeA4Rows' in s) { remote.barcode_a4_rows = s.barcodeA4Rows; }
  if ('barcodeShowPrice' in s) { remote.barcode_show_price = s.barcodeShowPrice; }
  if ('barcodeShowName' in s) { remote.barcode_show_name = s.barcodeShowName; }
  if ('barcodeShowSku' in s) { remote.barcode_show_sku = s.barcodeShowSku; }
  if ('barcodeShowCategory' in s) { remote.barcode_show_category = s.barcodeShowCategory; }
  if ('barcodeScale' in s) { remote.barcode_scale = s.barcodeScale; }
  if ('barcodeHeight' in s) { remote.barcode_height = s.barcodeHeight; }
  if ('barcodePadding' in s) { remote.barcode_padding = s.barcodePadding; }
  if ('barcodeBorder' in s) { remote.barcode_border = s.barcodeBorder; }
  if ('barcodeType' in s) { remote.barcode_type = s.barcodeType; }
  if ('barcodeNameLines' in s) { remote.barcode_name_lines = s.barcodeNameLines; }
  if ('barcodeFontSize' in s) { remote.barcode_font_size = s.barcodeFontSize; }
  if ('barcodeContentScale' in s) { remote.barcode_content_scale = s.barcodeContentScale; }
  if ('barcodeMarginX' in s) { remote.barcode_margin_x = s.barcodeMarginX; }
  if ('barcodeMarginY' in s) { remote.barcode_margin_y = s.barcodeMarginY; }
  if ('barcodeGapX' in s) { remote.barcode_gap_x = s.barcodeGapX; }
  if ('barcodeGapY' in s) { remote.barcode_gap_y = s.barcodeGapY; }

  if ('retailEnabled' in s) { remote.retail_enabled = s.retailEnabled; }
  if ('wholesaleEnabled' in s) { remote.wholesale_enabled = s.wholesaleEnabled; }
  if ('defaultSaleType' in s) { remote.default_sale_type = s.defaultSaleType; }

  if ('touchKeyboardEnabled' in s) { remote.touch_keyboard_enabled = s.touchKeyboardEnabled; }
  if ('soundEnabled' in s) { remote.sound_enabled = s.soundEnabled; }
  if ('country' in s) { remote.country = s.country; }
  if ('taxId' in s) { remote.tax_id = s.taxId ?? null; }
  if ('businessType' in s) { remote.business_type = s.businessType; }
  if ('subscriptionTier' in s) { remote.subscription_tier = s.subscriptionTier; }
  if ('isLocked' in s) { remote.is_locked = s.isLocked; }
  if ('aiV2Enabled' in s) { remote.ai_v2_enabled = s.aiV2Enabled; }
  if ('posGridColumns' in s) { remote.pos_grid_columns = s.posGridColumns; }
  if ('enableSplitPayment' in s) { remote.enable_split_payment = s.enableSplitPayment; }
  if ('enableExtraCharges' in s) { remote.enable_extra_charges = s.enableExtraCharges; }
  if ('enableKotPrinter' in s) { remote.enable_kot_printer = s.enableKotPrinter; }
  if ('autoSaveReceiptPng' in s) { remote.auto_save_receipt_png = s.autoSaveReceiptPng; }
  if ('allowNegativeStock' in s) { remote.allow_negative_stock = s.allowNegativeStock; }
  if ('refundApprovalThreshold' in s) { remote.refund_approval_threshold = s.refundApprovalThreshold; }

  // Credit Sales System
  if ('enableCreditSales' in s) { remote.enable_credit_sales = s.enableCreditSales; }
  if ('cashierCanCredit' in s) { remote.cashier_can_credit = s.cashierCanCredit; }
  if ('allowCreditOverLimit' in s) { remote.allow_credit_over_limit = s.allowCreditOverLimit; }

  // Purchase Orders toggle
  if ('enablePurchaseOrders' in s) { remote.enable_purchase_orders = s.enablePurchaseOrders; }

  // Localization
  if ('language' in s) { remote.language = s.language; }

  // Invoice / PO numbering
  if ('customReceiptNumber' in s) { remote.custom_receipt_number = s.customReceiptNumber; }
  if ('poPrefix' in s) { remote.po_prefix = s.poPrefix; }
  if ('poCounter' in s) { remote.po_counter = s.poCounter; }

  // Barcode extras
  if ('barcodeBarWidth' in s) { remote.barcode_bar_width = s.barcodeBarWidth; }
  if ('barcodeShowBarcode' in s) { remote.barcode_show_barcode = s.barcodeShowBarcode; }
  if ('barcodeShowQr' in s) { remote.barcode_show_qr = s.barcodeShowQr; }
  if ('barcodeQrSize' in s) { remote.barcode_qr_size = s.barcodeQrSize; }

  // Receipt barcode toggle
  if ('receiptShowBarcode' in s) { remote.receipt_show_barcode = s.receiptShowBarcode; }

  if ('updatedAt' in s) {
    remote.updated_at = s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt;
  }

  return remote;
};
