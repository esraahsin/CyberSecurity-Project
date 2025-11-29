// backend/src/config/redis.js
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Connected to Redis');
  }
});

redisClient.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('❌ Redis error', err);
  }
});

// Ne connecter que si pas en mode test
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
    }
  })();
}

module.exports = redisClient;