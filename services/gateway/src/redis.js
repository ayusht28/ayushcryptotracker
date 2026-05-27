// services/gateway/src/redis.js
// Creates two separate ioredis clients:
//   publisher  — used to PUBLISH price updates
//   subscriber — reserved for future use / kept alive to detect disconnects
//
// NOTE: A Redis connection in SUBSCRIBE mode cannot issue other commands,
// so we always use separate clients for pub and sub.

const Redis = require('ioredis');

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

function createClient(name) {
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('connect',       () => console.log(`[redis:${name}] Connected`));
  client.on('ready',         () => console.log(`[redis:${name}] Ready`));
  client.on('error',  (err)  => console.error(`[redis:${name}] Error:`, err.message));
  client.on('reconnecting',  () => console.warn(`[redis:${name}] Reconnecting…`));

  return client;
}

const publisher = createClient('publisher');

module.exports = { publisher };
