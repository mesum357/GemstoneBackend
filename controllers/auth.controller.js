import User from '../models/User.model.js';

const authController = {
  // Signup controller (for regular users only)
  signup: async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Prevent creating admin accounts through signup endpoint
      if (role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot create admin accounts through this endpoint'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user (always as regular user, ignore role from request)
      const newUser = new User({
        email: email.toLowerCase(),
        password, // Will be hashed by the pre-save hook
        firstName: firstName || '',
        lastName: lastName || '',
        role: 'user' // Force role to 'user' for frontend signups
      });

      await newUser.save();

      // Log in the user after signup
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }

        // Remove password from response
        const userResponse = newUser.toJSON();

        return res.status(201).json({
          success: true,
          message: 'User created successfully',
          user: userResponse
        });
      });
    } catch (error) {
      console.error('Signup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Login controller (for regular users only)
  login: async (req, res) => {
    try {
      // User is already authenticated by Passport middleware
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed'
        });
      }

      // Reject admin users from regular login endpoint
      if (user.role === 'admin') {
        req.logout(() => {}); // Logout the admin user
        return res.status(403).json({
          success: false,
          message: 'Admin accounts cannot login through this endpoint. Please use the admin panel.'
        });
      }

      // Remove password from response
      const userResponse = user.toJSON();

      return res.json({
        success: true,
        message: 'Login successful',
        user: userResponse
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error during login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Admin login controller (separate endpoint for admin authentication)
  adminLogin: async (req, res) => {
    try {
      // User is already authenticated by Passport middleware
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed'
        });
      }

      // Verify user has admin role
      if (user.role !== 'admin') {
        req.logout(() => {}); // Logout the user if not admin
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }

      // Remove password from response
      const userResponse = user.toJSON();

      return res.json({
        success: true,
        message: 'Admin login successful',
        user: userResponse
      });
    } catch (error) {
      console.error('Admin login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error during admin login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Logout controller
  logout: (req, res) => {
    try {
      // Determine which cookie to clear based on the session name
      const sessionName = req.session?.cookie?.name || (req.path && req.path.includes('/admin') ? 'admin.connect.sid' : 'connect.sid');
      
      req.logout((err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Error during logout'
          });
        }

        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Error destroying session'
            });
          }

          // Clear both cookies to be safe
          res.clearCookie('connect.sid');
          res.clearCookie('admin.connect.sid');
          return res.json({
            success: true,
            message: 'Logout successful'
          });
        });
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error during logout'
      });
    }
  },

  // Get current user controller
  getCurrentUser: async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      // Fetch fresh user data from database
      const user = await User.findById(req.user._id).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error('Get current user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching user data'
      });
    }
  },

  // Get authentication status (for regular users only, excludes admin users)
  getAuthStatus: (req, res) => {
    // If user is authenticated but is admin, don't return them
    // This prevents admin users from being logged in on the frontend
    if (req.user && req.user.role === 'admin') {
      return res.json({
        authenticated: false,
        user: null
      });
    }
    
    return res.json({
      authenticated: !!req.user,
      user: req.user || null
    });
  },

  // Get admin authentication status (only returns admin users)
  getAdminAuthStatus: (req, res) => {
    if (req.user && req.user.role === 'admin') {
      return res.json({
        authenticated: true,
        user: req.user
      });
    }
    return res.json({
      authenticated: false,
      user: null
    });
  },

  // Get all users (admin only, excludes admin users - only regular users)
  getAllUsers: async (req, res) => {
    try {
      // Fetch all users with role 'user' only (exclude admins)
      const users = await User.find({ role: 'user' })
        .select('-password')
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        count: users.length,
        users
      });
    } catch (error) {
      console.error('Get all users error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default authController;

