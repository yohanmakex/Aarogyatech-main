const AuthMiddleware = require('../middleware/authMiddleware');
const UserManagementService = require('../services/userManagementService');

// Mock the server imports to avoid starting all services
jest.mock('../server', () => ({
  app: {},
  server: {}
}));

describe('Authentication Unit Tests', () => {
  let userManagementService;
  let authMiddleware;

  beforeEach(async () => {
    userManagementService = new UserManagementService();
    authMiddleware = new AuthMiddleware();
    // Wait for initialization to complete
    await userManagementService.waitForInitialization();
  });

  afterEach(() => {
    // Clean up any timers or async operations
    if (userManagementService) {
      userManagementService.cleanupExpiredSessions();
    }
  });

  describe('AuthMiddleware', () => {
    test('should hash and compare passwords correctly', async () => {
      const password = 'testpassword123!';
      const hashedPassword = await authMiddleware.hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      
      const isMatch = await authMiddleware.comparePassword(password, hashedPassword);
      expect(isMatch).toBe(true);
      
      const isWrongMatch = await authMiddleware.comparePassword('wrongpassword', hashedPassword);
      expect(isWrongMatch).toBe(false);
    });

    test('should generate and verify JWT tokens', () => {
      const user = {
        id: 'test-id',
        username: 'testuser',
        role: 'counselor',
        sessionId: 'test-session'
      };

      const token = authMiddleware.generateToken(user);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = authMiddleware.verifyToken(token);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
    });

    test('should validate user input correctly', () => {
      const validUser = {
        username: 'testuser',
        password: 'testpass123!',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'counselor'
      };

      const errors = authMiddleware.validateUserInput(validUser, true);
      expect(errors).toHaveLength(0);

      const invalidUser = {
        username: 'ab', // too short
        password: '123', // too short
        email: 'invalid-email',
        fullName: 'T', // too short
        role: 'invalid-role'
      };

      const invalidErrors = authMiddleware.validateUserInput(invalidUser, true);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });
  });

  describe('UserManagementService', () => {
    test('should initialize with default users', () => {
      const users = userManagementService.getAllUsers();
      expect(users.length).toBeGreaterThanOrEqual(2);
      
      const adminUser = users.find(u => u.username === 'admin');
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe('admin');
      
      const counselorUser = users.find(u => u.username === 'counselor');
      expect(counselorUser).toBeDefined();
      expect(counselorUser.role).toBe('counselor');
    });

    test('should manage sessions correctly', async () => {
      const authResult = await userManagementService.authenticateUser('admin', 'admin123!');
      expect(authResult.sessionId).toBeDefined();

      const isValid = userManagementService.validateSession(authResult.sessionId);
      expect(isValid).toBe(true);

      const sessions = userManagementService.getActiveSessions();
      expect(sessions.length).toBeGreaterThan(0);

      const logoutSuccess = userManagementService.logout(authResult.sessionId);
      expect(logoutSuccess).toBe(true);

      const isValidAfterLogout = userManagementService.validateSession(authResult.sessionId);
      expect(isValidAfterLogout).toBe(false);
    });

    test('should provide user statistics', () => {
      const stats = userManagementService.getUserStatistics();
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('activeUsers');
      expect(stats).toHaveProperty('adminUsers');
      expect(stats).toHaveProperty('counselorUsers');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('recentLogins');
    });

    test('should handle password changes correctly', async () => {
      // Test correct password change
      const result = await userManagementService.changePassword('counselor', 'counselor123!', 'newpassword123!');
      expect(result).toBe(true);

      // Test authentication with new password
      const authResult = await userManagementService.authenticateUser('counselor', 'newpassword123!');
      expect(authResult.token).toBeDefined();

      // Test incorrect current password
      await expect(
        userManagementService.changePassword('counselor', 'wrongpassword', 'anotherpassword123!')
      ).rejects.toThrow('Current password is incorrect');
    });

    test('should create and manage users', async () => {
      const newUser = {
        username: 'testcounselor',
        password: 'testpass123!',
        email: 'test@mindcare.edu',
        fullName: 'Test Counselor',
        role: 'counselor'
      };

      const createdUser = await userManagementService.createUser(newUser);
      expect(createdUser.username).toBe('testcounselor');
      expect(createdUser.role).toBe('counselor');
      expect(createdUser.password).toBeUndefined(); // Password should not be returned

      // Test duplicate username
      await expect(
        userManagementService.createUser(newUser)
      ).rejects.toThrow('Username already exists');

      // Test user retrieval
      const retrievedUser = userManagementService.getUserByUsername('testcounselor');
      expect(retrievedUser).toBeDefined();
      expect(retrievedUser.username).toBe('testcounselor');

      // Test user update
      const updatedUser = await userManagementService.updateUser('testcounselor', {
        fullName: 'Updated Test Counselor',
        isActive: false
      });
      expect(updatedUser.fullName).toBe('Updated Test Counselor');
      expect(updatedUser.isActive).toBe(false);

      // Test user deletion
      const deleteResult = userManagementService.deleteUser('testcounselor');
      expect(deleteResult).toBe(true);

      const deletedUser = userManagementService.getUserByUsername('testcounselor');
      expect(deletedUser).toBeNull();
    });
  });
});