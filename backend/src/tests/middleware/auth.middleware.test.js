// tests/auth.middleware.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../test/app.test');

// Mock de redisClient utilisé par ton middleware
jest.mock('../config/redis', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}));
const redisClient = require('../config/redis');

const jwtConfig = require('../config/jwt'); // assure-toi que refreshSecret, secret existent dans ce fichier

describe('Auth middlewares', () => {
  const userPayload = { userId: '123', email: 'a@b.com', role: 'user' };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 401 without token on /protected', async () => {
    const res = await request(app).get('/protected');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.statusCode).toBe(403).or.toBe(401); // depending de ton verify handler
  });

  test('should return 401 if token is blacklisted', async () => {
    // create token valid but blacklist mocked
    const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
    redisClient.get.mockImplementation(async (key) => {
      if (key.startsWith('blacklist:token:')) return '1';
      if (key === `session:${userPayload.userId}`) return JSON.stringify({}); // session exists
      return null;
    });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  test('should allow access with valid token and session', async () => {
    const token = jwt.sign(userPayload, jwtConfig.secret, { expiresIn: '1h' });
    redisClient.get.mockResolvedValueOnce(null); // blacklist check -> null
    redisClient.get.mockResolvedValueOnce(JSON.stringify({ some: 'session' })); // session check

    // note: depending sur ton impl de redis.get (si toujours utilisé two times), adapt mocks
    redisClient.get.mockImplementation(async (key) => {
      if (key === `blacklist:token:${token}`) return null;
      if (key === `session:${userPayload.userId}`) return JSON.stringify({ ok: true });
      return null;
    });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(userPayload.userId);
  });

  test('optionalAuth should not set user if no token', async () => {
    const res = await request(app).get('/optional');
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeNull();
  });
});
