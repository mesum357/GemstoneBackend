import express from 'express';
import paymentSettingsController from '../controllers/paymentSettings.controller.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create payment settings upload directory if it doesn't exist
const settingsDir = path.join(__dirname, '../uploads/payment-settings');
if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true });
}

// Configure multer for QR code upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, settingsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `qr-code-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const settingsUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

const router = express.Router();

// Public route - get payment settings (for frontend payment page)
router.get('/', paymentSettingsController.getPaymentSettings);

// Admin routes - update payment settings
router.put('/', isAuthenticated, isAdmin, settingsUpload.single('qrCode'), paymentSettingsController.updatePaymentSettings);

export default router;

