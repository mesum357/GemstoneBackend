import express from 'express';
import paymentController from '../controllers/payment.controller.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create payments upload directory if it doesn't exist
const paymentsDir = path.join(__dirname, '../uploads/payments');
if (!fs.existsSync(paymentsDir)) {
  fs.mkdirSync(paymentsDir, { recursive: true });
}

// Configure multer for payment screenshots
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `payment-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png)'));
  }
};

const paymentUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

const router = express.Router();

// Public routes
router.post('/', paymentUpload.single('screenshot'), paymentController.createPayment);

// IMPORTANT: Specific routes must come before parameterized routes
// User routes (require authentication)
router.get('/my-transactions', isAuthenticated, paymentController.getMyTransactions);

// Admin routes (require authentication and admin role)
router.get('/', isAuthenticated, isAdmin, paymentController.getAllPayments);
router.put('/:id/status', isAuthenticated, isAdmin, paymentController.updatePaymentStatus);
router.delete('/:id', isAuthenticated, isAdmin, paymentController.deletePayment);
router.get('/:id', isAuthenticated, isAdmin, paymentController.getPaymentById);

export default router;

