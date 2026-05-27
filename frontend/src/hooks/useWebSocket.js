// frontend/src/hooks/useWebSocket.js
// Manages the WebSocket connection to the Gateway.
// Returns { connected, lastMessage } and handles reconnection automatically.

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL           = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
const RECONNECT_DELAY  = 5000;
const PING_INTERVAL    = 30000;

export function useWebSocket(onMessage) {
  const [connected, setConnected]   = useState(false);
  const wsRef                       = useRef(null);
  const pingRef                     = useRef(null);
  const reconnectRef                = useRef(null);
  const unmountedRef                = useRef(false);
  const onMessageRef                = useRef(onMessage);

  // Keep the callback ref fresh without re-running the effect
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const clearTimers = useCallback(() => {
    if (pingRef.current)      clearInterval(pingRef.current);
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(`${WS_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      console.log('[ws] Connected');

      // Send client-side ping every 30s to prevent Render from closing idle sockets
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pong') return; // keep-alive ACK — ignore
        onMessageRef.current?.(msg);
      } catch {
        // ignore malformed frames
      }
    };

    const handleDisconnect = () => {
      clearTimers();
      setConnected(false);
      if (!unmountedRef.current) {
        console.warn(`[ws] Disconnected — reconnecting in ${RECONNECT_DELAY / 1000}s`);
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onclose = handleDisconnect;
    ws.onerror = (err) => {
      console.error('[ws] Error:', err);
      ws.close(); // triggers onclose → reconnect
    };
  }, [clearTimers]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimers();
      wsRef.current?.close();
    };
  }, [connect, clearTimers]);

  return { connected };
}
