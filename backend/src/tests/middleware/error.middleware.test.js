// tests/middleware/error.middleware.test.js
const request = require('supertest');
const app = require('./app.test');

describe('Error middleware', () => {
  test('should format thrown errors', async () => {
    const res = await request(app).get('/error-throw');
    expect([418, 500]).toContain(res.statusCode);
    expect(res.body.error).toBeDefined();
    expect(res.body.message).toBeDefined();
  });

  test('should handle 404 errors', async () => {
    const res = await request(app).get('/nonexistent-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('should include timestamp in error response', async () => {
    const res = await request(app).get('/error-throw');
    expect(res.body.timestamp).toBeDefined();
    expect(typeof res.body.timestamp).toBe('string');
  });

  test('should include requestId if available', async () => {
    const res = await request(app).get('/error-throw');
    if (res.body.requestId) {
      expect(typeof res.body.requestId).toBe('string');
    }
  });

  test('should not expose stack traces in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).get('/error-throw');
    expect(res.body.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  test('should include stack traces in development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const res = await request(app).get('/error-throw');
    expect(res.body.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  test('should include error path in response', async () => {
    const res = await request(app).get('/error-throw');
    expect(res.body.path).toBeDefined();
  });
});