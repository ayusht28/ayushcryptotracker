import { useState, useEffect, useCallback } from 'react';
import { Panel, Badge, Input, Select, Button, Label, formatPrice, formatTime } from './ui';
import { fetchAlerts, createAlert, deleteAlert, getErrorMessage } from '../api/gateway';

export default function AlertsTab({ portfolioId, prices, D }) {
  const [alerts,         setAlerts]         = useState([]);
  const [coinId,         setCoinId]         = useState('');
  const [cond,           setCond]           = useState('above');
  const [target,         setTarget]         = useState('');
  const [loading,        setLoading]        = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(null);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');

  useEffect(function setDefaultCoin() {
    if (prices.length && !coinId) setCoinId(prices[0].id);
  }, [prices, coinId]);

  const loadAlerts = useCallback(async function() {
    if (!portfolioId) return;
    try {
      const data = await fetchAlerts(portfolioId);
      setAlerts(data.alerts ?? []);
    } catch (err) {
      console.error('fetchAlerts failed:', err.message);
    }
  }, [portfolioId]);

  useEffect(function startPolling() {
    loadAlerts();
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  async function handleCreate() {
    const tp = parseFloat(target);
    if (!coinId)             return setError('Select a coin');
    if (isNaN(tp) || tp <= 0) return setError('Enter a valid target price');

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const coin = prices.find(c => c.id === coinId);
      await createAlert(portfolioId, { coinId, symbol: coin.symbol, condition: cond, targetPrice: tp });
      setTarget('');
      setSuccess('Alert created');
      setTimeout(() => setSuccess(''), 3000);
      loadAlerts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(alertId) {
    try {
      await deleteAlert(alertId);
      setDeleteConfirm(null);
      loadAlerts();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function getPrice(coinId) {
    const coin = prices.find(p => p.id === coinId);
    return coin ? parseFloat(coin.price_usd) : 0;
  }

  const activeAlerts    = alerts.filter(a => a.status === 'active');
  const triggeredAlerts = alerts.filter(a => a.status === 'triggered');

  function Th({ children, right }) {
    return <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 500, color: D.textDim, textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${D.border}` }}>{children}</th>;
  }

  function Td({ children, right, style }) {
    return <td style={{ padding: '12px 16px', fontSize: 13, color: D.text, textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${D.border}`, ...style }}>{children}</td>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Active alerts */}
        <Panel D={D}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>
            Active Alerts ({activeAlerts.length})
          </div>
          {activeAlerts.length === 0
            ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: D.textBright, marginBottom: 6 }}>No active alerts</div>
                <div style={{ fontSize: 13, color: D.textDim }}>Create an alert to get notified when a coin hits your target price</div>
              </div>
            )
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Coin</Th><Th>Condition</Th><Th right>Target</Th><Th right>Current</Th><Th right>Distance</Th><Th right></Th></tr></thead>
                <tbody>
                  {activeAlerts.map(function(alert) {
                    const current  = getPrice(alert.coin_id);
                    const distance = current ? ((parseFloat(alert.target_price) - current) / current * 100) : 0;
                    return (
                      <tr key={alert.id}>
                        <Td style={{ fontWeight: 600, color: D.textBright }}>{alert.coin_symbol}</Td>
                        <Td><Badge label={alert.condition} color={alert.condition === 'above' ? D.green : D.red} /></Td>
                        <Td right style={{ color: D.gold, fontWeight: 600 }}>{formatPrice(alert.target_price)}</Td>
                        <Td right style={{ color: D.textBright }}>{formatPrice(current)}</Td>
                        <Td right><Badge label={(distance >= 0 ? '+' : '') + distance.toFixed(2) + '%'} color={distance >= 0 ? D.green : D.red} /></Td>
                        <Td right>
                          {deleteConfirm === alert.id
                            ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button onClick={() => setDeleteConfirm(null)} style={{ fontSize: 11, color: D.textDim, background: 'none', border: `1px solid ${D.border}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={() => handleDelete(alert.id)} style={{ fontSize: 11, color: '#fff', background: D.red, border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Confirm</button>
                              </div>
                            )
                            : (
                              <button onClick={() => setDeleteConfirm(alert.id)} style={{ fontSize: 11, color: D.red, background: 'none', border: `1px solid ${D.border}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                                Delete
                              </button>
                            )
                          }
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </Panel>

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <Panel D={D}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>
              Triggered ({triggeredAlerts.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><Th>Triggered</Th><Th>Coin</Th><Th>Condition</Th><Th right>Target</Th></tr></thead>
              <tbody>
                {triggeredAlerts.map(function(alert) {
                  return (
                    <tr key={alert.id}>
                      <Td style={{ color: D.textDim, fontSize: 12 }}>{formatTime(alert.triggered_at)}</Td>
                      <Td style={{ fontWeight: 600, color: D.textBright }}>{alert.coin_symbol}</Td>
                      <Td><Badge label={alert.condition} color={D.gold} /></Td>
                      <Td right style={{ color: D.gold }}>{formatPrice(alert.target_price)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )}
      </div>

      {/* Create alert form */}
      <Panel D={D} style={{ position: 'sticky', top: 80 }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>New Alert</div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label D={D}>Coin</Label>
            <Select value={coinId} onChange={setCoinId} options={prices.map(c => ({ value: c.id, label: `${c.symbol} — ${c.name}` }))} D={D} />
          </div>
          <div>
            <Label D={D}>Condition</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['above', 'below'].map(function(c) {
                const isSelected = cond === c;
                return (
                  <button key={c} onClick={() => setCond(c)} style={{ padding: '7px', fontSize: 12, fontWeight: 500, borderRadius: 5, cursor: 'pointer', textTransform: 'capitalize', background: isSelected ? D.blue : 'transparent', border: `1px solid ${isSelected ? D.blue : D.border}`, color: isSelected ? '#ffffff' : D.text }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label D={D}>Target Price (USD)</Label>
            <Input value={target} onChange={setTarget} placeholder="0.00" type="number" D={D} />
          </div>
          {error   && <div style={{ fontSize: 12, color: D.red   }}>{error}</div>}
          {success && <div style={{ fontSize: 12, color: D.green }}>{success}</div>}
          <Button onClick={handleCreate} disabled={loading} variant="primary" D={D}>
            {loading ? 'Creating…' : 'Create Alert'}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
