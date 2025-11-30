// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Middleware personnalisés
const { helmetMiddleware, corsMiddleware, rateLimiter } = require('./middleware/security.middleware');
const errorHandler = require('./middleware/error.middleware');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth.routes');
const accountRoutes = require('./routes/account.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware de sécurité
// ============================================
app.use(helmetMiddleware());
app.use(corsMiddleware());
app.use(rateLimiter());

// ============================================
// Middleware standards
// ============================================
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Health check endpoint
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'SecureBank API',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// ============================================
// API Routes
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
// app.use('/api/transactions', transactionRoutes); // À venir
// app.use('/api/users', userRoutes); // À venir

// Basic test endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: 'SecureBank API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// 404 handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /health',
      'GET /api/test',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/refresh',
      'GET /api/auth/me'
    ]
  });
});

// ============================================
// Error handling middleware (doit être en dernier)
// ============================================
app.use(errorHandler);

// ============================================
// Start server
// ============================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║       🚀 SecureBank API Started       ║
╠════════════════════════════════════════╣
║ Port:        ${PORT}                        ║
║ Environment: ${process.env.NODE_ENV || 'development'}              ║
║ Health:      http://localhost:${PORT}/health  ║
║ API Docs:    http://localhost:${PORT}/api     ║
╚════════════════════════════════════════╝
    `);
    
    logger.info('SecureBank API server started', {
      port: PORT,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
  });
}

module.exports = app;