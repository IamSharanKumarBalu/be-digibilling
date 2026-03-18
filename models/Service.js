import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  sacCode: {
    type: String,
    trim: true,
    default: '',
  },
  gstRate: {
    type: Number,
    enum: [0, 5, 12, 18, 28],
    default: 18,
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  unit: {
    type: String,
    enum: ['PCS', 'NOS', 'JOB', 'HRS', 'DAYS', 'MONTHS'],
    default: 'NOS',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Ensure name is unique per organization
ServiceSchema.index({ organization: 1, name: 1 }, { unique: true });

export default mongoose.model('Service', ServiceSchema);
