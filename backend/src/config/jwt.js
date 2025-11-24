require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'supersecretkey',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',  // token expiration
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'superrefreshkey',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};
