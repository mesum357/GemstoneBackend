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
        
        // Ensure session properties are set correctly
        if (req.session && req.session.cookie) {
          const isProduction = process.env.NODE_ENV === 'production' || 
                               process.env.RENDER || 
                               process.env.PORT;
          req.session.cookie.secure = isProduction;
          req.session.cookie.sameSite = isProduction ? 'none' : 'lax';
          req.session.cookie.path = '/';
          req.session.cookie.domain = undefined;
          req.session.cookie.overwrite = true;
        }
        
        // Save session explicitly before calling login controller
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[Login Route] Session save error:', saveErr);
            return next(saveErr);
          }
          console.log('[Login Route] Session saved successfully - ID:', req.sessionID);
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

// Check session route (for debugging session issues)
router.get('/checksession', (req, res) => {
  console.log('[CheckSession] Route hit - Path:', req.path, 'Method:', req.method);
  
  // Get cookie name from session store if available
  const cookieName = req.sessionStore?.cookieName || 
                     req.session?.cookie?.name || 
                     (req.path && req.path.includes('/admin') ? 'admin.connect.sid' : 'connect.sid');
  
  const sessionInfo = {
    sessionId: req.sessionID,
    sessionExists: !!req.session,
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? {
      _id: req.user._id,
      email: req.user.email,
      role: req.user.role
    } : null,
    cookieName: cookieName,
    cookieOptions: req.session?.cookie ? {
      secure: req.session.cookie.secure,
      httpOnly: req.session.cookie.httpOnly,
      sameSite: req.session.cookie.sameSite,
      maxAge: req.session.cookie.maxAge,
      expires: req.session.cookie.expires,
      domain: req.session.cookie.domain
    } : null,
    requestHeaders: {
      origin: req.get('origin'),
      referer: req.get('referer'),
      'x-client-type': req.get('x-client-type'),
      cookie: req.headers.cookie ? req.headers.cookie.substring(0, 200) : 'no cookies'
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      isRender: !!process.env.RENDER,
      port: process.env.PORT,
      isProduction: process.env.NODE_ENV === 'production' || !!process.env.RENDER || !!process.env.PORT
    },
    sessionStore: {
      // Check if session store is accessible
      type: req.sessionStore?.constructor?.name || 'unknown'
    },
    timestamp: new Date().toISOString()
  };

  // Add additional debug info
  if (req.session) {
    sessionInfo.sessionData = {
      cookie: req.session.cookie ? {
        originalMaxAge: req.session.cookie.originalMaxAge,
        httpOnly: req.session.cookie.httpOnly,
        secure: req.session.cookie.secure,
        sameSite: req.session.cookie.sameSite,
        path: req.session.cookie.path
      } : null
    };
  }

  // Mark session as modified to ensure cookie is set (even if unmodified)
  if (req.session) {
    // Touch the session to mark it as modified
    if (req.session.touch) {
      req.session.touch();
    }
    // Ensure cookie properties are correct
    if (req.session.cookie) {
      const isProduction = process.env.NODE_ENV === 'production' || 
                           process.env.RENDER || 
                           process.env.PORT;
      req.session.cookie.secure = isProduction;
      req.session.cookie.sameSite = isProduction ? 'none' : 'lax';
      req.session.cookie.path = '/';
      req.session.cookie.domain = undefined;
      req.session.cookie.overwrite = true;
    }
    // Modify session to ensure it's saved and cookie is set
    req.session.lastAccess = new Date();
  }

  // Hook into response to check cookie after express-session sets it
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);
  
  // Override res.end to check for cookie header after express-session sets it
  res.end = function(chunk, encoding) {
    // Check cookie header right before response is sent
    const setCookieHeader = res.getHeader('Set-Cookie');
    if (setCookieHeader) {
      const cookieValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
      console.log('[CheckSession] ✅ Set-Cookie header found:', cookieValue?.substring(0, 150));
      sessionInfo.setCookieHeader = cookieValue;
    } else {
      console.error('[CheckSession] ⚠️ No Set-Cookie header found! Session ID:', req.sessionID);
      sessionInfo.setCookieHeader = 'Not Set - This is the problem!';
    }
    
    // Log response headers for debugging
    const responseHeaders = {
      'Set-Cookie': setCookieHeader ? (Array.isArray(setCookieHeader) ? setCookieHeader.length : 1) : 0,
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin')
    };
    sessionInfo.responseHeaders = responseHeaders;
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  // Ensure session is saved and cookie is set before sending response
  req.session.save((err) => {
    if (err) {
      console.error('[CheckSession] Error saving session:', err);
      return res.status(500).json({
        success: false,
        message: 'Error saving session',
        error: err.message
      });
    }
    
    // Send response - cookie checking happens in res.end override
    return res.json({
      success: true,
      message: 'Session check completed',
      session: sessionInfo
    });
  });
});

export default router;

