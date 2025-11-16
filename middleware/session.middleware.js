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
  
  // If origin is explicitly set to admin URL, it's an admin request
  if (origin && (
    origin.includes('localhost:8081') ||
    origin.includes(adminUrl.replace('http://', '').replace('https://', ''))
  )) {
    // Make sure it's not the frontend URL
    if (!origin.includes('localhost:8080') && 
        !origin.includes(frontendUrl.replace('http://', '').replace('https://', ''))) {
      return true;
    }
  }
  
  // Check referer header as fallback
  const referer = req.get('referer') || '';
  if (referer && (
    referer.includes('localhost:8081') ||
    referer.includes(adminUrl.replace('http://', '').replace('https://', ''))
  )) {
    if (!referer.includes('localhost:8080') && 
        !referer.includes(frontendUrl.replace('http://', '').replace('https://', ''))) {
      return true;
    }
  }
  
  return false;
};

/**
 * Session middleware factory
 * Creates different session configs for admin vs frontend
 */
export const createSessionMiddleware = () => {
  // Default session config (for frontend)
  const defaultSession = session({
    name: 'connect.sid', // Default cookie name for frontend
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site in production
    }
  });

  // Admin session config (separate cookie)
  const adminSession = session({
    name: 'admin.connect.sid', // Different cookie name for admin
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/vitalgeonaturals',
      ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site in production
    }
  });

  // Return middleware that chooses the right session based on request
  return (req, res, next) => {
    if (isAdminRequest(req)) {
      return adminSession(req, res, next);
    } else {
      return defaultSession(req, res, next);
    }
  };
};

export { isAdminRequest };

