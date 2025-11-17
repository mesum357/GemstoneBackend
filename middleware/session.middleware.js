import session from 'express-session';
import MongoStore from 'connect-mongo';
import crypto from 'crypto';
import { createSanitizedMongoStore } from './sanitizedMongoStore.js';

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
    store: createSanitizedMongoStore({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      collectionName: 'sessions', // Explicit collection name
      ttl: SESSION_TTL * 2, // 14 days (double cookie maxAge for MongoDB cleanup)
      touchAfter: 0, // Disabled for debugging - every change is persisted immediately
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
    store: createSanitizedMongoStore({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      collectionName: 'admin_sessions', // Separate collection for admin sessions
      ttl: SESSION_TTL * 2, // 14 days
      touchAfter: 0, // Disabled for debugging - every change is persisted immediately
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
        
        // Handle specific error: missing cookie object in session loaded from MongoDB
        if (err.message && err.message.includes('Cannot read properties of undefined (reading \'expires\')')) {
          console.warn('[Session Middleware] Corrupted session in MongoDB (missing cookie object) - deleting corrupted session');
          
          // Get the session ID that was corrupted
          const corruptedSessionId = req.sessionID;
          
          // Delete the corrupted session from MongoDB if we have a session store
          if (corruptedSessionId && req.sessionStore && typeof req.sessionStore.destroy === 'function') {
            req.sessionStore.destroy(corruptedSessionId, (destroyErr) => {
              if (destroyErr) {
                console.error('[Session Middleware] Error deleting corrupted session:', destroyErr);
              } else {
                console.log('[Session Middleware] Deleted corrupted session from MongoDB:', corruptedSessionId.substring(0, 10) + '...');
              }
            });
          }
          
          // Clear the corrupted cookie from the request to force a new session
          const cookieName = req._sessionCookieName || 'connect.sid';
          const cookies = req.headers.cookie || '';
          
          // Remove the corrupted cookie from the cookie header
          if (cookies.includes(cookieName)) {
            const cookieRegex = new RegExp(`${cookieName}=[^;]+(;\\s*)?`, 'gi');
            req.headers.cookie = cookies.replace(cookieRegex, '').trim().replace(/^;|;$/g, '').trim();
            
            // Also clear it from the response
            res.clearCookie(cookieName, {
              path: '/',
              domain: undefined,
              secure: process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.PORT,
              sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.PORT) ? 'none' : 'lax',
              httpOnly: true
            });
            
            console.log('[Session Middleware] Cleared corrupted cookie from request');
          }
          
          // Clear session-related properties to let express-session create a new session
          delete req.sessionID;
          delete req.session;
          
          // Don't pass error to next() - this allows express-session to handle it
          // express-session will see no session cookie and create a new session
          // Note: This means the request will continue without a session initially,
          // but on the next request (after the cookie is cleared), a new session will be created
          console.log('[Session Middleware] Will create new session on next request');
          return next();
        }
        
        // For other errors, continue normally (might be handled by express-session)
        return next(err);
      }
      
      // After session middleware, ensure cookie is being set
      if (req.session && !req.sessionID) {
        console.warn('[Session Middleware] Session exists but no sessionID!');
      }
      
      // Ensure session has a cookie object (fix if missing)
      if (req.session && !req.session.cookie) {
        console.warn('[Session Middleware] Session missing cookie object - initializing');
        const SESSION_MAX_AGE = process.env.SESSION_MAX_AGE 
          ? parseInt(process.env.SESSION_MAX_AGE) 
          : 7 * 24 * 60 * 60 * 1000;
        
        req.session.cookie = {
          path: '/',
          maxAge: SESSION_MAX_AGE,
          expires: new Date(Date.now() + SESSION_MAX_AGE),
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? 'none' : 'lax',
          domain: undefined,
          overwrite: true
        };
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
          
          // Ensure expires is set if missing
          if (!req.session.cookie.expires) {
            const SESSION_MAX_AGE = process.env.SESSION_MAX_AGE 
              ? parseInt(process.env.SESSION_MAX_AGE) 
              : 7 * 24 * 60 * 60 * 1000;
            req.session.cookie.expires = new Date(Date.now() + SESSION_MAX_AGE);
          }
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

