import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true
  },
  itemStatus: {
    type: String,
    enum: ['TRADING', 'RAW_MATERIAL', 'FINISHED', 'SEMI', 'CONSUMABLE'],
    default: 'TRADING'
  },
  category: {
    type: String,
    trim: true
  },
  serialNumbers: {
    type: [String],
    default: []
  },
  soldSerialNumbers: {
    type: [String],
    default: []
  },
  manufactureDate: {
    type: Date
  },
  genericName: {
    type: String,
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true
  },
  composition: {
    type: String,
    trim: true
  },
  batchNo: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  hsnCode: {
    type: String,
    trim: true
  },
  gstRate: {
    type: Number,
    required: false,
    default: 12
  },
  mrp: {
    type: Number,
    required: false
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  purchasePrice: {
    type: Number,
    required: false
  },
  stockQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  minStockLevel: {
    type: Number,
    default: 10
  },
  unit: {
    type: String,
    enum: ['PCS', 'BOX', 'STRIP', 'BOTTLE', 'KG', 'LITRE'],
    default: 'PCS'
  },
  rack: {
    type: String,
    trim: true
  },
  trackInventory: {
    type: Boolean,
    default: true   // false = no stock management, always available in invoice
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for multi-tenant search and queries
productSchema.index({ organizationId: 1, name: 1 });
productSchema.index({ organizationId: 1, isActive: 1 });
productSchema.index({ organizationId: 1, stockQuantity: 1 });
productSchema.index({ name: 'text', genericName: 'text', manufacturer: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;
