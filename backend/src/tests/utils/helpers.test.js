/**
 * Tests pour les helpers
 */

const {
  generateToken,
  generateId,
  sleep,
  formatDate,
  dateDiff,
  truncate,
  capitalize,
  slugify,
  isValidEmail,
  isValidUrl,
  maskString,
  hashString,
  paginate,
  paginationMeta,
  cleanObject,
  pick,
  omit
} = require('../../src/utils/helpers');

describe('Helpers Utils', () => {

  describe('generateToken()', () => {
    test('should generate token with default length', () => {
      const token = generateToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    test('should generate token with custom length', () => {
      const token = generateToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    test('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateId()', () => {
    test('should generate valid UUID', () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('sleep()', () => {
    test('should pause execution', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(95);
    });
  });

  describe('formatDate()', () => {
    test('should format date to ISO string', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2024-01-01T12:00:00.000Z');
    });

    test('should use current date if none provided', () => {
      const formatted = formatDate();
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('dateDiff()', () => {
    test('should calculate difference between dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-03');
      const diff = dateDiff(date1, date2);
      
      expect(diff.days).toBe(2);
      expect(diff.hours).toBe(0);
      expect(diff.minutes).toBe(0);
    });

    test('should handle reversed dates', () => {
      const date1 = new Date('2024-01-03');
      const date2 = new Date('2024-01-01');
      const diff = dateDiff(date1, date2);
      
      expect(diff.days).toBe(2);
    });
  });

  describe('truncate()', () => {
    test('should truncate long text', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = truncate(text, 20);
      expect(result).toBe('This is a very lo...');
    });

    test('should not truncate short text', () => {
      const text = 'Short text';
      const result = truncate(text, 20);
      expect(result).toBe('Short text');
    });

    test('should use custom suffix', () => {
      const text = 'This is a long text';
      const result = truncate(text, 10, '***');
      expect(result).toBe('This is***');
    });
  });

  describe('capitalize()', () => {
    test('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
    });

    test('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('slugify()', () => {
    test('should create valid slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Test Product 123')).toBe('test-product-123');
    });

    test('should remove special characters', () => {
      expect(slugify('Hello @World!')).toBe('hello-world');
    });

    test('should handle multiple spaces', () => {
      expect(slugify('Hello    World')).toBe('hello-world');
    });
  });

  describe('isValidEmail()', () => {
    test('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('isValidUrl()', () => {
    test('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://test.org/path')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(true); // FTP is valid
    });
  });

  describe('maskString()', () => {
    test('should mask string correctly', () => {
      const result = maskString('1234567890', 4, 4);
      expect(result).toBe('1234**7890');
    });

    test('should not mask short strings', () => {
      const result = maskString('12345', 4, 4);
      expect(result).toBe('12345');
    });

    test('should use custom mask character', () => {
      const result = maskString('1234567890', 2, 2, '#');
      expect(result).toBe('12######90');
    });
  });

  describe('hashString()', () => {
    test('should generate SHA256 hash', () => {
      const hash = hashString('test');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA256 = 64 hex chars
    });

    test('should generate consistent hash', () => {
      const hash1 = hashString('test');
      const hash2 = hashString('test');
      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different inputs', () => {
      const hash1 = hashString('test1');
      const hash2 = hashString('test2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('paginate()', () => {
    test('should calculate pagination correctly', () => {
      const result = paginate(1, 10);
      expect(result).toEqual({ offset: 0, limit: 10, page: 1 });
    });

    test('should handle page 2', () => {
      const result = paginate(2, 10);
      expect(result).toEqual({ offset: 10, limit: 10, page: 2 });
    });

    test('should enforce maximum limit', () => {
      const result = paginate(1, 200);
      expect(result.limit).toBe(100); // Max 100
    });

    test('should handle invalid page numbers', () => {
      const result = paginate(0, 10);
      expect(result.page).toBe(1); // Min 1
    });
  });

  describe('paginationMeta()', () => {
    test('should generate correct metadata', () => {
      const meta = paginationMeta(50, 1, 10);
      expect(meta).toEqual({
        total: 50,
        page: 1,
        limit: 10,
        totalPages: 5,
        hasNext: true,
        hasPrev: false
      });
    });

    test('should handle last page', () => {
      const meta = paginationMeta(50, 5, 10);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });
  });

  describe('cleanObject()', () => {
    test('should remove null and undefined values', () => {
      const obj = { a: 1, b: null, c: undefined, d: 'test' };
      const result = cleanObject(obj);
      expect(result).toEqual({ a: 1, d: 'test' });
    });

    test('should keep empty strings', () => {
      const obj = { a: '', b: null };
      const result = cleanObject(obj);
      expect(result).toEqual({ a: '' });
    });
  });

  describe('pick()', () => {
    test('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = pick(obj, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    test('should ignore non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ['a', 'z']);
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('omit()', () => {
    test('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(obj, ['b', 'd']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    test('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ['z']);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });
});