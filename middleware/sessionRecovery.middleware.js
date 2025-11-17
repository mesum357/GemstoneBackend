/**
 * Session Recovery Middleware
 * Currently disabled - express-session handles session loading from MongoDB automatically
 * This middleware was causing conflicts with express-session's internal session inflation
 */

export const sessionRecoveryMiddleware = (req, res, next) => {
  // Let express-session handle session loading automatically
  // No manual intervention needed - express-session already handles loading sessions from MongoDB
  next();
};

