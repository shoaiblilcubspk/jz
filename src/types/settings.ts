export interface AppSettings {
  id?: string;
  storeName: string;
  storeAddress: string;
  storePhone?: string;
  storeEmail?: string;
  storeWebsite?: string;
  storeLogo?: string;
  taxRate: number;
  currency: string;
  interfaceMode: 'touch' | 'traditional';
  autoBackup: boolean;
  receiptPrinter: boolean;
  theme: 'light' | 'dark' | 'auto';
  invoicePrefix: string;
  invoiceCounter: number;
  // Receipt & Printer Settings
  receiptPaperSize: '58mm' | '80mm' | 'A4';
  receiptDensity: 'draft' | 'normal' | 'detailed';
  enableKotPrinter?: boolean; // Kitchen Order Ticket printer toggle
  autoSaveReceiptPng?: boolean; // Auto-save receipt as PNG to device storage
  // Receipt Print Position Adjustments
  receiptPaddingTop: number;
  receiptPaddingBottom: number;
  receiptPaddingLeft: number;
  receiptPaddingRight: number;
  receiptOffsetX: number;
  receiptHeaderOffsetX?: number;
  receiptFooterOffsetX?: number;
  receiptShowFooter: boolean;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptShowLogo: boolean;
  receiptShowTax: boolean;
  receiptShowDiscount: boolean;
  receiptShowStoreName: boolean;
  receiptShowStoreAddress: boolean;
  receiptShowStorePhone: boolean;
  receiptShowStoreEmail: boolean;
  receiptShowCustomerName: boolean;
  receiptShowCustomerPhone: boolean;
  receiptShowNotes: boolean;
  receiptShowBarcode?: boolean;
  receiptShowDeliveryAddress: boolean;
  receiptShowQrCode: boolean;
  receiptTemplate: 'modern' | 'minimal' | 'classic' | 'professional' | 'compact' | 'ultra_compact'
    | 'horizontal_header' | 'centered_flow' | 'left_grid' | 'split_columns' | 'floating_totals'
    | 'offset_logo' | 'boxed_sections' | 'tear_off' | 'vertical_line' | 'emphasized_total';
  receiptFontScale: number;
  receiptFontBold: boolean;
  receiptFontWeight?: number;
  // Barcode Print Settings
  barcodePaperSize?: 'A4' | 'Thermal-50x25' | 'Thermal-40x30' | 'Thermal-80x40';
  barcodeA4Columns?: number;
  barcodeA4Rows?: number;
  barcodeShowPrice?: boolean;
  barcodeShowName?: boolean;
  barcodeShowSku?: boolean;
  barcodeShowCategory?: boolean;
  barcodeScale?: number;
  barcodeHeight?: number;
  barcodePadding?: number;
  barcodeBorder?: boolean;
  /** @deprecated Use barcodeShowBarcode and barcodeShowQr instead */
  barcodeType?: string;
  barcodeShowBarcode?: boolean;
  barcodeShowQr?: boolean;
  barcodeQrSize?: number;
  barcodeNameLines?: number;
  barcodeFontSize?: number;
  barcodeContentScale?: number;
  barcodeMarginX?: number;
  barcodeMarginY?: number;
  barcodeGapX?: number;
  barcodeGapY?: number;
  barcodeBarWidth?: number;
  // Global Localization & Industry
  country: string;
  taxId?: string;
  businessType: 'fashion' | 'grocery' | 'clothing' | 'shoes' | 'restaurant' | 'tech' | 'mobile' | 'general';
  // New System Toggles
  retailEnabled: boolean;
  wholesaleEnabled: boolean;
  defaultSaleType?: 'retail' | 'wholesale';
  touchKeyboardEnabled: boolean;
  soundEnabled: boolean;
  // SaaS / Subscription
  subscriptionTier?: 'free' | 'starter' | 'business';
  isLocked?: boolean;
  aiV2Enabled?: boolean;
  posGridColumns?: number;
  enableSplitPayment: boolean;
  enableExtraCharges: boolean;
  /** §4.2 MASTER: if false, checkout blocks a sale when stock would go negative (server-enforced) */
  allowNegativeStock?: boolean;
  /** RBAC: refunds above this amount require admin approval (0 = no threshold). Server-enforced in refund_sale_atomic. */
  refundApprovalThreshold?: number;
  /** Credit Sales system: enable/disable credit sales globally */
  enableCreditSales?: boolean;
  /** RBAC: allow cashier role to create credit sales */
  cashierCanCredit?: boolean;
  /** Allow sales above customer credit limit */
  allowCreditOverLimit?: boolean;
  /** Enable/disable purchase orders module */
  enablePurchaseOrders?: boolean;
  /** App language code (e.g. 'en', 'ur') */
  language?: string;
  /** Custom receipt number toggle */
  customReceiptNumber?: boolean;
  /** Purchase Order prefix */
  poPrefix?: string;
  /** Purchase Order counter */
  poCounter?: number;
  /** Barcode bar width */
  barcodeBarWidth?: number;
  /** Show barcode on barcode label */
  barcodeShowBarcode?: boolean;
  /** Show QR code on barcode label */
  barcodeShowQr?: boolean;
  /** QR code size on barcode label */
  barcodeQrSize?: number;
  /** Show barcode on receipt */
  receiptShowBarcode?: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  paymentMethod: 'cash' | 'card' | 'digital';
  storeType?: 'retail' | 'wholesale';
  notes?: string;
  isManualOverride?: boolean;
  overrideBy?: string;
  createdAt: Date;
  updatedAt?: Date;
  addedBy?: string;
}

export const EXPENSE_CATEGORIES = [
  'Utilities',
  'Food',
  'Fuel',
  'Rent',
  'Salaries',
  'Supplies',
  'Marketing',
  'Maintenance',
  'Insurance',
  'Taxes',
  'Other'
];