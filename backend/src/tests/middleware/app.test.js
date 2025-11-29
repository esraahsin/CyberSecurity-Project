// test/app.test.js
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

// Middlewares (ton code)
const {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership,
  requireMFA,
  refreshToken
} = require('../middleware/auth.middleware');

const {
  helmetMiddleware,
  corsMiddleware,
  csrfProtection,
  getCsrfToken,
  rateLimiter,
  authRateLimiter
} = require('../middleware/security.middleware');

const {
  validateLogin,
  validateRegister,
  handleValidationErrors
} = require('../middleware/validation.middleware');

const errorHandler = require('../middleware/error.middleware');

// Mock route handlers
const router = express.Router();

function createApp() {
  const app = express();
  app.use(bodyParser.json());
  app.use(cookieParser());

  // Security middlewares (global)
  app.use(helmetMiddleware());
  app.use(corsMiddleware());
  app.use(rateLimiter());

  // --- Test routes ---

  // Health
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Authenticated route
  app.get('/protected', authenticateToken, (req, res) => {
    res.json({ user: req.user });
  });

  // Optional auth route
  app.get('/optional', optionalAuth, (req, res) => {
    res.json({ user: req.user || null });
  });

  // Role protected
  app.get('/admin-only', authenticateToken, requireRole(['admin']), (req, res) => {
    res.json({ admin: true });
  });

  // Ownership
  app.get('/users/:userId', authenticateToken, requireOwnership('userId'), (req, res) => {
    res.json({ userId: req.params.userId });
  });

  // MFA
  app.get('/mfa-only', authenticateToken, requireMFA, (req, res) => {
    res.json({ mfa: true });
  });

  // Refresh token endpoint (uses the actual function to be tested)
  app.post('/auth/refresh', express.json(), refreshToken);

  // CSRF token route
  app.get('/csrf-token', authenticateToken, getCsrfToken);

  // CSRF protected route
  app.post('/sensitive', authenticateToken, csrfProtection(), (req, res) => {
    res.json({ success: true });
  });

  // Validation: register
  app.post('/register', validateRegister, (req, res) => {
    res.json({ ok: true });
  });

  // Login route with authRateLimiter
  app.post('/auth/login', authRateLimiter(), validateLogin, (req, res) => {
    // simulate login failure/success based on test
    if (req.body.email === 'fail@example.com') {
      // simulate failure
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ token: 'ok' });
  });

  // Route to intentionally throw error for testing error middleware
  app.get('/error-throw', (req, res) => {
    const e = new Error('Test error');
    e.status = 418;
    throw e;
  });

  // Attach error handler LAST
  app.use(errorHandler);

  return app;
}

module.exports = createApp();
