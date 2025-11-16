import Payment from '../models/Payment.model.js';
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const paymentController = {
  // Create a new payment submission
  createPayment: async (req, res) => {
    try {
      const { accountName, transactionId, productId } = req.body;
      const screenshot = req.file; // From multer

      // Validation
      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      if (!screenshot) {
        return res.status(400).json({
          success: false,
          message: 'Payment screenshot is required'
        });
      }

      // Check if product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if transaction ID already exists (only if provided)
      if (transactionId) {
        const existingPayment = await Payment.findOne({ transactionId });
        if (existingPayment) {
          return res.status(400).json({
            success: false,
            message: 'This transaction ID has already been submitted'
          });
        }
      }

      // Get screenshot URL (from upload middleware)
      const screenshotUrl = `/uploads/payments/${screenshot.filename}`;

      // Get user ID if authenticated (req.user is set by passport session middleware if authenticated)
      const userId = req.isAuthenticated() && req.user ? req.user._id : null;

      // Generate unique booking ID (format: VGN + timestamp + random 4 digits)
      const timestamp = Date.now();
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const bookingId = `VGN${timestamp}${randomDigits}`;

      // Create payment record
      const payment = new Payment({
        bookingId,
        productId,
        userId,
        accountName,
        transactionId,
        screenshot: screenshotUrl,
        amount: product.price || 0,
        status: 'pending'
      });

      await payment.save();

      return res.status(201).json({
        success: true,
        message: 'Payment submitted successfully. We will verify your payment shortly.',
        payment
      });
    } catch (error) {
      console.error('Create payment error:', error);
      
      // Handle duplicate transaction ID error
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'This transaction ID has already been submitted'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error submitting payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get all payments (admin only)
  getAllPayments: async (req, res) => {
    try {
      // Only show non-deleted payments in admin panel
      const payments = await Payment.find({ deletedAt: null })
        .populate('productId', 'name image price')
        .populate('userId', 'email firstName lastName')
        .populate('verifiedBy', 'email firstName lastName')
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: payments.length,
        payments
      });
    } catch (error) {
      console.error('Get payments error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching payments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get payment by ID
  getPaymentById: async (req, res) => {
    try {
      const payment = await Payment.findById(req.params.id)
        .populate('productId', 'name image price')
        .populate('userId', 'email firstName lastName')
        .populate('verifiedBy', 'email firstName lastName');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      return res.json({
        success: true,
        payment
      });
    } catch (error) {
      console.error('Get payment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get user's own transactions
  getMyTransactions: async (req, res) => {
    try {
      const userId = req.user._id;
      
      const payments = await Payment.find({ userId })
        .populate('productId', 'name image price')
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: payments.length,
        payments
      });
    } catch (error) {
      console.error('Get my transactions error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching transactions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Update payment status (admin only)
  updatePaymentStatus: async (req, res) => {
    try {
      const { status, notes } = req.body;
      const paymentId = req.params.id;

      if (!['pending', 'verified', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment status'
        });
      }

      const payment = await Payment.findById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      payment.status = status;
      if (notes) payment.notes = notes;

      if (status === 'verified' || status === 'rejected') {
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user._id;
      }

      await payment.save();

      return res.json({
        success: true,
        message: `Payment ${status} successfully`,
        payment
      });
    } catch (error) {
      console.error('Update payment status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating payment status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Delete payment (admin only) - Soft delete
  deletePayment: async (req, res) => {
    try {
      const paymentId = req.params.id;

      const payment = await Payment.findById(paymentId);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Soft delete: Mark as deleted but keep in database
      // This allows users to still see their transaction history
      payment.deletedAt = new Date();
      await payment.save();

      return res.json({
        success: true,
        message: 'Payment deleted successfully. It will remain visible to the user in their transaction history.'
      });
    } catch (error) {
      console.error('Delete payment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error deleting payment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default paymentController;

