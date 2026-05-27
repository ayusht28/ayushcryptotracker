// services/notifier/src/index.js
// Background worker: subscribes to Redis 'price-updates' and evaluates alerts.
// Exposes a minimal /health endpoint so Render keeps the process alive.

require('dotenv').config();
const express = require('express');
const { subscriber } = require('./redis');
const { evaluateAlerts } = require('./alertEvaluator');

const PORT = parseInt(process.env.PORT || '3003', 10);

// ─── Redis subscription ───────────────────────────────────────────────────────
subscriber.subscribe('price-updates', (err, count) => {
  if (err) {
    console.error('[notifier] Failed to subscribe:', err.message);
    process.exit(1);
  }
  console.log(`[notifier] Subscribed to ${count} channel(s)`);
});

subscriber.on('message', async (channel, message) => {
  if (channel !== 'price-updates') return;
  await evaluateAlerts(message);
});

// ─── Minimal health server ────────────────────────────────────────────────────
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    subscriber: subscriber.status,
    uptime: process.uptime(),
  });
});

app.listen(PORT, () => {
  console.log(`[notifier] Health endpoint on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[notifier] SIGTERM received');
  await subscriber.quit();
  process.exit(0);
});
