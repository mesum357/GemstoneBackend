// Middleware to check if user is authenticated
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Authentication required. Please log in.'
  });
};

// Middleware to check if user is admin
export const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Admin access required'
  });
};

// Middleware to check if user is admin or the owner
export const isAdminOrOwner = (req, res, next) => {
  if (req.isAuthenticated()) {
    if (req.user.role === 'admin' || req.user._id.toString() === req.params.userId) {
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied'
  });
};

