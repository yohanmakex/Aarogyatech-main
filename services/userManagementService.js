const AuthMiddleware = require('../middleware/authMiddleware');

class UserManagementService {
  constructor() {
    this.authMiddleware = new AuthMiddleware();
    this.users = new Map(); // In-memory storage for demo - replace with database in production
    this.sessions = new Map(); // Active sessions
    this.initialized = false;
    this.initializeDefaultAdmin();
  }

  // Initialize default admin user
  async initializeDefaultAdmin() {
    try {
      const defaultAdmin = {
        id: 'admin-001',
        username: 'admin',
        email: 'admin@mindcare.edu',
        fullName: 'System Administrator',
        role: 'admin',
        password: await this.authMiddleware.hashPassword('admin123!'),
        createdAt: new Date(),
        isActive: true,
        lastLogin: null
      };

      this.users.set('admin', defaultAdmin);

      // Create a default counselor for testing
      const defaultCounselor = {
        id: 'counselor-001',
        username: 'counselor',
        email: 'counselor@mindcare.edu',
        fullName: 'Mental Health Counselor',
        role: 'counselor',
        password: await this.authMiddleware.hashPassword('counselor123!'),
        createdAt: new Date(),
        isActive: true,
        lastLogin: null
      };

      this.users.set('counselor', defaultCounselor);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize default users:', error);
      this.initialized = false;
    }
  }

  // Wait for initialization to complete
  async waitForInitialization() {
    if (this.initialized) return;
    
    // Wait for initialization with timeout
    const timeout = 5000; // 5 seconds
    const start = Date.now();
    
    while (!this.initialized && (Date.now() - start) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.initialized) {
      throw new Error('UserManagementService initialization timeout');
    }
  }

  // Authenticate user
  async authenticateUser(username, password) {
    try {
      const user = this.users.get(username);
      
      if (!user || !user.isActive) {
        throw new Error('Invalid credentials or account disabled');
      }

      const isValidPassword = await this.authMiddleware.comparePassword(password, user.password);
      
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate session
      const sessionId = this.authMiddleware.generateSessionId();
      const sessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        loginTime: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      this.sessions.set(sessionId, sessionData);

      // Update last login
      user.lastLogin = new Date();

      // Generate JWT token
      const tokenUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        sessionId: sessionId
      };

      const token = this.authMiddleware.generateToken(tokenUser);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          lastLogin: user.lastLogin
        },
        sessionId
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Create new user (admin only)
  async createUser(userData) {
    try {
      // Validate input
      const validationErrors = this.authMiddleware.validateUserInput(userData, true);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Check if username already exists
      if (this.users.has(userData.username)) {
        throw new Error('Username already exists');
      }

      // Check if email already exists
      const existingUser = Array.from(this.users.values()).find(user => user.email === userData.email);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // Hash password
      const hashedPassword = await this.authMiddleware.hashPassword(userData.password);

      // Create user
      const newUser = {
        id: `${userData.role}-${Date.now()}`,
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        password: hashedPassword,
        createdAt: new Date(),
        isActive: true,
        lastLogin: null
      };

      this.users.set(userData.username, newUser);

      // Return user without password
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    } catch (error) {
      throw new Error(`User creation failed: ${error.message}`);
    }
  }

  // Get all users (admin only)
  getAllUsers() {
    return Array.from(this.users.values()).map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  // Get user by username
  getUserByUsername(username) {
    const user = this.users.get(username);
    if (!user) {
      return null;
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Update user (admin only)
  async updateUser(username, updateData) {
    try {
      const user = this.users.get(username);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate update data
      const allowedFields = ['email', 'fullName', 'role', 'isActive'];
      const updates = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates[key] = value;
        }
      }

      // Update user
      Object.assign(user, updates);
      this.users.set(username, user);

      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw new Error(`User update failed: ${error.message}`);
    }
  }

  // Delete user (admin only)
  deleteUser(username) {
    if (username === 'admin') {
      throw new Error('Cannot delete default admin user');
    }

    const deleted = this.users.delete(username);
    if (!deleted) {
      throw new Error('User not found');
    }

    // Clean up any active sessions for this user
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.username === username) {
        this.sessions.delete(sessionId);
      }
    }

    return true;
  }

  // Change password
  async changePassword(username, currentPassword, newPassword) {
    try {
      const user = this.users.get(username);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.authMiddleware.comparePassword(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      // Hash and update password
      user.password = await this.authMiddleware.hashPassword(newPassword);
      this.users.set(username, user);

      return true;
    } catch (error) {
      throw new Error(`Password change failed: ${error.message}`);
    }
  }

  // Logout user
  logout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  // Get active sessions
  getActiveSessions() {
    return Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      username: session.username,
      role: session.role,
      loginTime: session.loginTime,
      lastActivity: session.lastActivity,
      isActive: session.isActive
    }));
  }

  // Validate session
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    // Check session timeout (1 hour)
    const now = new Date();
    const sessionAge = now - session.lastActivity;
    const timeout = parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 3600000; // 1 hour

    if (sessionAge > timeout) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      return false;
    }

    // Update last activity
    session.lastActivity = now;
    return true;
  }

  // Clean up expired sessions
  cleanupExpiredSessions() {
    const now = new Date();
    const timeout = parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 3600000; // 1 hour

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActivity;
      if (sessionAge > timeout) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get user statistics
  getUserStatistics() {
    const users = Array.from(this.users.values());
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive);

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      counselorUsers: users.filter(u => u.role === 'counselor').length,
      activeSessions: activeSessions.length,
      recentLogins: users.filter(u => u.lastLogin && (new Date() - u.lastLogin) < 86400000).length // Last 24 hours
    };
  }
}

module.exports = UserManagementService;