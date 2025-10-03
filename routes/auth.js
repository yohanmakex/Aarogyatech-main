const express = require('express');
const AuthMiddleware = require('../middleware/authMiddleware');
const UserManagementService = require('../services/userManagementService');

const router = express.Router();
const authMiddleware = new AuthMiddleware();
const userManagementService = new UserManagementService();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

    // Wait for service initialization
    await userManagementService.waitForInitialization();

    const authResult = await userManagementService.authenticateUser(username, password);

    res.status(200).json({
      message: 'Login successful',
      ...authResult
    });
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// Logout endpoint
router.post('/logout', authMiddleware.authenticate, (req, res) => {
  try {
    const sessionId = req.user.sessionId;
    const success = userManagementService.logout(sessionId);

    if (success) {
      res.status(200).json({
        message: 'Logout successful'
      });
    } else {
      res.status(400).json({
        error: 'Logout failed',
        message: 'Session not found or already expired'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware.authenticate, async (req, res) => {
  try {
    await userManagementService.waitForInitialization();
    const user = userManagementService.getUserByUsername(req.user.username);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.status(200).json({
      user
    });
  } catch (error) {
    res.status(500).json({
      error: 'Profile retrieval failed',
      message: error.message
    });
  }
});

// Change password
router.post('/change-password', authMiddleware.authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Current password and new password are required'
      });
    }

    await userManagementService.waitForInitialization();
    await userManagementService.changePassword(req.user.username, currentPassword, newPassword);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Password change failed',
      message: error.message
    });
  }
});

// Validate session endpoint
router.get('/validate', authMiddleware.authenticate, (req, res) => {
  try {
    const isValid = userManagementService.validateSession(req.user.sessionId);
    
    if (isValid) {
      res.status(200).json({
        valid: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        }
      });
    } else {
      res.status(401).json({
        valid: false,
        message: 'Session expired or invalid'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Session validation failed',
      message: error.message
    });
  }
});

// Admin-only routes
// Create new user (admin only)
router.post('/users', authMiddleware.authenticate, authMiddleware.adminOnly, async (req, res) => {
  try {
    const userData = req.body;
    const newUser = await userManagementService.createUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    res.status(400).json({
      error: 'User creation failed',
      message: error.message
    });
  }
});

// Get all users (admin only)
router.get('/users', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const users = userManagementService.getAllUsers();
    
    res.status(200).json({
      users,
      total: users.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve users',
      message: error.message
    });
  }
});

// Get specific user (admin only)
router.get('/users/:username', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const { username } = req.params;
    const user = userManagementService.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with username '${username}' not found`
      });
    }

    res.status(200).json({
      user
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve user',
      message: error.message
    });
  }
});

// Update user (admin only)
router.put('/users/:username', authMiddleware.authenticate, authMiddleware.adminOnly, async (req, res) => {
  try {
    const { username } = req.params;
    const updateData = req.body;

    const updatedUser = await userManagementService.updateUser(username, updateData);

    res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({
      error: 'User update failed',
      message: error.message
    });
  }
});

// Delete user (admin only)
router.delete('/users/:username', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const { username } = req.params;
    userManagementService.deleteUser(username);

    res.status(200).json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      error: 'User deletion failed',
      message: error.message
    });
  }
});

// Get active sessions (admin only)
router.get('/sessions', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const sessions = userManagementService.getActiveSessions();
    
    res.status(200).json({
      sessions,
      total: sessions.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      message: error.message
    });
  }
});

// Get user statistics (admin only)
router.get('/stats/users', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    const stats = userManagementService.getUserStatistics();
    
    res.status(200).json({
      statistics: stats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve user statistics',
      message: error.message
    });
  }
});

// Cleanup expired sessions (admin only)
router.post('/sessions/cleanup', authMiddleware.authenticate, authMiddleware.adminOnly, (req, res) => {
  try {
    userManagementService.cleanupExpiredSessions();
    
    res.status(200).json({
      message: 'Expired sessions cleaned up successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Session cleanup failed',
      message: error.message
    });
  }
});

module.exports = router;