require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'supersecretkey',
  expiresIn:'1d',  // token expiration
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'superrefreshkey',
  refreshExpiresIn: '1d',
};
