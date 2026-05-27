// services/price-service/src/poller.js
// Polls CoinGecko and Frankfurter on a fixed interval.
// Uses exponential backoff on CoinGecko 429 responses.

const axios = require('axios');
const cache = require('./cache');

const COIN_IDS = (process.env.COIN_IDS ||
  'bitcoin,ethereum,binancecoin,solana,cardano,ripple,dogecoin,polkadot,litecoin,chainlink,avalanche-2,matic-network'
).split(',').map(s => s.trim());

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);
const COINGECKO_BASE   = 'https://api.coingecko.com/api/v3';
const FRANKFURTER_BASE = 'https://api.frankfurter.app';

// Backoff state for CoinGecko rate-limit handling
let backoffMs = 0;
const BACKOFF_STEPS = [5000, 10000, 30000];
let backoffIndex = 0;

function buildCoinGeckoHeaders() {
  const headers = { 'Accept': 'application/json' };
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-pro-api-key'] = process.env.COINGECKO_API_KEY;
  }
  return headers;
}

async function fetchCoins() {
  if (backoffMs > 0) {
    console.log(`[poller] CoinGecko backoff active — waiting ${backoffMs / 1000}s`);
    await new Promise(r => setTimeout(r, backoffMs));
  }

  try {
    const res = await axios.get(`${COINGECKO_BASE}/coins/markets`, {
      headers: buildCoinGeckoHeaders(),
      params: {
        vs_currency: 'usd',
        ids: COIN_IDS.join(','),
        order: 'market_cap_desc',
        per_page: COIN_IDS.length,
        page: 1,
        price_change_percentage: '24h',
      },
      timeout: 15000,
    });

    const coins = res.data.map(c => ({
      id:           c.id,
      symbol:       c.symbol.toUpperCase(),
      name:         c.name,
      price_usd:    c.current_price,
      change_24h:   c.price_change_percentage_24h ?? 0,
      market_cap:   c.market_cap,
      volume_24h:   c.total_volume,
      last_updated: c.last_updated,
    }));

    cache.setCoins(coins);
    backoffMs = 0;
    backoffIndex = 0;
    console.log(`[poller] CoinGecko ✓  ${coins.length} coins fetched`);
  } catch (err) {
    if (err.response?.status === 429) {
      backoffMs = BACKOFF_STEPS[Math.min(backoffIndex, BACKOFF_STEPS.length - 1)];
      backoffIndex++;
      console.warn(`[poller] CoinGecko 429 — backing off ${backoffMs / 1000}s`);
    } else {
      console.error('[poller] CoinGecko error:', err.message);
    }
    cache.markCoinStale();
  }
}

async function fetchRates() {
  try {
    const res = await axios.get(`${FRANKFURTER_BASE}/latest`, {
      params: { from: 'USD' },
      timeout: 10000,
    });
    cache.setRates(res.data.rates);
    console.log('[poller] Frankfurter ✓  rates fetched');
  } catch (err) {
    console.error('[poller] Frankfurter error:', err.message);
    cache.markRateStale();
  }
}

function startPolling() {
  // Run immediately on startup, then on interval
  fetchCoins();
  fetchRates();

  setInterval(fetchCoins, POLL_INTERVAL_MS);
  setInterval(fetchRates, POLL_INTERVAL_MS);
  console.log(`[poller] Polling every ${POLL_INTERVAL_MS / 1000}s`);
}

module.exports = { startPolling, fetchCoins, fetchRates };
