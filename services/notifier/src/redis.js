// services/notifier/src/redis.js
// Creates a dedicated subscriber client.
// A connection in SUBSCRIBE mode cannot issue other commands — this
// client is only used for subscribing; db.js handles all DB queries.

const Redis = require('ioredis');

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

const subscriber = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,  // Keep retrying forever (background worker)
  enableReadyCheck: true,
  lazyConnect: false,
});

subscriber.on('connect',      () => console.log('[notifier:redis] Connected'));
subscriber.on('ready',        () => console.log('[notifier:redis] Ready'));
subscriber.on('error',  err  => console.error('[notifier:redis] Error:', err.message));
subscriber.on('reconnecting', () => console.warn('[notifier:redis] Reconnecting…'));

module.exports = { subscriber };
