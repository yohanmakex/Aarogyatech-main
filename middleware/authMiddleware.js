const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthMiddleware {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'mindcare-default-secret-change-in-production';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
    this.ADMIN_SESSION_TIMEOUT = parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 3600000; // 1 hour
  }

  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        sessionId: user.sessionId 
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Middleware to authenticate requests
  authenticate = (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid authentication token'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const decoded = this.verifyToken(token);
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }
  };

  // Middleware to authorize based on roles
  authorize = (allowedRoles = []) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
        });
      }

      next();
    };
  };

  // Middleware for admin-only access
  adminOnly = this.authorize(['admin']);

  // Middleware for admin and counselor access
  adminOrCounselor = this.authorize(['admin', 'counselor']);

  // Validate user input for registration/login
  validateUserInput(userData, isRegistration = false) {
    const errors = [];

    if (!userData.username || userData.username.trim().length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (!userData.password || userData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (isRegistration) {
      if (!userData.role || !['admin', 'counselor'].includes(userData.role)) {
        errors.push('Role must be either "admin" or "counselor"');
      }

      if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        errors.push('Valid email address is required');
      }

      if (!userData.fullName || userData.fullName.trim().length < 2) {
        errors.push('Full name must be at least 2 characters long');
      }
    }

    return errors;
  }

  // Generate session ID
  generateSessionId() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // Session cleanup middleware
  cleanupExpiredSessions = (req, res, next) => {
    // This will be implemented with the session management service
    next();
  };
}

module.exports = AuthMiddleware;