// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  
  // Dossier racine des tests
  rootDir: './',
  
  // Patterns de fichiers de test
  testMatch: [
    '**/src/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Fichiers à ignorer
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Coverage
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/tests/**/*.js',
    '!src/tests/setup.js'
  ],
  
  // Seuils de couverture
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Configuration pour éviter les memory leaks
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: false,
  
  // Setup global avant tous les tests
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  
  // Clear mocks entre chaque test
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Timeout
  testTimeout: 10000,
  
  // Mode verbose
  verbose: true,
  
  // Reporter de couverture
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Transform (si tu utilises Babel)
  transform: {},
  
  // Module paths
  moduleDirectories: ['node_modules', 'src']
};