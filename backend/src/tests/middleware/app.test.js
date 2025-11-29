// backend/src/tests/middleware/app.test.js
const express = require('express');
const bodyParser = require('body-parser');

// Middlewares
const {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnership,
  requireMFA,
  refreshToken
} = require('../../middleware/auth.middleware');

const {
  helmetMiddleware,
  corsMiddleware,
  csrfProtection,
  getCsrfToken,
  rateLimiter,
  authRateLimiter
} = require('../../middleware/security.middleware');

const {
  validateLogin,
  validateRegister
} = require('../../middleware/validation.middleware');

const errorHandler = require('../../middleware/error.middleware');

function createApp() {
  const app = express();

  // Middlewares de base
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Security middlewares
  app.use(helmetMiddleware());
  app.use(corsMiddleware());
  app.use(rateLimiter());

  // Routes de test
  // Health check
  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  // Route protégée
  app.get('/protected', authenticateToken, (req, res) => {
    res.json({ user: req.user });
  });

  // Route avec auth optionnelle
  app.get('/optional', optionalAuth, (req, res) => {
    res.json({ user: req.user || null });
  });

  // Route admin seulement
  app.get('/admin-only', authenticateToken, requireRole(['admin']), (req, res) => {
    res.json({ admin: true });
  });

  // Route avec vérification de propriété
  app.get('/users/:userId', authenticateToken, requireOwnership('userId'), (req, res) => {
    res.json({ userId: req.params.userId });
  });

  // Route MFA
  app.get('/mfa-only', authenticateToken, requireMFA, (req, res) => {
    res.json({ mfa: true });
  });

  // Refresh token
  app.post('/auth/refresh', refreshToken);

  // CSRF token
  app.get('/csrf-token', authenticateToken, getCsrfToken);

  // Route protégée CSRF
  app.post('/sensitive', authenticateToken, csrfProtection(), (req, res) => {
    res.json({ success: true });
  });

  // Register avec validation
  app.post('/register', validateRegister, (req, res) => {
    res.json({ ok: true });
  });

  // Login avec rate limiting et validation
  app.post('/auth/login', authRateLimiter(), validateLogin, (req, res) => {
    // Simuler échec/succès
    if (req.body.email === 'fail@example.com') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ token: 'ok' });
  });

  // Route pour tester le error handler
  app.get('/error-throw', (req, res) => {
    const e = new Error('Test error');
    e.status = 418;
    throw e;
  });

  // 404 handler (must be before error handler)
  app.use((req, res, next) => {
    const error = new Error('Route not found');
    error.status = 404;
    next(error);
  });

  // Error handler (doit être en dernier)
  app.use(errorHandler);

  return app;
}

module.exports = createApp();

// Dummy test to prevent "no tests" error
describe('Test App', () => {
  test('app should be defined', () => {
    expect(module.exports).toBeDefined();
  });
});