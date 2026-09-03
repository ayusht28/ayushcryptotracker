import { useState, useEffect } from 'react';
import { executeTrade, getErrorMessage } from '../api/gateway';
import { Input, Select, Button, Label } from './ui';
import { validateQuantity, validatePrice } from '../validation';

const TRADE_TYPES = ['buy', 'sell', 'short', 'cover'];

export default function TradeModal({ portfolioId, coins, getPrice, onClose, onSuccess, D }) {
  const [coinId,   setCoinId]   = useState(coins[0]?.id ?? '');
  const [type,     setType]     = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [price,    setPrice]    = useState('');
  const [target,   setTarget]   = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [notes,    setNotes]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [qtyError,   setQtyError]   = useState('');
  const [priceError, setPriceError] = useState('');

  useEffect(function autofillPrice() {
    const currentPrice = getPrice(coinId);
    if (currentPrice) {
      setPrice(currentPrice > 10 ? currentPrice.toFixed(2) : currentPrice.toFixed(5));
    }
  }, [coinId, getPrice]);

  function handleQuantityChange(value) {
    setQuantity(value);
    setQtyError(value ? validateQuantity(value) || '' : '');
  }

  function handlePriceChange(value) {
    setPrice(value);
    setPriceError(value ? validatePrice(value) || '' : '');
  }

  const qty   = parseFloat(quantity) || 0;
  const px    = parseFloat(price)    || 0;
  const tp    = parseFloat(target)   || 0;
  const sl    = parseFloat(stopLoss) || 0;
  const total = qty * px;

  const isLong     = type === 'buy' || type === 'cover';
  const projProfit = tp && qty && px ? (isLong ? (tp - px) * qty : (px - tp) * qty) : null;
  const projLoss   = sl && qty && px ? (isLong ? (sl - px) * qty : (px - sl) * qty) : null;
  const riskReward = projProfit !== null && projLoss !== null && projLoss !== 0 ? Math.abs(projProfit / projLoss).toFixed(2) : null;

  async function handleSubmit() {
    const quantityError = validateQuantity(quantity);
    const priceValidError = validatePrice(price);

    if (quantityError) { setQtyError(quantityError);   return; }
    if (priceValidError) { setPriceError(priceValidError); return; }

    const coin = coins.find(c => c.id === coinId);
    setLoading(true);
    setError('');

    try {
      await executeTrade(portfolioId, {
        coinId,
        symbol:   coin.symbol,
        type,
        quantity: qty,
        price:    px,
        notes:    notes.trim() || null,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function TypeButton({ t }) {
    const isSelected = type === t;
    return (
      <button
        onClick={() => setType(t)}
        style={{ padding: '7px', fontSize: 12, fontWeight: 500, borderRadius: 5, cursor: 'pointer', textTransform: 'capitalize', background: isSelected ? D.blue : 'transparent', border: `1px solid ${isSelected ? D.blue : D.border}`, color: isSelected ? '#ffffff' : D.text, transition: 'all 0.15s' }}
      >
        {t}
      </button>
    );
  }

  const hasErrors = qtyError || priceError;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="slide-up" style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, width: '90%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: D.textBright }}>Execute Trade</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: D.textDim, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label D={D}>Coin</Label>
            <Select value={coinId} onChange={setCoinId} options={coins.map(c => ({ value: c.id, label: `${c.symbol} — ${c.name}` }))} D={D} />
          </div>

          <div>
            <Label D={D}>Action</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {TRADE_TYPES.map(t => <TypeButton key={t} t={t} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label D={D}>Quantity</Label>
              <input
                type="number"
                value={quantity}
                onChange={e => handleQuantityChange(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', background: D.panel2, border: `1px solid ${qtyError ? D.red : D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, outline: 'none', fontFamily: 'Inter, sans-serif' }}
              />
              {qtyError && <div style={{ fontSize: 11, color: D.red, marginTop: 4 }}>{qtyError}</div>}
            </div>
            <div>
              <Label D={D}>Price (USD)</Label>
              <input
                type="number"
                value={price}
                onChange={e => handlePriceChange(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', background: D.panel2, border: `1px solid ${priceError ? D.red : D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, outline: 'none', fontFamily: 'Inter, sans-serif' }}
              />
              {priceError && <div style={{ fontSize: 11, color: D.red, marginTop: 4 }}>{priceError}</div>}
            </div>
          </div>

          {total > 0 && !hasErrors && (
            <div style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.text }}>
              Total: <span style={{ color: D.textBright, fontWeight: 600 }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          <div>
            <Label D={D}>Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. bought the dip, DCA entry, swing trade…"
              rows={2}
              style={{ width: '100%', background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'none' }}
            />
          </div>

          <div style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, fontSize: 12, fontWeight: 600, color: D.textBright }}>
              P&L Calculator
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <Label D={D}>Target Price</Label>
                  <Input value={target} onChange={setTarget} placeholder="0.00" type="number" D={D} />
                </div>
                <div>
                  <Label D={D}>Stop Loss</Label>
                  <Input value={stopLoss} onChange={setStopLoss} placeholder="0.00" type="number" D={D} />
                </div>
              </div>

              {(projProfit !== null || projLoss !== null) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {projProfit !== null && (
                    <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: D.textDim, marginBottom: 4 }}>Target P&L</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: projProfit >= 0 ? D.green : D.red }}>{projProfit >= 0 ? '+' : '-'}${Math.abs(projProfit).toFixed(2)}</div>
                    </div>
                  )}
                  {projLoss !== null && (
                    <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: D.textDim, marginBottom: 4 }}>Max Loss</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: projLoss >= 0 ? D.green : D.red }}>{projLoss >= 0 ? '+' : '-'}${Math.abs(projLoss).toFixed(2)}</div>
                    </div>
                  )}
                  {riskReward && (
                    <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: D.textDim, marginBottom: 4 }}>Risk/Reward</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: parseFloat(riskReward) >= 2 ? D.green : D.gold }}>1 : {riskReward}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: D.red, padding: '8px 12px', background: D.red + '15', borderRadius: 5 }}>{error}</div>
          )}

          <Button onClick={handleSubmit} disabled={loading || hasErrors} variant="primary" D={D}>
            {loading ? 'Executing…' : `${type.charAt(0).toUpperCase() + type.slice(1)} ${coins.find(c => c.id === coinId)?.symbol ?? ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
