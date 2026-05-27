// services/gateway/src/pricePoller.js
// Every PRICE_POLL_INTERVAL_MS the Gateway:
//   1. Fetches latest prices from the Price Service REST endpoint
//   2. Writes a snapshot row to price_history in PostgreSQL
//   3. Publishes to Redis 'price-updates' channel (consumed by Notifier)
//   4. Broadcasts to all connected WebSocket clients
//
// NOTE: Steps 3 and 4 happen in the same tick — do NOT decouple them.

const axios = require('axios');
const pool  = require('./db');
const { publisher } = require('./redis');
const ws    = require('./websocket');

const POLL_INTERVAL_MS  = parseInt(process.env.PRICE_POLL_INTERVAL_MS || '60000', 10);
const PRICE_SERVICE_URL = process.env.PRICE_SERVICE_URL || 'http://localhost:3002';

let latestPrices = [];

function getLatestPrices() { return latestPrices; }

async function fetchAndDistribute() {
  try {
    const res = await axios.get(`${PRICE_SERVICE_URL}/prices`, { timeout: 15000 });
    const coins = res.data?.coins ?? [];
    if (!coins.length) return;

    latestPrices = coins;

    // 1. Write to price_history (fire-and-forget; errors logged but don't block broadcast)
    persistPriceHistory(coins).catch(err =>
      console.error('[pricePoller] DB write error:', err.message)
    );

    // 2. Publish to Redis → Notifier
    const redisPayload = JSON.stringify({
      timestamp: new Date().toISOString(),
      prices: coins.map(c => ({ id: c.id, symbol: c.symbol, price_usd: c.price_usd })),
    });
    publisher.publish('price-updates', redisPayload).catch(err =>
      console.error('[pricePoller] Redis publish error:', err.message)
    );

    // 3. WebSocket broadcast to frontend clients
    ws.broadcast(coins);

    console.log(`[pricePoller] ✓  ${coins.length} prices distributed (${ws.getClientCount()} WS clients)`);
  } catch (err) {
    console.error('[pricePoller] Fetch error:', err.message, '— serving stale prices');
    // Do NOT crash; latestPrices remains from the last successful fetch
  }
}

async function persistPriceHistory(coins) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of coins.filter(c => c.price_usd != null && c.price_usd > 0)) {
      await client.query(
        `INSERT INTO price_history
           (coin_id, coin_symbol, price_usd, market_cap, volume_24h, change_24h)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [c.id, c.symbol, c.price_usd, c.market_cap ?? null, c.volume_24h ?? null, c.change_24h ?? null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function startPolling() {
  fetchAndDistribute();
  setInterval(fetchAndDistribute, POLL_INTERVAL_MS);
  console.log(`[pricePoller] Polling Price Service every ${POLL_INTERVAL_MS / 1000}s`);
}

module.exports = { startPolling, getLatestPrices };
