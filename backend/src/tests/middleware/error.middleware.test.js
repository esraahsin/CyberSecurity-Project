// tests/error.middleware.test.js
const request = require('supertest');
const app = require('../test/app.test');

describe('Error middleware', () => {
  test('should format thrown errors', async () => {
    const res = await request(app).get('/error-throw');
    expect([418, 500]).toContain(res.statusCode);
    expect(res.body.error).toBeDefined();
    expect(res.body.message).toBeDefined();
  });
});
