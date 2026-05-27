// services/gateway/src/routes/market.js
// GET /api/market/prices   — proxy from Price Service cache
// GET /api/market/history/:coinId — price_history rows from DB
// GET /api/market/rates    — fiat rates proxy

const { Router } = require('express');
const axios = require('axios');
const pool  = require('../db');
const { getLatestPrices } = require('../pricePoller');

const router = Router();
const PRICE_SERVICE_URL = process.env.PRICE_SERVICE_URL || 'http://localhost:3002';

// GET /api/market/prices
router.get('/prices', async (req, res) => {
  try {
    // Prefer in-memory cache (always fresh after each 60s tick)
    const cached = getLatestPrices();
    if (cached.length > 0) return res.json({ coins: cached });

    // Fallback: hit Price Service directly on cold start
    const { data } = await axios.get(`${PRICE_SERVICE_URL}/prices`, { timeout: 10000 });
    res.json(data);
  } catch (err) {
    console.error('[market] /prices error:', err.message);
    res.status(502).json({ error: 'Price Service unavailable' });
  }
});

// GET /api/market/history/:coinId?limit=100
router.get('/history/:coinId', async (req, res) => {
  const { coinId } = req.params;
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);

  try {
    const { rows } = await pool.query(
      `SELECT coin_id, coin_symbol, price_usd, market_cap, volume_24h, change_24h, created_at
         FROM price_history
        WHERE coin_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [coinId, limit]
    );
    // Return in chronological order (oldest first) for charting
    res.json({ coinId, history: rows.reverse() });
  } catch (err) {
    console.error('[market] /history error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/market/rates
router.get('/rates', async (req, res) => {
  try {
    const { data } = await axios.get(`${PRICE_SERVICE_URL}/rates`, { timeout: 10000 });
    res.json(data);
  } catch (err) {
    console.error('[market] /rates error:', err.message);
    res.status(502).json({ error: 'Price Service unavailable' });
  }
});

module.exports = router;
