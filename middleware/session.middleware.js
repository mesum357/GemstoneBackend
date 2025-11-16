import session from 'express-session';
import MongoStore from 'connect-mongo';

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
  
  // Default session config (for frontend)
  const defaultSession = session({
    name: 'connect.sid', // Default cookie name for frontend
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true, // Changed to true to ensure session is created and cookie is set
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
      sameSite: isProduction ? 'none' : 'lax', // Allow cross-site in production
      // Don't set domain - let browser handle it for cross-domain cookies
    }
  });

  // Admin session config (separate cookie)
  const adminSession = session({
    name: 'admin.connect.sid', // Different cookie name for admin
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true, // Changed to true to ensure session is created and cookie is set
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
      sameSite: isProduction ? 'none' : 'lax', // Allow cross-site in production
      // Don't set domain - let browser handle it for cross-domain cookies
    }
  });

  // Return middleware that chooses the right session based on request
  return (req, res, next) => {
    const isAdmin = isAdminRequest(req);
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.PORT;
    
    // Debug logging
    console.log('[Session Middleware] Path:', req.path, 'Origin:', req.get('origin'), 'IsAdmin:', isAdmin, 'IsProduction:', isProduction, 'Cookie:', req.headers.cookie?.substring(0, 80) || 'none');
    
    if (isAdmin) {
      return adminSession(req, res, next);
    } else {
      return defaultSession(req, res, next);
    }
  };
};

export { isAdminRequest };

