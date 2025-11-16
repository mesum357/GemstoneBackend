/**
 * Session Recovery Middleware
 * Recovers sessions if session object is empty but cookie exists
 * This handles edge cases where session might be lost but cookie is still valid
 */

export const sessionRecoveryMiddleware = (req, res, next) => {
  // Only attempt recovery if session is empty but we have a session cookie
  if (!req.session || !req.sessionID || Object.keys(req.session).length === 0) {
    const cookieName = req._sessionCookieName || 'connect.sid';
    const cookies = req.headers.cookie || '';
    
    // Extract session ID from cookie if present
    const cookieMatch = cookies.match(new RegExp(`${cookieName}=([^;]+)`));
    
    if (cookieMatch && cookieMatch[1]) {
      const sessionId = cookieMatch[1].split('.')[0]; // Get session ID part
      
      if (sessionId && req.sessionStore) {
        // Try to recover session from store
        req.sessionStore.get(sessionId, (err, session) => {
          if (err) {
            console.error('[Session Recovery] Error retrieving session:', err);
            return next();
          }
          
          if (session) {
            console.log('[Session Recovery] Session recovered from cookie:', sessionId);
            // Restore session data
            req.sessionID = sessionId;
            req.session = session;
            
            // Regenerate session to ensure proper initialization
            req.session.regenerate((err) => {
              if (err) {
                console.error('[Session Recovery] Error regenerating session:', err);
                return next();
              }
              next();
            });
          } else {
            // Session doesn't exist in store, continue without recovery
            next();
          }
        });
      } else {
        next();
      }
    } else {
      next();
    }
  } else {
    // Session exists, continue normally
    next();
  }
};

