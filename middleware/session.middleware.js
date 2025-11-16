import session from 'express-session';
import MongoStore from 'connect-mongo';
import crypto from 'crypto';

/**
 * Middleware to determine if request is from admin panel
 */
const isAdminRequest = (req) => {
  // Check for custom header first (most reliable)
  if (req.get('x-client-type') === 'admin') {
    return true;
  }
  
  // Check if the path is an admin endpoint
  if (req.path && (
    req.path.startsWith('/api/auth/admin') ||
    req.path.includes('/admin/')
  )) {
    return true;
  }
  
  // Check for admin session cookie (if cookie exists, it's likely an admin request)
  const cookies = req.headers.cookie || '';
  if (cookies.includes('admin.connect.sid=') && !cookies.includes('connect.sid=')) {
    return true;
  }
  
  // Check origin header
  const origin = req.get('origin') || '';
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:8081';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  
  // Extract domain from URLs (remove protocol)
  const adminDomain = adminUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const frontendDomain = frontendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // If origin matches admin URL exactly, it's an admin request
  if (origin) {
    const originDomain = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (originDomain === adminDomain || originDomain.includes(adminDomain)) {
      // Make sure it's not the frontend URL
      if (originDomain !== frontendDomain && !originDomain.includes(frontendDomain)) {
        return true;
      }
    }
  }
  
  // Check referer header as fallback
  const referer = req.get('referer') || '';
  if (referer) {
    const refererDomain = referer.replace(/^https?:\/\//, '').split('/')[0];
    const adminDomain = adminUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const frontendDomain = frontendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (refererDomain === adminDomain || refererDomain.includes(adminDomain)) {
      // Make sure it's not the frontend URL
      if (refererDomain !== frontendDomain && !refererDomain.includes(frontendDomain)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Session middleware factory
 * Creates different session configs for admin vs frontend
 */
export const createSessionMiddleware = () => {
  // Determine if we're in production (check for Render or production-like environment)
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.RENDER || 
                       process.env.PORT; // Render sets PORT
  
  // Get session configuration from environment
  const SESSION_NAME = process.env.SESSION_NAME || 'connect.sid';
  const SESSION_MAX_AGE = process.env.SESSION_MAX_AGE 
    ? parseInt(process.env.SESSION_MAX_AGE) 
    : 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds (default)
  const SESSION_TTL = Math.floor(SESSION_MAX_AGE / 1000); // Convert to seconds for MongoDB TTL
  
  // Default session config (for frontend)
  const defaultSession = session({
    name: SESSION_NAME, // Cookie name configurable via SESSION_NAME
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true, // Save session even if not modified to ensure cookie is set
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      collectionName: 'sessions', // Explicit collection name
      ttl: SESSION_TTL * 2, // 14 days (double cookie maxAge for MongoDB cleanup)
      touchAfter: 24 * 3600, // Lazy session update (1 day)
      stringify: false, // Store as BSON (faster)
      autoRemove: 'native', // Use MongoDB TTL index
      autoRemoveInterval: 3600, // Check for expired sessions every hour
      autoIndex: false // Don't auto-create indexes (can cause warnings)
    }),
    cookie: {
      httpOnly: true, // Prevent JavaScript access
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'none' : 'lax', // Allow cross-site in production
      maxAge: SESSION_MAX_AGE, // Cookie expiration (7 days default)
      path: '/', // Available site-wide
      domain: undefined, // No domain restriction for cross-domain support
      overwrite: true // Overwrite existing cookies
    },
    rolling: true, // Reset expiration on activity
    genid: () => {
      // Generate cryptographically random session ID (32 hex characters)
      return crypto.randomBytes(16).toString('hex');
    }
  });

  // Admin session config (separate cookie)
  const adminSession = session({
    name: 'admin.connect.sid', // Different cookie name for admin
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true, // Save session even if not modified
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      collectionName: 'admin_sessions', // Separate collection for admin sessions
      ttl: SESSION_TTL * 2, // 14 days
      touchAfter: 24 * 3600, // Lazy session update (1 day)
      stringify: false, // Store as BSON
      autoRemove: 'native',
      autoRemoveInterval: 3600,
      autoIndex: false
    }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
      domain: undefined,
      overwrite: true
    },
    rolling: true,
    genid: () => {
      return crypto.randomBytes(16).toString('hex');
    }
  });

  // Return middleware that chooses the right session based on request
  return (req, res, next) => {
    const isAdmin = isAdminRequest(req);
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.PORT;
    
    // Debug logging
    const cookieHeader = req.headers.cookie || 'none';
    console.log('[Session Middleware] Path:', req.path, 'Origin:', req.get('origin'), 'IsAdmin:', isAdmin, 'IsProduction:', isProduction, 'Cookie:', cookieHeader.substring(0, 80));
    
    // Store cookie name in request for debugging
    req._sessionCookieName = isAdmin ? 'admin.connect.sid' : 'connect.sid';
    
    const sessionMiddleware = isAdmin ? adminSession : defaultSession;
    
    return sessionMiddleware(req, res, (err) => {
      if (err) {
        console.error('[Session Middleware] Error:', err);
        return next(err);
      }
      
      // After session middleware, ensure cookie is being set
      if (req.session && !req.sessionID) {
        console.warn('[Session Middleware] Session exists but no sessionID!');
      }
      
      // Log if cookie will be set and ensure cookie properties are correct
      if (req.session && req.session.cookie) {
        console.log('[Session Middleware] Session initialized - ID:', req.sessionID, 'Cookie name:', req._sessionCookieName);
        
        // Ensure cookie properties are set correctly for cross-domain support
        if (req.session.cookie) {
          req.session.cookie.secure = isProduction;
          req.session.cookie.sameSite = isProduction ? 'none' : 'lax';
          req.session.cookie.path = '/';
          req.session.cookie.domain = undefined; // Don't set domain for cross-domain support
          req.session.cookie.overwrite = true;
        }
        
        // IMPORTANT: Mark session as modified to ensure cookie is set
        // Even with saveUninitialized: true, we need to ensure the session is tracked
        if (typeof req.session.save === 'function') {
          // Touch session to update expiration
          if (req.session.touch) {
            req.session.touch();
          }
          // Mark as modified by adding a property
          req.session._lastAccess = new Date().getTime();
        }
      } else if (!req.session) {
        console.warn('[Session Middleware] No session created for request');
      }
      
      next();
    });
  };
};

export { isAdminRequest };

