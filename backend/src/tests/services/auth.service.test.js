/**
 * Tests pour AuthService
 * @module tests/services/auth.service.test
 */

const authService = require('../../services/auth.service');
const pool = require('../../config/database');
const redisClient = require('../../config/redis');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock des dépendances
jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

describe('AuthService', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    const validUserData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
      dateOfBirth: '1990-01-01'
    };

    test('should register a new user successfully', async () => {
      // Mock: email n'existe pas
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // Email check
        .mockResolvedValueOnce({ rows: [] }) // Username check
        .mockResolvedValueOnce({ // Insert user
          rows: [{
            id: 1,
            email: validUserData.email,
            username: validUserData.username,
            first_name: validUserData.firstName,
            last_name: validUserData.lastName,
            created_at: new Date()
          }]
        });

      const result = await authService.register(validUserData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', validUserData.email);
      expect(result).toHaveProperty('username', validUserData.username);
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    test('should throw error if email already exists', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1 }] // Email exists
      });

      await expect(authService.register(validUserData))
        .rejects
        .toThrow('Email already exists');
    });

    test('should throw error if username already exists', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // Email doesn't exist
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Username exists

      await expect(authService.register(validUserData))
        .rejects
        .toThrow('Username already exists');
    });

    test('should hash password before storing', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1, 
            email: validUserData.email,
            username: validUserData.username,
            first_name: validUserData.firstName,
            last_name: validUserData.lastName,
            created_at: new Date()
          }] 
        });

      await authService.register(validUserData);

      // Vérifier que bcrypt a été utilisé
      const insertCall = pool.query.mock.calls[2];
      const hashedPassword = insertCall[1][2];
      
      expect(hashedPassword).not.toBe(validUserData.password);
      expect(await bcrypt.compare(validUserData.password, hashedPassword)).toBe(true);
    });
  });

  describe('login()', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      password_hash: '$2a$12$hashedpassword',
      first_name: 'John',
      last_name: 'Doe',
      account_status: 'active',
      failed_login_attempts: 0,
      account_locked_until: null,
      mfa_enabled: false,
      role: 'user'
    };

    beforeEach(() => {
      // Mock bcrypt.compare
      jest.spyOn(bcrypt, 'compare');
    });

    test('should login user successfully with valid credentials', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user
        .mockResolvedValueOnce({ rows: [] }) // Reset failed attempts
        .mockResolvedValueOnce({ rows: [] }); // Update last login

      bcrypt.compare.mockResolvedValueOnce(true);

      const result = await authService.login('test@example.com', 'password123', '127.0.0.1');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(mockUser.email);
    });

    test('should throw error for invalid credentials', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      await expect(authService.login('nonexistent@example.com', 'password', '127.0.0.1'))
        .rejects
        .toThrow('Invalid credentials');
    });

    test('should throw error if account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        account_locked_until: new Date(Date.now() + 3600000) // Locked for 1 hour
      };

      pool.query.mockResolvedValueOnce({ rows: [lockedUser] });

      await expect(authService.login('test@example.com', 'password', '127.0.0.1'))
        .rejects
        .toThrow('Account is locked');
    });

    test('should throw error if account is not active', async () => {
      const inactiveUser = {
        ...mockUser,
        account_status: 'suspended'
      };

      pool.query.mockResolvedValueOnce({ rows: [inactiveUser] });

      await expect(authService.login('test@example.com', 'password', '127.0.0.1'))
        .rejects
        .toThrow('Account is not active');
    });

    test('should increment failed attempts on wrong password', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValueOnce(false);

      await expect(authService.login('test@example.com', 'wrongpassword', '127.0.0.1'))
        .rejects
        .toThrow('Invalid credentials');

      // Vérifier que les tentatives ont été incrémentées
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('failed_login_attempts'),
        expect.any(Array)
      );
    });
  });

  describe('generateJWT()', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      role: 'user'
    };

    test('should generate valid JWT token', () => {
      const token = authService.generateJWT(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.username).toBe(mockUser.username);
    });

    test('should include issuer and audience claims', () => {
      const token = authService.generateJWT(mockUser);
      const decoded = jwt.decode(token);

      expect(decoded.iss).toBe('securebank-api');
      expect(decoded.aud).toBe('securebank-app');
    });

    test('should set expiration time', () => {
      const token = authService.generateJWT(mockUser);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp > Math.floor(Date.now() / 1000)).toBe(true);
    });
  });

  describe('verifyJWT()', () => {
    const validToken = jwt.sign(
      { userId: 1, email: 'test@example.com' },
      process.env.JWT_SECRET || 'supersecretkey',
      { 
        expiresIn: '15m',
        issuer: 'securebank-api',
        audience: 'securebank-app'
      }
    );

    test('should verify valid token', async () => {
      redisClient.get.mockResolvedValueOnce(null); // Not blacklisted

      const decoded = await authService.verifyJWT(validToken);

      expect(decoded).toHaveProperty('userId', 1);
      expect(decoded).toHaveProperty('email', 'test@example.com');
    });

    test('should reject blacklisted token', async () => {
      redisClient.get.mockResolvedValueOnce('revoked'); // Blacklisted

      await expect(authService.verifyJWT(validToken))
        .rejects
        .toThrow('Token has been revoked');
    });

    test('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        process.env.JWT_SECRET || 'supersecretkey',
        { 
          expiresIn: '-1s', // Already expired
          issuer: 'securebank-api',
          audience: 'securebank-app'
        }
      );

      redisClient.get.mockResolvedValueOnce(null);

      await expect(authService.verifyJWT(expiredToken))
        .rejects
        .toThrow('Token has expired');
    });

    test('should reject invalid token', async () => {
      redisClient.get.mockResolvedValueOnce(null);

      await expect(authService.verifyJWT('invalid.token.here'))
        .rejects
        .toThrow('Invalid token');
    });
  });

  describe('refreshToken()', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      account_status: 'active',
      role: 'user'
    };

    const validRefreshToken = jwt.sign(
      { userId: 1, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'superrefreshkey',
      { 
        expiresIn: '7d',
        issuer: 'securebank-api',
        audience: 'securebank-app'
      }
    );

    test('should generate new tokens with valid refresh token', async () => {
      redisClient.get.mockResolvedValueOnce(null); // Not blacklisted
      pool.query.mockResolvedValueOnce({ rows: [mockUser] }); // Find user
      redisClient.setEx.mockResolvedValueOnce('OK'); // Blacklist old token

      const result = await authService.refreshToken(validRefreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).not.toBe(validRefreshToken);
    });

    test('should blacklist old refresh token', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      redisClient.setEx.mockResolvedValueOnce('OK');

      await authService.refreshToken(validRefreshToken);

      expect(redisClient.setEx).toHaveBeenCalledWith(
        `blacklist:${validRefreshToken}`,
        expect.any(Number),
        'revoked'
      );
    });

    test('should reject if user not found', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      await expect(authService.refreshToken(validRefreshToken))
        .rejects
        .toThrow('User not found');
    });

    test('should reject if account not active', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({ 
        rows: [{ ...mockUser, account_status: 'suspended' }] 
      });

      await expect(authService.refreshToken(validRefreshToken))
        .rejects
        .toThrow('Account is not active');
    });
  });

  describe('logout()', () => {
    test('should blacklist token on logout', async () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        process.env.JWT_SECRET || 'supersecretkey',
        { expiresIn: '15m' }
      );

      redisClient.setEx.mockResolvedValueOnce('OK');

      await authService.logout(token);

      expect(redisClient.setEx).toHaveBeenCalledWith(
        `blacklist:${token}`,
        expect.any(Number),
        'revoked'
      );
    });

    test('should not blacklist already expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        process.env.JWT_SECRET || 'supersecretkey',
        { expiresIn: '-1s' }
      );

      await authService.logout(expiredToken);

      expect(redisClient.setEx).not.toHaveBeenCalled();
    });

    test('should throw error for invalid token', async () => {
      await expect(authService.logout('invalid.token'))
        .rejects
        .toThrow('Invalid token');
    });
  });
});