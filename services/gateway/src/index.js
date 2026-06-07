// services/gateway/src/index.js
// Core entry point: creates the HTTP server, attaches WebSocket,
// mounts all REST routes, and starts the price poller.

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const pool       = require('./db');
const ws         = require('./websocket');
const { startPolling } = require('./pricePoller');

const marketRoutes    = require('./routes/market');
const portfolioRoutes = require('./routes/portfolio');
const alertRoutes     = require('./routes/alerts');

const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Express setup ────────────────────────────────────────────────────────────
const app = express();

// CORS: allow only configured origins (comma-separated env var)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Postman) and configured origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// Rate limiting — 100 req/min per IP (v1 spec requirement)
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down' },
}));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/market',    marketRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/alerts',    alertRoutes);

// Health check
app.get('/health', (req, res) => {
  res.send('ok');
});

// 404 catch-all
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler — return 400 for business logic errors, 500 for rest
app.use((err, req, res, _next) => {
  const status = err.status || (err.message?.includes('CORS') ? 403 : 500);
  if (status === 500) console.error('[gateway] Unhandled error:', err);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
const server = http.createServer(app);
ws.init(server);

server.listen(PORT, () => {
  console.log(`[gateway] HTTP + WS server running on port ${PORT}`);
  startPolling();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[gateway] SIGTERM received — shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

module.exports = app;
