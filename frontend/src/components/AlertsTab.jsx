// frontend/src/components/AlertsTab.jsx
// Create, list, and delete price alerts. Polls the API every 10 seconds.

import { useState, useEffect, useCallback } from 'react';
import { fetchAlerts, createAlert, deleteAlert, getErrorMessage } from '../api/gateway';

const fmtPrice = n => {
  if (!n && n !== 0) return '—';
  return n > 1 ? `$${(+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${(+n).toFixed(5)}`;
};

const fmtTime = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AlertsTab({ portfolioId, prices }) {
  const [alerts, setAlerts]     = useState([]);
  const [form, setForm]         = useState({ coinId: '', condition: 'above', targetPrice: '' });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const coins = prices;

  const loadAlerts = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const data = await fetchAlerts(portfolioId);
      setAlerts(data.alerts ?? []);
    } catch (e) {
      console.error('[AlertsTab] fetch error:', e.message);
    }
  }, [portfolioId]);

  // Initial load + poll every 10s
  useEffect(() => {
    loadAlerts();
    const iv = setInterval(loadAlerts, 10000);
    return () => clearInterval(iv);
  }, [loadAlerts]);

  // Set default coin on first load
  useEffect(() => {
    if (coins.length && !form.coinId) setForm(f => ({ ...f, coinId: coins[0].id }));
  }, [coins, form.coinId]);

  const handleCreate = async () => {
    const tp = parseFloat(form.targetPrice);
    if (!form.coinId) return setError('Please select a coin');
    if (isNaN(tp) || tp <= 0) return setError('Target price must be greater than 0');
    setLoading(true); setError(''); setSuccess('');
    try {
      const coin = coins.find(c => c.id === form.coinId);
      await createAlert(portfolioId, {
        coinId: form.coinId, symbol: coin.symbol,
        condition: form.condition, targetPrice: tp,
      });
      setForm(f => ({ ...f, targetPrice: '' }));
      setSuccess('Alert created');
      setTimeout(() => setSuccess(''), 3000);
      loadAlerts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId) => {
    try {
      await deleteAlert(alertId);
      loadAlerts();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const getPrice = (coinId) => {
    const c = prices.find(p => p.id === coinId);
    return c ? parseFloat(c.price_usd) : 0;
  };

  const active    = alerts.filter(a => a.status === 'active');
  const triggered = alerts.filter(a => a.status === 'triggered');

  return (
    <div className="grid grid-cols-[1fr_280px] gap-4 items-start">
      {/* Main */}
      <div className="space-y-4">
        {/* Active Alerts */}
        <div className="bg-[#0c0c1a] border border-[#18183a] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#18183a]">
            <span className="font-['Orbitron'] text-[11px] tracking-[3px] text-[#00d4ff] uppercase">
              Active Alerts ({active.length})
            </span>
          </div>
          {active.length === 0
            ? <p className="py-10 text-center text-[#50507a] font-mono text-sm">No active alerts</p>
            : (
              <table className="w-full border-collapse">
                <thead><tr className="border-b border-[#18183a]">
                  {['Coin','Condition','Target','Current','Distance',''].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 font-['Rajdhani'] text-[11px] tracking-widest text-[#50507a] uppercase ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {active.map(a => {
                    const cur  = getPrice(a.coin_id);
                    const dist = cur ? ((parseFloat(a.target_price) - cur) / cur * 100) : 0;
                    return (
                      <tr key={a.id} className="border-b border-[#0f0f20]">
                        <td className="px-4 py-3 font-['Rajdhani'] font-bold text-[#e8e8ff]">{a.coin_symbol}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${a.condition === 'above' ? 'text-[#00ff88] border-[#00ff8840] bg-[#00ff8810]' : 'text-[#ff3355] border-[#ff335540] bg-[#ff335510]'}`}>
                            {a.condition.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#ffd700] text-sm">{fmtPrice(a.target_price)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#e8e8ff] text-sm">{fmtPrice(cur)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${dist >= 0 ? 'text-[#00ff88] border-[#00ff8840] bg-[#00ff8810]' : 'text-[#ff3355] border-[#ff335540] bg-[#ff335510]'}`}>
                            {dist >= 0 ? '+' : ''}{dist.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDelete(a.id)}
                            className="text-[10px] font-mono px-2 py-1 border border-[#18183a] text-[#ff3355] rounded hover:bg-[#ff335520] hover:border-[#ff3355] transition-all uppercase tracking-widest">
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Triggered Alerts */}
        {triggered.length > 0 && (
          <div className="bg-[#0c0c1a] border border-[#18183a] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#18183a]">
              <span className="font-['Orbitron'] text-[11px] tracking-[3px] text-[#ffd700] uppercase">
                Triggered ({triggered.length})
              </span>
            </div>
            <table className="w-full border-collapse">
              <thead><tr className="border-b border-[#18183a]">
                {['Triggered At','Coin','Condition','Target'].map((h, i) => (
                  <th key={i} className={`px-4 py-2.5 font-['Rajdhani'] text-[11px] tracking-widest text-[#50507a] uppercase ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {triggered.map(a => (
                  <tr key={a.id} className="border-b border-[#0f0f20]">
                    <td className="px-4 py-3 text-[#50507a] font-mono text-xs">{fmtTime(a.triggered_at)}</td>
                    <td className="px-4 py-3 font-['Rajdhani'] font-bold text-[#e8e8ff]">{a.coin_symbol}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded border text-[#ffd700] border-[#ffd70040] bg-[#ffd70010]">
                        {a.condition.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#ffd700] text-sm">{fmtPrice(a.target_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Alert Form */}
      <div className="bg-[#0c0c1a] border border-[#18183a] rounded-lg overflow-hidden sticky top-0">
        <div className="px-4 py-3 border-b border-[#18183a]">
          <span className="font-['Orbitron'] text-[11px] tracking-[3px] text-[#ffd700] uppercase">New Alert</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-['Rajdhani'] tracking-widest text-[#50507a] uppercase mb-1.5">Coin</label>
            <select value={form.coinId} onChange={e => setForm(f => ({ ...f, coinId: e.target.value }))}
              className="w-full bg-[#07070f] border border-[#18183a] text-[#e8e8ff] font-mono text-xs px-3 py-2 rounded focus:border-[#ffd700] focus:outline-none">
              {coins.map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-['Rajdhani'] tracking-widest text-[#50507a] uppercase mb-1.5">Condition</label>
            <div className="grid grid-cols-2 gap-2">
              {['above', 'below'].map(cond => (
                <button key={cond} onClick={() => setForm(f => ({ ...f, condition: cond }))}
                  className={`py-2 rounded border font-['Orbitron'] text-[10px] tracking-widest uppercase transition-all
                    ${form.condition === cond
                      ? cond === 'above' ? 'border-[#00ff88] text-[#00ff88] bg-[#00ff8810]' : 'border-[#ff3355] text-[#ff3355] bg-[#ff335510]'
                      : 'border-[#18183a] text-[#50507a] hover:border-[#2e2e5a]'
                    }`}
                >{cond}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-['Rajdhani'] tracking-widest text-[#50507a] uppercase mb-1.5">Target Price (USD)</label>
            <input type="number" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
              placeholder="0.00" min="0" step="any"
              className="w-full bg-[#07070f] border border-[#18183a] text-[#e8e8ff] font-mono text-sm px-3 py-2 rounded focus:border-[#ffd700] focus:outline-none"
            />
          </div>

          {form.targetPrice && form.coinId && (
            <div className="bg-[#0f0f24] border border-[#18183a] rounded px-3 py-2 text-xs font-mono">
              <span style={{ color: form.condition === 'above' ? '#00ff88' : '#ff3355' }}>
                {form.condition === 'above' ? '↑' : '↓'} Alert when {coins.find(c => c.id === form.coinId)?.symbol || '?'} goes {form.condition}{' '}
                {fmtPrice(parseFloat(form.targetPrice))}
              </span>
            </div>
          )}

          {error   && <p className="text-red-400 font-mono text-xs">{error}</p>}
          {success && <p className="text-green-400 font-mono text-xs">{success}</p>}

          <button onClick={handleCreate} disabled={loading}
            className="w-full py-3 border border-[#ffd700] text-[#ffd700] rounded font-['Orbitron'] text-[10px] tracking-[2px] uppercase hover:bg-[#ffd70010] transition-all disabled:opacity-40">
            {loading ? 'Creating…' : 'Create Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
