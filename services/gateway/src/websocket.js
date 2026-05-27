// services/gateway/src/websocket.js
// Attaches a ws WebSocket server to the existing HTTP server.
// Broadcasts live price data to all connected frontend clients.

const WebSocket = require('ws');

let wss = null;
const clients = new Set();

const WS_PING_INTERVAL_MS = parseInt(process.env.WS_PING_INTERVAL_MS || '30000', 10);

function init(httpServer) {
  wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`[ws] Client connected — total: ${clients.size}`);

    // Send cached prices immediately so the client doesn't wait up to 60s
    const { getLatestPrices } = require('./pricePoller');
    const latest = getLatestPrices();
    if (latest.length > 0) {
      safeSend(ws, { type: 'prices', data: latest, timestamp: new Date().toISOString() });
    }

    // Keep-alive ping/pong
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          safeSend(ws, { type: 'pong' });
        }
        // msg.type === 'subscribe' is a v2 feature — ignore for now
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[ws] Client disconnected — remaining: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[ws] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // Server-side keep-alive: terminate dead connections every WS_PING_INTERVAL_MS
  const pingInterval = setInterval(() => {
    clients.forEach((ws) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, WS_PING_INTERVAL_MS);

  wss.on('close', () => clearInterval(pingInterval));
  console.log('[ws] WebSocket server attached at /ws');
}

function broadcast(prices) {
  if (!wss || clients.size === 0) return;
  const payload = JSON.stringify({ type: 'prices', data: prices, timestamp: new Date().toISOString() });
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch (err) {
        console.error('[ws] Send error:', err.message);
        clients.delete(ws);
      }
    }
  });
}

function safeSend(ws, data) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } catch (err) {
    console.error('[ws] safeSend error:', err.message);
  }
}

function getClientCount() { return clients.size; }

module.exports = { init, broadcast, getClientCount };
