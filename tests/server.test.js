const request = require('supertest');
const { app } = require('../server');

describe('MindCare AI Backend', () => {
  describe('GET /', () => {
    it('should return basic server information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.message).toBe('MindCare AI Mental Health Assistant Backend');
    });
  });

  describe('GET /health', () => {
    it('should return health check information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      expect(response.body.message).toBe('MindCare AI Backend is running');
    });
  });

  describe('GET /api/status', () => {
    it('should return API status information', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('operational');
      expect(response.body.services).toHaveProperty('server');
      expect(response.body.services).toHaveProperty('huggingface');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.error).toBe('Endpoint not found');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      await request(app)
        .options('/')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
    });
  });
});