// tests/validation.middleware.test.js
const request = require('supertest');
const app = require('../test/app.test');

describe('Validation middleware', () => {
  test('register should fail with invalid email', async () => {
    const res = await request(app)
      .post('/register')
      .send({
        email: 'not-an-email',
        username: 'u',
        password: 'weak',
        firstName: 'A',
        lastName: 'B'
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});
