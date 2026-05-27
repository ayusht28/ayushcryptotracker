import { useState, useEffect } from 'react';
import { executeTrade, getErrorMessage } from '../api/gateway';

const TRADE_TYPES = ['buy', 'sell', 'short', 'cover'];

export default function TradeModal({ portfolioId, coins, getPrice, onClose, onSuccess, D }) {
  const [form, setForm]     = useState({ coinId: coins[0]?.id ?? '', type: 'buy', quantity: '', price: '' });
  const [target, setTarget] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');

  const TYPE_COLORS = {
    buy:   D.green,
    sell:  D.red,
    short: D.gold,
    cover: D.cyan,
  };

  useEffect(() => {
    const p = getPrice(form.coinId);
    if (p) setForm(f => ({ ...f, price: p > 10 ? p.toFixed(2) : p.toFixed(5) }));
  }, [form.coinId, getPrice]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const qty   = parseFloat(form.quantity) || 0;
  const px    = parseFloat(form.price)    || 0;
  const tp    = parseFloat(target)        || 0;
  const sl    = parseFloat(stopLoss)      || 0;
  const total = qty * px;

  // P&L projections
  const isLong    = form.type === 'buy' || form.type === 'cover';
  const projProfit = tp && qty && px ? (isLong ? (tp - px) * qty : (px - tp) * qty) : null;
  const projLoss   = sl && qty && px ? (isLong ? (sl - px) * qty : (px - sl) * qty) : null;
  const profitPct  = projProfit !== null && px ? (projProfit / total) * 100 : null;
  const lossPct    = projLoss   !== null && px ? (projLoss   / total) * 100 : null;
  const riskReward = projProfit !== null && projLoss !== null && projLoss !== 0
    ? Math.abs(projProfit / projLoss).toFixed(2) : null;

  const handleSubmit = async () => {
    if (!qty || qty <= 0) return setError('Quantity must be > 0');
    if (!px  || px  <= 0) return setError('Price must be > 0');
    const coin = coins.find(c => c.id === form.coinId);
    setLoading(true); setError('');
    try {
      await executeTrade(portfolioId, { coinId: form.coinId, symbol: coin.symbol, type: form.type, quantity: qty, price: px });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fmtPnl = n => n !== null ? `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}` : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div style={{ background: D.panel, border: `1px solid ${D.borderHi || D.border}`, borderRadius: 12, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: D.cyan, textTransform: 'uppercase' }}>Execute Trade</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: D.textDim, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Coin */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: D.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Coin</label>
            <select value={form.coinId} onChange={e => set('coinId', e.target.value)}
              style={{ width: '100%', background: D.bg, border: `1px solid ${D.border}`, color: D.textBright, fontFamily: "'Inter', sans-serif", fontSize: 13, padding: '8px 12px', borderRadius: 6, outline: 'none' }}>
              {coins.map(c => <option key={c.id} value={c.id}>{c.symbol} — {c.name}</option>)}
            </select>
          </div>

          {/* Trade type */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: D.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Action</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {TRADE_TYPES.map(t => (
                <button key={t} onClick={() => set('type', t)} style={{
                  padding: '9px 4px', borderRadius: 6, cursor: 'pointer',
                  fontWeight: 700, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', transition: 'all 0.2s',
                  background: form.type === t ? `${TYPE_COLORS[t]}20` : 'transparent',
                  border: `1px solid ${form.type === t ? TYPE_COLORS[t] : D.border}`,
                  color: form.type === t ? TYPE_COLORS[t] : D.textDim,
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Qty + Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Quantity', 'quantity', '0.00000'], ['Price (USD)', 'price', '0.00']].map(([label, key, ph]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: D.textDim, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
                <input type="number" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph} min="0"
                  style={{ width: '100%', background: D.bg, border: `1px solid ${D.border}`, color: D.textBright, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px', borderRadius: 6, outline: 'none' }}
                />
              </div>
            ))}
          </div>

          {/* Total */}
          {total > 0 && (
            <div style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontFamily: 'monospace', fontSize: 13 }}>
              <span style={{ color: D.textDim }}>Total: </span>
              <span style={{ color: D.textBright, fontWeight: 700 }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* ── P&L Calculator ── */}
          <div style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, fontSize: 11, fontWeight: 700, letterSpacing: 2, color: D.gold, textTransform: 'uppercase' }}>
              📊 P&L Calculator
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: D.textDim, textTransform: 'uppercase', marginBottom: 5 }}>Target Price</label>
                  <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" min="0"
                    style={{ width: '100%', background: D.panel, border: `1px solid ${D.border}`, color: D.textBright, fontFamily: 'monospace', fontSize: 12, padding: '7px 10px', borderRadius: 5, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: D.textDim, textTransform: 'uppercase', marginBottom: 5 }}>Stop Loss</label>
                  <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="0.00" min="0"
                    style={{ width: '100%', background: D.panel, border: `1px solid ${D.border}`, color: D.textBright, fontFamily: 'monospace', fontSize: 12, padding: '7px 10px', borderRadius: 5, outline: 'none' }}
                  />
                </div>
              </div>

              {(projProfit !== null || projLoss !== null) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 4 }}>
                  {projProfit !== null && (
                    <div style={{ background: `${D.green}12`, border: `1px solid ${D.green}40`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Target P&L</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: projProfit >= 0 ? D.green : D.red }}>{fmtPnl(projProfit)}</div>
                      <div style={{ fontSize: 10, color: D.textDim, marginTop: 2 }}>{profitPct !== null ? `${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%` : ''}</div>
                    </div>
                  )}
                  {projLoss !== null && (
                    <div style={{ background: `${D.red}12`, border: `1px solid ${D.red}40`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Max Loss</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: projLoss >= 0 ? D.green : D.red }}>{fmtPnl(projLoss)}</div>
                      <div style={{ fontSize: 10, color: D.textDim, marginTop: 2 }}>{lossPct !== null ? `${lossPct >= 0 ? '+' : ''}${lossPct.toFixed(2)}%` : ''}</div>
                    </div>
                  )}
                  {riskReward && (
                    <div style={{ background: `${D.gold}12`, border: `1px solid ${D.gold}40`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Risk/Reward</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: D.gold }}>1 : {riskReward}</div>
                      <div style={{ fontSize: 10, color: parseFloat(riskReward) >= 2 ? D.green : D.red, marginTop: 2 }}>
                        {parseFloat(riskReward) >= 2 ? '✓ Good ratio' : '⚠ Low ratio'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <p style={{ color: D.red, fontFamily: 'monospace', fontSize: 12, padding: '8px 12px', background: `${D.red}15`, borderRadius: 4, border: `1px solid ${D.red}30` }}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            border: `1px solid ${TYPE_COLORS[form.type]}`,
            background: `${TYPE_COLORS[form.type]}15`,
            color: TYPE_COLORS[form.type],
            fontWeight: 800, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
            transition: 'all 0.2s', opacity: loading ? 0.5 : 1,
          }}>{loading ? 'Executing…' : `Execute ${form.type.toUpperCase()}`}</button>
        </div>
      </div>
    </div>
  );
}
