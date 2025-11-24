/**
 * Tests pour les validators
 */

const {
  validatePassword,
  validateEmail,
  validateUsername,
  validatePhone,
  validateUrl,
  validateDate,
  validateUUID,
  validateMongoId,
  validateRole,
  validateIP,
  validatePort,
  validateSeverity,
  validateStatus,
  validateRange,
  validateLength,
  validateJSON,
  createValidator
} = require('../../src/utils/validators');

describe('Validators Utils', () => {

  describe('validatePassword()', () => {
    test('should accept strong password', () => {
      const result = validatePassword('Strong123!@#');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject short password', () => {
      const result = validatePassword('Pass1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should reject password without uppercase', () => {
      const result = validatePassword('password123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('should reject password without numbers', () => {
      const result = validatePassword('Password!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('should reject password without special characters', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    test('should reject too long password', () => {
      const longPassword = 'A'.repeat(130) + '1!';
      const result = validatePassword(longPassword);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });
  });

  describe('validateEmail()', () => {
    test('should accept valid email', () => {
      const result = validateEmail('test@example.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject invalid email format', () => {
      const result = validateEmail('not-an-email');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    test('should reject too long email', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = validateEmail(longEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is too long');
    });

    test('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });
  });

  describe('validateUsername()', () => {
    test('should accept valid username', () => {
      const result = validateUsername('john_doe-123');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject short username', () => {
      const result = validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters long');
    });

    test('should reject username with special characters', () => {
      const result = validateUsername('john@doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('can only contain');
    });

    test('should reject too long username', () => {
      const result = validateUsername('a'.repeat(35));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username must not exceed 30 characters');
    });
  });

  describe('validatePhone()', () => {
    test('should accept valid phone numbers', () => {
      expect(validatePhone('+1234567890').valid).toBe(true);
      expect(validatePhone('1234567890').valid).toBe(true);
    });

    test('should reject invalid phone', () => {
      const result = validatePhone('123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });
  });

  describe('validateUrl()', () => {
    test('should accept valid URLs', () => {
      expect(validateUrl('https://example.com').valid).toBe(true);
      expect(validateUrl('http://test.org/path').valid).toBe(true);
    });

    test('should reject invalid URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    test('should accept URL without protocol when not required', () => {
      const result = validateUrl('example.com', { requireProtocol: false });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateDate()', () => {
    test('should accept valid ISO date', () => {
      const result = validateDate('2024-01-01T00:00:00.000Z');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject invalid date format', () => {
      const result = validateDate('01/01/2024');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid date format (use ISO 8601)');
    });

    test('should reject invalid date', () => {
      const result = validateDate('2024-13-45');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateUUID()', () => {
    test('should accept valid UUID', () => {
      const result = validateUUID('550e8400-e29b-41d4-a716-446655440000');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject invalid UUID', () => {
      const result = validateUUID('not-a-uuid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid UUID format');
    });
  });

  describe('validateMongoId()', () => {
    test('should accept valid MongoDB ObjectId', () => {
      const result = validateMongoId('507f1f77bcf86cd799439011');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject invalid ObjectId', () => {
      const result = validateMongoId('invalid-id');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid ID format');
    });
  });

  describe('validateRole()', () => {
    test('should accept valid role', () => {
      const result = validateRole('admin');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject invalid role', () => {
      const result = validateRole('superadmin');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Role must be one of');
    });

    test('should accept custom roles list', () => {
      const result = validateRole('editor', ['admin', 'editor', 'viewer']);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateIP()', () => {
    test('should accept valid IPv4', () => {
      const result = validateIP('192.168.1.1', 4);
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept valid IPv6', () => {
      const result = validateIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334', 6);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid IP', () => {
      const result = validateIP('999.999.999.999');
      expect(result.valid).toBe(false);
    });

    test('should accept both IPv4 and IPv6 when version not specified', () => {
      expect(validateIP('192.168.1.1').valid).toBe(true);
      expect(validateIP('::1').valid).toBe(true);
    });
  });

  describe('validatePort()', () => {
    test('should accept valid port', () => {
      expect(validatePort(80).valid).toBe(true);
      expect(validatePort('8080').valid).toBe(true);
    });

    test('should reject invalid port', () => {
      expect(validatePort(70000).valid).toBe(false);
      expect(validatePort(-1).valid).toBe(false);
    });
  });

  describe('validateSeverity()', () => {
    test('should accept valid severity levels', () => {
      expect(validateSeverity('critical').valid).toBe(true);
      expect(validateSeverity('high').valid).toBe(true);
      expect(validateSeverity('medium').valid).toBe(true);
      expect(validateSeverity('low').valid).toBe(true);
      expect(validateSeverity('info').valid).toBe(true);
    });

    test('should reject invalid severity', () => {
      const result = validateSeverity('extreme');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Severity must be one of');
    });

    test('should be case-insensitive', () => {
      expect(validateSeverity('CRITICAL').valid).toBe(true);
    });
  });

  describe('validateStatus()', () => {
    test('should accept allowed status', () => {
      const result = validateStatus('active', ['active', 'inactive', 'pending']);
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject disallowed status', () => {
      const result = validateStatus('deleted', ['active', 'inactive']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Status must be one of');
    });
  });

  describe('validateRange()', () => {
    test('should accept value in range', () => {
      const result = validateRange(50, 0, 100);
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject value below minimum', () => {
      const result = validateRange(-1, 0, 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 0 and 100');
    });

    test('should reject value above maximum', () => {
      const result = validateRange(150, 0, 100);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateLength()', () => {
    test('should accept string within length limits', () => {
      const result = validateLength('test', 1, 10);
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject too short string', () => {
      const result = validateLength('ab', 5, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5');
    });

    test('should reject too long string', () => {
      const result = validateLength('verylongstring', 1, 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not exceed 5');
    });
  });

  describe('validateJSON()', () => {
    test('should accept valid JSON', () => {
      const result = validateJSON('{"key": "value"}');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
      expect(result.data).toEqual({ key: 'value' });
    });

    test('should reject invalid JSON', () => {
      const result = validateJSON('{invalid json}');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
      expect(result.data).toBe(null);
    });

    test('should reject non-string', () => {
      const result = validateJSON(123);
      expect(result.valid).toBe(false);
    });
  });

  describe('createValidator()', () => {
    test('should create custom validator', () => {
      const isEven = createValidator(
        (value) => value % 2 === 0,
        'Value must be even'
      );
      
      expect(isEven(4).valid).toBe(true);
      expect(isEven(5).valid).toBe(false);
      expect(isEven(5).error).toBe('Value must be even');
    });

    test('should handle errors in validator function', () => {
      const validator = createValidator(
        (value) => { throw new Error('Test error'); },
        'Validation failed'
      );
      
      const result = validator('test');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Validation failed');
    });
  });
});