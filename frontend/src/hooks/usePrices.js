// frontend/src/hooks/usePrices.js
// Maintains live coin price state, updated via WebSocket messages.
// Falls back to a one-off REST fetch on first mount if WS is slow to connect.

import { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { fetchPrices } from '../api/gateway';

export function usePrices() {
  const [prices, setPrices]     = useState([]);    // Array of coin objects
  const [priceMap, setPriceMap] = useState({});    // { coinId: price_usd }
  const [lastUpdate, setLastUpdate] = useState(null);

  const updatePrices = useCallback((coins) => {
    if (!Array.isArray(coins) || !coins.length) return;
    setPrices(coins);
    setPriceMap(coins.reduce((m, c) => { m[c.id] = c.price_usd; return m; }, {}));
    setLastUpdate(new Date());
  }, []);

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'prices') updatePrices(msg.data);
  }, [updatePrices]);

  const { connected } = useWebSocket(handleWsMessage);

  // Bootstrap: fetch via REST so the table isn't empty on first render
  useEffect(() => {
    fetchPrices()
      .then(data => updatePrices(data.coins ?? []))
      .catch(err => console.error('[usePrices] REST bootstrap error:', err.message));
  }, [updatePrices]);

  const getPrice = useCallback((coinId) => priceMap[coinId] ?? 0, [priceMap]);

  return { prices, priceMap, getPrice, connected, lastUpdate };
}
