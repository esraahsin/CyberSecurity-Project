// backend/src/config/jwt.js - FIXED VERSION
require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'supersecretkey',
  
  // ✅ FIX: Access token expire dans 1 jour (cohérent avec session)
  expiresIn: '1d', // au lieu de '1d' qui était déjà correct
  
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'superrefreshkey',
  
  // ✅ FIX: Refresh token expire dans 7 jours
  refreshExpiresIn: '7d', // au lieu de '1d'
  
  // ✅ AJOUT: Configuration timezone
  timezone: 'UTC', // Toujours utiliser UTC côté serveur
  
  // ✅ AJOUT: Durées en millisecondes pour faciliter les calculs
  expiresInMs: 24 * 60 * 60 * 1000, // 1 jour
  refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 jours
};