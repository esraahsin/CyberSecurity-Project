/**
 * Tests pour le sanitizer
 */

const {
  sanitizeHtml,
  sanitizeString,
  sanitizeEmail,
  sanitizeUrl,
  sanitizePhone,
  sanitizeObject,
  sanitizeFilePath,
  sanitizeFilename,
  sanitizeSearchQuery,
  sanitizeForLogging,
  sanitizePaginationParams
} = require('../../utils/sanitizer');

describe('Sanitizer Utils', () => {

  describe('sanitizeHtml()', () => {
    test('should escape HTML characters', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    test('should handle regular text', () => {
      expect(sanitizeHtml('Hello World')).toBe('Hello World');
    });

    test('should return non-string values unchanged', () => {
      expect(sanitizeHtml(123)).toBe(123);
      expect(sanitizeHtml(null)).toBe(null);
    });
  });

  describe('sanitizeString()', () => {
    test('should remove control characters', () => {
      const result = sanitizeString('Hello\x00World\x1F');
      expect(result).toBe('HelloWorld');
    });

    test('should trim whitespace', () => {
      const result = sanitizeString('  Hello World  ');
      expect(result).toBe('Hello World');
    });

    test('should handle non-string values', () => {
      expect(sanitizeString(123)).toBe(123);
    });
  });

  describe('sanitizeEmail()', () => {
    test('should normalize valid email', () => {
      const result = sanitizeEmail('TEST@EXAMPLE.COM');
      expect(result).toBe('test@example.com');
    });

    test('should return null for invalid email', () => {
      expect(sanitizeEmail('not-an-email')).toBe(null);
      expect(sanitizeEmail('test@')).toBe(null);
    });

    test('should handle non-string values', () => {
      expect(sanitizeEmail(123)).toBe(null);
    });
  });

  describe('sanitizeUrl()', () => {
    test('should accept valid URLs', () => {
      const result = sanitizeUrl('https://example.com');
      expect(result).toBe('https://example.com');
    });

    test('should reject invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBe(null);
      expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
    });

    test('should trim whitespace', () => {
      const result = sanitizeUrl('  https://example.com  ');
      expect(result).toBe('https://example.com');
    });
  });

  describe('sanitizePhone()', () => {
    test('should keep valid phone characters', () => {
      const result = sanitizePhone('+1 (555) 123-4567');
      expect(result).toBe('+1(555)123-4567');
    });

    test('should remove invalid characters', () => {
      const result = sanitizePhone('555-CALL-NOW');
      expect(result).toBe('555--');
    });

    test('should handle non-string values', () => {
      expect(sanitizePhone(123)).toBe('');
    });
  });

  describe('sanitizeObject()', () => {
    test('should sanitize object recursively', () => {
      const obj = {
        name: '  John  ',
        email: '<script>test@test.com</script>',
        nested: {
          value: '  test  '
        }
      };
      
      const result = sanitizeObject(obj);
      expect(result.name).toBe('John');
      expect(result.email).not.toContain('<script>');
      expect(result.nested.value).toBe('test');
    });

    test('should handle arrays', () => {
      const obj = {
        items: ['  item1  ', '  item2  ']
      };
      
      const result = sanitizeObject(obj);
      expect(result.items).toEqual(['item1', 'item2']);
    });

    test('should remove empty values when option is set', () => {
      const obj = {
        name: 'John',
        email: '',
        age: null
      };
      
      const result = sanitizeObject(obj, { removeEmpty: true });
      expect(result).toEqual({ name: 'John' });
    });

    test('should not escape HTML when option is disabled', () => {
      const obj = { html: '<b>Bold</b>' };
      const result = sanitizeObject(obj, { escapeHtml: false });
      expect(result.html).toBe('<b>Bold</b>');
    });
  });

  describe('sanitizeFilePath()', () => {
    test('should remove path traversal attempts', () => {
      const result = sanitizeFilePath('../../etc/passwd');
      expect(result).toBe('etc/passwd');
    });

    test('should remove dangerous characters', () => {
      const result = sanitizeFilePath('file<>:"|?*.txt');
      expect(result).toBe('file.txt');
    });

    test('should remove leading slashes', () => {
      const result = sanitizeFilePath('///path/to/file');
      expect(result).toBe('path/to/file');
    });
  });

  describe('sanitizeFilename()', () => {
    test('should create safe filename', () => {
      const result = sanitizeFilename('my file (2024).txt');
      expect(result).toBe('my_file__2024_.txt');
    });

    test('should reject dangerous filenames', () => {
      expect(sanitizeFilename('.')).toBe(null);
      expect(sanitizeFilename('..')).toBe(null);
      expect(sanitizeFilename('')).toBe(null);
    });

    test('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('sanitizeSearchQuery()', () => {
    test('should trim and limit search query', () => {
      const query = '  search term  ';
      const result = sanitizeSearchQuery(query);
      expect(result).toBe('search term');
    });

    test('should remove dangerous characters', () => {
      const result = sanitizeSearchQuery('search<script>');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('should limit query length', () => {
      const longQuery = 'a'.repeat(1000);
      const result = sanitizeSearchQuery(longQuery);
      expect(result.length).toBeLessThanOrEqual(500);
    });
  });

  describe('sanitizeForLogging()', () => {
    test('should redact sensitive fields', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        email: 'john@test.com'
      };
      
      const result = sanitizeForLogging(obj);
      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.email).toBe('john@test.com');
    });

    test('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          apiKey: 'secret'
        }
      };
      
      const result = sanitizeForLogging(obj);
      expect(result.user.name).toBe('John');
      expect(result.user.apiKey).toBe('[REDACTED]');
    });

    test('should handle arrays', () => {
      const obj = {
        users: [
          { name: 'John', password: 'secret' }
        ]
      };
      
      const result = sanitizeForLogging(obj);
      expect(result.users[0].password).toBe('[REDACTED]');
    });
  });

  describe('sanitizePaginationParams()', () => {
    test('should sanitize valid pagination params', () => {
      const params = { page: 2, limit: 20, sortBy: 'createdAt', order: 'desc' };
      const result = sanitizePaginationParams(params);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('createdAt');
      expect(result.order).toBe('desc');
    });

    test('should enforce minimum page', () => {
      const result = sanitizePaginationParams({ page: -1 });
      expect(result.page).toBe(1);
    });

    test('should enforce maximum limit', () => {
      const result = sanitizePaginationParams({ limit: 200 });
      expect(result.limit).toBe(100);
    });

    test('should sanitize sortBy field', () => {
      const result = sanitizePaginationParams({ sortBy: 'user.name; DROP TABLE' });
      expect(result.sortBy).toBe('username');
    });

    test('should validate order value', () => {
      const result1 = sanitizePaginationParams({ order: 'asc' });
      const result2 = sanitizePaginationParams({ order: 'invalid' });
      
      expect(result1.order).toBe('asc');
      expect(result2.order).toBeUndefined();
    });
  });
});