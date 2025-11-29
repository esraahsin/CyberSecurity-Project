// backend/src/tests/middleware/auth.middleware.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('./app.test');

// Mock Redis
jest.mock('../../config/redis', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}));
const redisClient = require('../../config/redis');
const jwtConfig = require('../../config/jwt');

describe('Auth Middleware Tests', () => {
  const userPayload = { 
    userId: '123', 
    email: 'test@example.com', 
    role: 'user' 
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('should return 401 without token', async () => {
      const res = await request(app).get('/protected');
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test('should return 403 with invalid token', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');
      
      expect([401, 403]).toContain(res.statusCode);
    });

    test('should return 401 if token is blacklisted', async () => {
      const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key.startsWith('blacklist:token:')) return '1';
        return null;
      });

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(401);
    });

    test('should allow access with valid token and session', async () => {
      const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key.startsWith('blacklist:')) return null;
        if (key === `session:${userPayload.userId}`) {
          return JSON.stringify({ ok: true });
        }
        return null;
      });

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(userPayload.userId);
    });
  });

  describe('optionalAuth', () => {
    test('should not require token', async () => {
      const res = await request(app).get('/optional');
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toBeNull();
    });

    test('should add user if valid token provided', async () => {
      const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key === `session:${userPayload.userId}`) {
          return JSON.stringify({ ok: true });
        }
        return null;
      });

      const res = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.user).toBeDefined();
    });
  });

  describe('requireRole', () => {
    test('should allow admin access', async () => {
      const adminPayload = { ...userPayload, role: 'admin' };
      const token = jwt.sign(adminPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key === `session:${adminPayload.userId}`) {
          return JSON.stringify({ ok: true });
        }
        return null;
      });

      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
    });

    test('should deny non-admin access', async () => {
      const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key === `session:${userPayload.userId}`) {
          return JSON.stringify({ ok: true });
        }
        return null;
      });

      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(403);
    });
  });

  describe('requireOwnership', () => {
    test('should allow user to access own resource', async () => {
      const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key === `session:${userPayload.userId}`) {
          return JSON.stringify({ ok: true });
        }
        return null;
      });

      const res = await request(app)
        .get('/users/123')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
    });

    test('should deny access to other user resources', async () => {
      const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
      
      redisClient.get.mockImplementation(async (key) => {
        if (key === `session:${userPayload.userId}`) {
          return JSON.stringify({ ok: true });
        }
        return null;
      });

      const res = await request(app)
        .get('/users/456')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(403);
    });
  });
});

console.log('✅ Auth middleware tests ready');