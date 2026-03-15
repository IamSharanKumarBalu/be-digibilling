import 'dotenv/config';  // ← MUST be first — loads .env before any other module reads process.env

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import productRoutes from './routes/productRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import purchaseReturnRoutes from './routes/purchaseReturnRoutes.js';
import salesReturnRoutes from './routes/salesReturnRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import quotationRoutes from './routes/quotationRoutes.js';
import proformaRoutes from './routes/proformaRoutes.js';
import deliveryChallanRoutes from './routes/deliveryChallanRoutes.js';

// Import Counter model to register it with Mongoose
import './models/Counter.js';

const app = express();

// Connect to MongoDB
connectDB();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Strict limiter for login/signup — blocks brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,                   // raised from 20 — prevents lockout during dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// General limiter for all API routes — blocks scraping & abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                   // 300 requests per IP (generous for real users)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Only allow your actual frontend domain.
// Set FRONTEND_URL in .env — e.g.  https://app.digistrivebilling.com
// Multiple domains: https://app.domain.com,https://domain.com
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} is not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general limiter to every API route
app.use('/api/', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
// Auth routes get the strict authLimiter applied on top of the general limiter
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/purchase-returns', purchaseReturnRoutes);
app.use('/api/sales-returns', salesReturnRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/proforma-invoices', proformaRoutes);
app.use('/api/delivery-challans', deliveryChallanRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Billing API is running. DigistriveMedia.com' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
