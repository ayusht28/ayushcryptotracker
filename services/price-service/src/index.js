// services/price-service/src/index.js
// Stateless microservice that polls CoinGecko + Frankfurter
// and exposes the latest data via REST for the Gateway to consume.

require('dotenv').config();
const express = require('express');
const { startPolling } = require('./poller');
const router = require('./routes');

const PORT = parseInt(process.env.PORT || '3002', 10);
const app  = express();

app.use(express.json());

// Mount all routes directly (no prefix — Gateway uses /prices, /rates, /health)
app.use('/', router);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('[price-service] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`[price-service] Running on port ${PORT}`);
  startPolling();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[price-service] SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = app;
