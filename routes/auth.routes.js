import express from 'express';
import passport from 'passport';
import { body, validationResult } from 'express-validator';
import authController from '../controllers/auth.controller.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Validation middleware
const validateSignup = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name cannot be empty'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name cannot be empty')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Helper function to check validation results
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Signup route
router.post(
  '/signup',
  validateSignup,
  checkValidation,
  authController.signup
);

// Login route (for regular users)
router.post(
  '/login',
  validateLogin,
  checkValidation,
  (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || 'Invalid email or password'
        });
      }
      req.login(user, (err) => {
        if (err) {
          console.error('[Login Route] req.login error:', err);
          return next(err);
        }
        // Save session explicitly before calling login controller
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[Login Route] Session save error:', saveErr);
            return next(saveErr);
          }
          return authController.login(req, res);
        });
      });
    })(req, res, next);
  }
);

// Admin login route (separate endpoint for admin authentication)
router.post(
  '/admin/login',
  validateLogin,
  checkValidation,
  (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || 'Invalid email or password'
        });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        return authController.adminLogin(req, res);
      });
    })(req, res, next);
  }
);

// Logout route
router.post('/logout', isAuthenticated, authController.logout);

// Get current user route
router.get('/me', isAuthenticated, authController.getCurrentUser);

// Check authentication status
router.get('/status', authController.getAuthStatus);

// Check admin authentication status (admin only)
router.get('/admin/status', authController.getAdminAuthStatus);

// Get all users (admin only, excludes admin users - only regular users)
router.get('/users', isAuthenticated, isAdmin, authController.getAllUsers);

export default router;

