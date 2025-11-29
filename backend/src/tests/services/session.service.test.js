/**
 * Tests pour SessionService
 * @module tests/services/session.service.test
 */

const sessionService = require('../../services/session.service');
const pool = require('../../config/database');
const redisClient = require('../../config/redis');

// Mock des dépendances
jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('../../utils/logger');

describe('SessionService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession()', () => {
    const validSessionData = {
      userId: 1,
      accessToken: 'access.token.here',
      refreshToken: 'refresh.token.here',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      deviceInfo: {
        country: 'US',
        city: 'New York'
      },
      mfaVerified: true
    };

    test('should create a new session successfully', async () => {
      const mockSession = {
        id: 1,
        session_id: 'mock-session-id',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000)
      };

      pool.query.mockResolvedValueOnce({ rows: [mockSession] });
      redisClient.setEx.mockResolvedValueOnce('OK');

      const result = await sessionService.createSession(validSessionData);

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('createdAt');
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(redisClient.setEx).toHaveBeenCalledTimes(1);
    });

    test('should store session in database with correct data', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          session_id: 'test-session',
          created_at: new Date(),
          expires_at: new Date()
        }]
      });
      redisClient.setEx.mockResolvedValueOnce('OK');

      await sessionService.createSession(validSessionData);

      const call = pool.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO sessions');
      expect(call[1]).toContain(validSessionData.userId);
      expect(call[1]).toContain(validSessionData.ipAddress);
    });

    test('should cache session in Redis', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          session_id: 'test-session',
          created_at: new Date(),
          expires_at: new Date()
        }]
      });
      redisClient.setEx.mockResolvedValueOnce('OK');

      await sessionService.createSession(validSessionData);

      expect(redisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        1800, // 30 minutes
        expect.any(String)
      );
    });

    test('should set expiration 15 minutes from now', async () => {
      const now = Date.now();
      
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          session_id: 'test-session',
          created_at: new Date(),
          expires_at: new Date(now + 15 * 60 * 1000)
        }]
      });
      redisClient.setEx.mockResolvedValueOnce('OK');

      const result = await sessionService.createSession(validSessionData);

      const expiresAt = new Date(result.expiresAt);
      const diff = expiresAt - now;
      
      // Vérifier que c'est environ 15 minutes (avec marge de 1 seconde)
      expect(diff).toBeGreaterThan(14 * 60 * 1000);
      expect(diff).toBeLessThan(16 * 60 * 1000);
    });
  });

  describe('validateSession()', () => {
    const mockSessionId = 'valid-session-id';

    test('should validate session from cache', async () => {
      const cachedSession = {
        userId: 1,
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        mfaVerified: true
      };

      redisClient.get.mockResolvedValueOnce(JSON.stringify(cachedSession));

      const result = await sessionService.validateSession(mockSessionId);

      expect(result).toMatchObject({
        userId: cachedSession.userId,
        ipAddress: cachedSession.ipAddress
      });
      expect(pool.query).not.toHaveBeenCalled(); // Pas d'accès DB
    });

    test('should fetch from database if not in cache', async () => {
      const mockDbSession = {
        session_id: mockSessionId,
        user_id: 1,
        ip_address: '127.0.0.1',
        is_active: true,
        mfa_verified: true,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        last_activity: new Date()
      };

      redisClient.get.mockResolvedValueOnce(null); // Not in cache
      pool.query
        .mockResolvedValueOnce({ rows: [mockDbSession] }) // Find session
        .mockResolvedValueOnce({ rows: [] }); // Update activity
      redisClient.setEx.mockResolvedValueOnce('OK'); // Cache it

      const result = await sessionService.validateSession(mockSessionId);

      expect(result.userId).toBe(mockDbSession.user_id);
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(redisClient.setEx).toHaveBeenCalled();
    });

    test('should throw error if session expired', async () => {
      const expiredSession = {
        userId: 1,
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        mfaVerified: true
      };

      redisClient.get.mockResolvedValueOnce(JSON.stringify(expiredSession));
      pool.query.mockResolvedValueOnce({ rows: [] }); // End session

      await expect(sessionService.validateSession(mockSessionId))
        .rejects
        .toThrow('Session expired');
    });

    test('should throw error if session not found', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      pool.query.mockResolvedValueOnce({ rows: [] }); // No session

      await expect(sessionService.validateSession(mockSessionId))
        .rejects
        .toThrow('Session not found or inactive');
    });

    test('should update last activity when validating from DB', async () => {
      const mockSession = {
        session_id: mockSessionId,
        user_id: 1,
        ip_address: '127.0.0.1',
        is_active: true,
        mfa_verified: true,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        last_activity: new Date()
      };

      redisClient.get.mockResolvedValueOnce(null);
      pool.query
        .mockResolvedValueOnce({ rows: [mockSession] })
        .mockResolvedValueOnce({ rows: [] }); // Update activity
      redisClient.setEx.mockResolvedValueOnce('OK');

      await sessionService.validateSession(mockSessionId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('last_activity'),
        expect.any(Array)
      );
    });
  });

  describe('refreshSession()', () => {
    const mockSessionId = 'session-to-refresh';

    test('should refresh session expiration', async () => {
      const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      pool.query.mockResolvedValueOnce({
        rows: [{
          session_id: mockSessionId,
          expires_at: newExpiresAt
        }]
      });

      redisClient.get.mockResolvedValueOnce(JSON.stringify({
        userId: 1,
        ipAddress: '127.0.0.1',
        expiresAt: new Date().toISOString(),
        mfaVerified: true
      }));

      redisClient.setEx.mockResolvedValueOnce('OK');

      const result = await sessionService.refreshSession(mockSessionId);

      expect(result).toHaveProperty('sessionId', mockSessionId);
      expect(result).toHaveProperty('expiresAt');
    });

    test('should update cache after refresh', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          session_id: mockSessionId,
          expires_at: new Date()
        }]
      });

      redisClient.get.mockResolvedValueOnce(JSON.stringify({
        userId: 1,
        ipAddress: '127.0.0.1',
        expiresAt: new Date().toISOString(),
        mfaVerified: true
      }));

      redisClient.setEx.mockResolvedValueOnce('OK');

      await sessionService.refreshSession(mockSessionId);

      expect(redisClient.setEx).toHaveBeenCalled();
    });

    test('should throw error if session not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(sessionService.refreshSession(mockSessionId))
        .rejects
        .toThrow('Session not found or inactive');
    });
  });

  describe('endSession()', () => {
    const mockSessionId = 'session-to-end';

    test('should end session successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      redisClient.del.mockResolvedValueOnce(1);

      await sessionService.endSession(mockSessionId);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = false'),
        [mockSessionId]
      );
      expect(redisClient.del).toHaveBeenCalledWith(`session:${mockSessionId}`);
    });

    test('should remove session from cache', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      redisClient.del.mockResolvedValueOnce(1);

      await sessionService.endSession(mockSessionId);

      expect(redisClient.del).toHaveBeenCalledWith(`session:${mockSessionId}`);
    });
  });

  describe('endAllUserSessions()', () => {
    const mockUserId = 1;

    test('should end all user sessions', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 3 }) // Update query
        .mockResolvedValueOnce({ // Select sessions
          rows: [
            { session_id: 'session1' },
            { session_id: 'session2' },
            { session_id: 'session3' }
          ]
        });

      redisClient.del.mockResolvedValue(1);

      const count = await sessionService.endAllUserSessions(mockUserId);

      expect(count).toBe(3);
      expect(redisClient.del).toHaveBeenCalledTimes(3);
    });

    test('should exclude specific session when provided', async () => {
      const exceptSessionId = 'keep-this-session';

      pool.query
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({
          rows: [
            { session_id: 'session1' },
            { session_id: 'session2' },
            { session_id: exceptSessionId }
          ]
        });

      redisClient.del.mockResolvedValue(1);

      await sessionService.endAllUserSessions(mockUserId, exceptSessionId);

      // Vérifier que la requête exclut la session spécifiée
      expect(pool.query.mock.calls[0][0]).toContain('session_id != $2');
      expect(pool.query.mock.calls[0][1]).toContain(exceptSessionId);
    });
  });

  describe('getUserSessions()', () => {
    const mockUserId = 1;

    test('should return all active user sessions', async () => {
      const mockSessions = [
        {
          session_id: 'session1',
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          country: 'US',
          city: 'New York',
          created_at: new Date(),
          last_activity: new Date(),
          expires_at: new Date(),
          is_suspicious: false
        },
        {
          session_id: 'session2',
          ip_address: '192.168.1.1',
          user_agent: 'Chrome',
          country: 'UK',
          city: 'London',
          created_at: new Date(),
          last_activity: new Date(),
          expires_at: new Date(),
          is_suspicious: false
        }
      ];

      pool.query.mockResolvedValueOnce({ rows: mockSessions });

      const result = await sessionService.getUserSessions(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('sessionId');
      expect(result[0]).toHaveProperty('location');
      expect(result[0].location).toHaveProperty('country');
      expect(result[0].location).toHaveProperty('city');
    });

    test('should return empty array if no sessions', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await sessionService.getUserSessions(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('markSessionSuspicious()', () => {
    test('should mark session as suspicious', async () => {
      const sessionId = 'suspicious-session';
      const reason = 'IP address changed';

      pool.query.mockResolvedValueOnce({ rows: [] });

      await sessionService.markSessionSuspicious(sessionId, reason);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_suspicious = true'),
        [sessionId, reason]
      );
    });
  });

  describe('cleanupExpiredSessions()', () => {
    test('should delete expired sessions', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 5 });

      const count = await sessionService.cleanupExpiredSessions();

      expect(count).toBe(5);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sessions'),
        undefined
      );
    });
  });

  describe('checkIpChange()', () => {
    const mockSessionId = 'test-session';

    test('should return true if IP changed', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ip_address: '127.0.0.1' }]
      });

      const result = await sessionService.checkIpChange(mockSessionId, '192.168.1.1');

      expect(result).toBe(true);
    });

    test('should return false if IP unchanged', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ip_address: '127.0.0.1' }]
      });

      const result = await sessionService.checkIpChange(mockSessionId, '127.0.0.1');

      expect(result).toBe(false);
    });

    test('should return false if session not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await sessionService.checkIpChange(mockSessionId, '127.0.0.1');

      expect(result).toBe(false);
    });
  });
});