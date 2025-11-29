// backend/src/tests/setup.js

// Définir NODE_ENV en test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.LOG_LEVEL = 'error'; // Réduire les logs en test

// Mock console pour réduire le bruit
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// Supprimer les logs non critiques en test
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  // Garder error et warn pour le debug
  error: originalConsole.error,
  warn: originalConsole.warn
};

// Cleanup après tous les tests
afterAll(async () => {
  // Fermer toutes les connexions
  await new Promise(resolve => setTimeout(resolve, 500));
});