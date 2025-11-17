import User from '../models/User.model.js';
import crypto from 'crypto';
import { sign } from 'cookie-signature';

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

      // Log session state BEFORE req.login
      console.log('[Signup] before req.login session:', JSON.stringify({
        sessionID: req.sessionID,
        passport: req.session?.passport || 'missing',
        userId: req.session?.userId || 'missing'
      }));

      // Log in the user after signup - use callback-based req.login to ensure serializeUser runs
      req.login(newUser, (err) => {
        if (err) {
          console.error('[Signup] req.login error:', err);
          return next(err);
        }

        // Debug log to confirm passport was added to session
        console.log('[Signup] after req.login req.session:', JSON.stringify({
          sessionID: req.sessionID,
          passport: req.session.passport || 'missing',
          userId: req.session.userId || 'missing'
        }));

        // Force a save to the store so that the DB contains passport.user before response
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[Signup] session.save error', saveErr);
            return next(saveErr);
          }

          console.log('[Signup] session saved - session id:', req.sessionID);
          console.log('[Signup] session.save callback session:', JSON.stringify({
            sessionID: req.sessionID,
            passport: req.session.passport || 'missing',
            userId: req.session.userId || 'missing'
          }));

          // Remove password from response
          const userResponse = newUser.toJSON();

          // Now respond
          return res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: userResponse
          });
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
        console.error('[Login] No user in req.user');
        return res.status(401).json({
          success: false,
          message: 'Authentication failed'
        });
      }

      // Debug logging
      const cookieName = req.session?.cookie?.name || (req.session?.cookie ? 'connect.sid' : 'undefined');
      console.log('[Login] User authenticated:', user.email, 'Session ID:', req.sessionID, 'Cookie name:', cookieName, 'IsProduction:', process.env.NODE_ENV === 'production' || !!process.env.RENDER);

      // Reject admin users from regular login endpoint
      if (user.role === 'admin') {
        req.logout(() => {}); // Logout the admin user
        return res.status(403).json({
          success: false,
          message: 'Admin accounts cannot login through this endpoint. Please use the admin panel.'
        });
      }

      // IMPORTANT: Session is already saved to MongoDB by req.login() callback in route
      // We just need to ensure express-session sets a cookie and send the response
      // The session already has passport.user, userId, userEmail, and loginTime
      
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
      
      // IMPORTANT: Mark session as modified so express-session will set cookie during res.end()
      req.session.lastAccess = Date.now();
      
      // Touch session to update expiration (rolling sessions)
      if (req.session.touch) {
        req.session.touch();
      }
      
      // Hook into res.end to ensure cookie is set
      const originalEnd = res.end.bind(res);
      res.end = function(chunk, encoding) {
        // Check if cookie was set by express-session
        const setCookieHeader = res.getHeader('Set-Cookie');
        const cookieSet = setCookieHeader && (
          Array.isArray(setCookieHeader)
            ? setCookieHeader.some(c => c && c.startsWith(req.session?.cookie?.name || 'connect.sid'))
            : setCookieHeader && setCookieHeader.toString().startsWith(req.session?.cookie?.name || 'connect.sid')
        );
        
        if (!cookieSet && req.session && req.sessionID) {
          // express-session didn't set cookie - manually set it
          console.warn('[Login] express-session did not set cookie - manually setting it');
          const isProduction = process.env.NODE_ENV === 'production' || 
                               process.env.RENDER || 
                               process.env.PORT;
          const cookieName = req.session.cookie?.name || 'connect.sid';
          const secret = process.env.SESSION_SECRET || 'your-secret-key';
          
          // Use express-session's cookie signing format: s:sessionId.signature
          const signature = sign(req.sessionID, secret);
          const signedSessionId = `s:${signature}`;
          
          res.cookie(cookieName, signedSessionId, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: req.session.cookie?.maxAge || 7 * 24 * 60 * 60 * 1000,
            path: '/',
            domain: undefined,
            overwrite: true
          });
          
          console.log('[Login] ✅ Manually set cookie - Session ID:', req.sessionID);
        } else if (cookieSet) {
          console.log('[Login] ✅ Cookie set by express-session - Session ID:', req.sessionID);
        }
        
        originalEnd.call(this, chunk, encoding);
      };
      
      // Remove password from response
      const userResponse = user.toJSON();

      // Send response - cookie will be checked/set in res.end hook
      return res.json({
        success: true,
        message: 'Login successful',
        user: userResponse,
        sessionId: req.sessionID
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
    // Debug logging
    const cookieName = req.session?.cookie?.name || (req.session?.cookie ? 'connect.sid' : 'undefined');
    const cookies = req.headers.cookie || 'no cookies';
    console.log('[Auth Status] Session ID:', req.sessionID, 'Cookie name:', cookieName, 'User:', req.user?.email || 'none', 'Cookies:', cookies.substring(0, 100));
    console.log('[Auth Status] Session exists:', !!req.session, 'Session ID from req:', req.sessionID);
    console.log('[Auth Status] Session data:', req.session ? {
      userId: req.session.userId,
      userEmail: req.session.userEmail,
      passport: req.session.passport ? 'exists' : 'missing'
    } : 'no session');
    
    // If user is authenticated but is admin, don't return them
    // This prevents admin users from being logged in on the frontend
    if (req.user && req.user.role === 'admin') {
      return res.json({
        authenticated: false,
        user: null,
        sessionId: req.sessionID
      });
    }
    
    return res.json({
      authenticated: !!req.user,
      user: req.user || null,
      sessionId: req.sessionID
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

