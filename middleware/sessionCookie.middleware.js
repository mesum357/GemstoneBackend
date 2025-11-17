/**
 * Session Cookie Middleware
 * Ensures session is marked as modified so express-session sets cookies
 * This middleware MUST run after express-session middleware but before routes
 * DO NOT override res.end here - let express-session handle cookie setting
 */

export const sessionCookieMiddleware = (req, res, next) => {
  // Mark session as modified on every request to ensure cookies are set
  if (req.session && req.sessionID) {
    // IMPORTANT: Mark session as modified so express-session sets the cookie
    // express-session only sets cookies for modified sessions (or new sessions with saveUninitialized: true)
    // We mark it as modified by adding a property that changes
    if (!req.session._lastAccess || (Date.now() - req.session._lastAccess) > 1000) {
      req.session._lastAccess = Date.now();
    }
    
    // Touch session to update expiration (rolling sessions)
    if (req.session.touch) {
      req.session.touch();
    }
    
    // Ensure cookie properties are correct (set these BEFORE express-session saves)
    // These properties are used by express-session when setting cookies during res.end()
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
  }
  
  // Let express-session handle cookie setting during res.end()
  // Don't override res.end here - it will interfere with express-session
  next();
};

