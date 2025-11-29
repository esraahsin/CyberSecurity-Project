// Dans src/tests/services/auth.service.test.js
// Remplacer ces deux tests par :

// Test 1 : Corriger "should increment failed attempts on wrong password"
test('should increment failed attempts on wrong password', async () => {
  // Mock pour retourner des rows vides quand on cherche l'utilisateur
  pool.query
    .mockResolvedValueOnce({ rows: [mockUser] }) // Find user
    .mockResolvedValueOnce({ rows: [{ failed_login_attempts: 1 }] }); // Update failed attempts
  
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

// Test 2 : Corriger "should blacklist old refresh token"
test('should blacklist old refresh token', async () => {
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

  redisClient.get.mockResolvedValueOnce(null);
  pool.query.mockResolvedValueOnce({ rows: [mockUser] });
  redisClient.setEx.mockResolvedValueOnce('OK');

  await authService.refreshToken(validRefreshToken);

  // La méthode setEx est appelée avec (key, ttl_en_secondes, value)
  // Pour un token de 7 jours, le TTL devrait être environ 604800 secondes
  expect(redisClient.setEx).toHaveBeenCalledWith(
    `blacklist:${validRefreshToken}`,
    expect.any(Number), // Le TTL en secondes (pas "7d")
    'revoked'
  );
  
  // Vérifier que le TTL est raisonnable (entre 0 et 7 jours en secondes)
  const callArgs = redisClient.setEx.mock.calls[0];
  expect(callArgs[1]).toBeGreaterThan(0);
  expect(callArgs[1]).toBeLessThanOrEqual(604800); // 7 jours
});