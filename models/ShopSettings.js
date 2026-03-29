import mongoose from 'mongoose';

const shopSettingsSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shopName: {
    type: String,
    required: true,
    trim: true
  },
  ownerName: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  gstin: {
    type: String,
    uppercase: true,
    trim: true
  },
  logo: {
    type: String
  },
  termsAndConditions: {
    type: String,
    trim: true
  },
  defaultTaxType: {
    type: String,
    enum: ['CGST_SGST', 'IGST'],
    default: 'CGST_SGST'
  },
  gstScheme: {
    type: String,
    enum: ['REGULAR', 'COMPOSITION'],
    default: 'REGULAR'
  },
  invoicePrefix: {
    type: String,
    default: 'INV'
  },
  invoiceStartNumber: {
    type: Number,
    default: 1
  },

  // --- Invoice Settings (Compliance) ---
  billOfSupplyEnabled: {
    type: Boolean,
    default: false
  },
  ewayBill: {
    type: Boolean,
    default: false
  },
  einvoice: {
    type: Boolean,
    default: false
  },

  // --- Business Type ---
  businessType: {
    type: String,
    trim: true
  },

  // --- Invoice Template ---
  invoiceTemplate: {
    type: String,
    enum: ['our-format', 'tally-portrait', 'tally-landscape'],
    default: 'our-format'
  },

  // --- Invoice Item / Section Toggles ---
  enableProduct: { type: Boolean, default: true },
  enableService: { type: Boolean, default: false },
  invBatchNumber: { type: Boolean, default: false },
  invExpiryDate: { type: Boolean, default: false },
  enableTransport: { type: Boolean, default: false },
  enablePurchaseOrders: { type: Boolean, default: false },
  enableAdditionalDetails: { type: Boolean, default: false },
  enableShipTo: { type: Boolean, default: false },

  // --- Quotation Section Toggles (independent from invoice) ---
  qtEnableProduct: { type: Boolean, default: true },
  qtEnableService: { type: Boolean, default: false },
  qtEnableTransport: { type: Boolean, default: false },
  qtEnablePurchaseOrders: { type: Boolean, default: false },
  qtEnableAdditionalDetails: { type: Boolean, default: false },

  // --- Feature Toggles ---
  enableInventory: { type: Boolean, default: true },

  // --- Bank / Payment Details (printed on invoice) ---
  invAccountHolder: { type: String, trim: true },
  invBankName: { type: String, trim: true },
  invAccountNumber: { type: String, trim: true },
  invIfscCode: { type: String, trim: true },
  invBranchName: { type: String, trim: true },
  invQrCode: { type: String },

  // --- Quotation Settings ---
  quotationValidityDays: { type: Number, default: 30 },
  quotationTerms: { type: String, trim: true },
  quotationBrandColor: { type: String, default: '#f97316' },

  // --- Proforma Invoice Compliance ---
  proformaEinvoice: { type: Boolean, default: false },

  // --- Proforma Item Tracking Fields ---
  pfBatchNumber: { type: Boolean, default: false },
  pfExpiryDate: { type: Boolean, default: false },
  pfImeiNumber: { type: Boolean, default: false },
  pfSerialNumber: { type: Boolean, default: false },

  // --- Proforma Section Toggles ---
  pfEnableTransport: { type: Boolean, default: false },
  pfEnablePurchaseOrders: { type: Boolean, default: false },
  pfEnableAdditionalDetails: { type: Boolean, default: false },

  // --- Proforma Bank / Payment Details ---
  pfAccountHolder: { type: String, trim: true },
  pfBankName: { type: String, trim: true },
  pfAccountNumber: { type: String, trim: true },
  pfIfscCode: { type: String, trim: true },
  pfBranchName: { type: String, trim: true },
  pfQrCode: { type: String },

  // --- Proforma Terms & Conditions ---
  proformaTerms: { type: String, trim: true },

  // --- Invoice Terms & Conditions ---
  invoiceTerms: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// One shop settings per organization
shopSettingsSchema.index({ organizationId: 1 }, { unique: true });

const ShopSettings = mongoose.model('ShopSettings', shopSettingsSchema);
export default ShopSettings;
