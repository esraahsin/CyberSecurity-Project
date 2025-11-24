/**
 * Tests pour le logger
 */

const logger = require('../../src/utils/logger');

describe('Logger Utils', () => {
  
  // Mock console pour éviter les logs pendant les tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Logger instance', () => {
    test('should be defined', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
    });

    test('should have custom methods', () => {
      expect(typeof logger.logRequest).toBe('function');
      expect(typeof logger.logError).toBe('function');
      expect(typeof logger.logSecurity).toBe('function');
    });

    test('should have stream for Morgan', () => {
      expect(logger.stream).toBeDefined();
      expect(typeof logger.stream.write).toBe('function');
    });
  });

  describe('logRequest()', () => {
    test('should log HTTP request information', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/users',
        ip: '127.0.0.1',
        user: { id: '123' }
      };

      expect(() => {
        logger.logRequest(mockReq, 'Test request');
      }).not.toThrow();
    });

    test('should handle request without user', () => {
      const mockReq = {
        method: 'POST',
        url: '/api/auth/login',
        ip: '192.168.1.1'
      };

      expect(() => {
        logger.logRequest(mockReq);
      }).not.toThrow();
    });
  });

  describe('logError()', () => {
    test('should log error with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'login' };

      expect(() => {
        logger.logError(error, context);
      }).not.toThrow();
    });

    test('should handle error without context', () => {
      const error = new Error('Simple error');

      expect(() => {
        logger.logError(error);
      }).not.toThrow();
    });
  });

  describe('logSecurity()', () => {
    test('should log security event', () => {
      const event = 'FAILED_LOGIN';
      const details = { 
        ip: '192.168.1.1',
        username: 'testuser',
        attempts: 3 
      };

      expect(() => {
        logger.logSecurity(event, details);
      }).not.toThrow();
    });

    test('should handle event without details', () => {
      expect(() => {
        logger.logSecurity('SUSPICIOUS_ACTIVITY');
      }).not.toThrow();
    });
  });

  describe('stream.write()', () => {
    test('should write message to stream', () => {
      const message = 'HTTP Request log\n';
      
      expect(() => {
        logger.stream.write(message);
      }).not.toThrow();
    });

    test('should trim whitespace from message', () => {
      const message = '  Test message  \n';
      
      expect(() => {
        logger.stream.write(message);
      }).not.toThrow();
    });
  });

  describe('Standard logging methods', () => {
    test('should log info messages', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    test('should log error messages', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    test('should log warning messages', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    test('should log debug messages', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });
});