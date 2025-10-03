const request = require('supertest');
const { app } = require('../server');
const UserManagementService = require('../services/userManagementService');
const AuthMiddleware = require('../middleware/authMiddleware');

describe('Authentication System', () => {
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

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('admin');
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing credentials');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123!'
        });
      authToken = loginResponse.body.token;
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('admin');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /api/auth/users (Admin Only)', () => {
    let adminToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123!'
        });
      adminToken = loginResponse.body.token;
    });

    test('should create new user with admin token', async () => {
      const newUser = {
        username: 'testcounselor',
        password: 'testpass123!',
        email: 'test@mindcare.edu',
        fullName: 'Test Counselor',
        role: 'counselor'
      };

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testcounselor');
      expect(response.body.user.role).toBe('counselor');
    });

    test('should reject duplicate username', async () => {
      const duplicateUser = {
        username: 'admin',
        password: 'testpass123!',
        email: 'duplicate@mindcare.edu',
        fullName: 'Duplicate User',
        role: 'counselor'
      };

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUser);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Username already exists');
    });
  });

  describe('GET /api/auth/users (Admin Only)', () => {
    let adminToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123!'
        });
      adminToken = loginResponse.body.token;
    });

    test('should get all users with admin token', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/change-password', () => {
    test('should change password with valid current password', async () => {
      // Get fresh login token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'counselor',
          password: 'counselor123!'
        });
      
      const authToken = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'counselor123!',
          newPassword: 'newpassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');
    });

    test('should reject incorrect current password', async () => {
      // Get fresh login token with original password (before any changes)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin', // Use admin instead of counselor to avoid password change conflicts
          password: 'admin123!'
        });
      
      const authToken = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Current password is incorrect');
    });
  });


});