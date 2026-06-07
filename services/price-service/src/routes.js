// services/price-service/src/routes.js
// REST endpoints consumed by the Gateway every 60 seconds.

const { Router } = require('express');
const cache = require('./cache');

const router = Router();

// GET /prices  — all coin prices from cache
router.get('/prices', (req, res) => {
  const coins = cache.getCoins();
  const stale = cache.isStale();
  res.json({
    coins,
    stale_data: stale.coin,
    last_updated: cache.getLastCoinPoll(),
  });
});

// GET /prices/:coinId  — single coin
router.get('/prices/:coinId', (req, res) => {
  const coin = cache.getCoins().find(c => c.id === req.params.coinId);
  if (!coin) return res.status(404).json({ error: 'Coin not found' });
  res.json({ ...coin, stale_data: cache.isStale().coin });
});

// GET /rates  — fiat exchange rates (base USD)
router.get('/rates', (req, res) => {
  const rates = cache.getRates();
  res.json({
    base: 'USD',
    rates,
    stale_data: cache.isStale().rate,
    last_updated: cache.getLastRatePoll(),
  });
});

// GET /health
router.get('/health', (req, res) => {
  res.send('ok');
});

module.exports = router;
