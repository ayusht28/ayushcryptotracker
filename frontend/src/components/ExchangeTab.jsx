import { useState, useEffect } from 'react';
import { Panel, CoinAvatar } from './ui';
import { fetchRates } from '../api/gateway';

export default function ExchangeTab({ prices, D }) {
  const [rates,  setRates]  = useState({});
  const [amount, setAmount] = useState('1000');
  const [from,   setFrom]   = useState('USD');

  useEffect(function loadRates() {
    async function load() {
      try {
        const data = await fetchRates();
        setRates(data.rates ?? {});
      } catch (err) {
        console.error('fetchRates failed:', err.message);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const allFiat  = { USD: 1, ...rates };
  const fiatKeys = Object.keys(allFiat);
  const amt      = parseFloat(amount) || 0;
  const toUsd    = amt / (allFiat[from] ?? 1);

  function Row({ left, right, leftStyle, rightStyle }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: D.panel2, borderRadius: 6, border: `1px solid ${D.border}` }}>
        <span style={{ fontSize: 13, color: D.text, ...leftStyle }}>{left}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: D.textBright, fontVariantNumeric: 'tabular-nums', ...rightStyle }}>{right}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Fiat converter */}
      <Panel D={D}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>
          Fiat Exchange
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: D.textDim, marginBottom: 5 }}>Amount</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="1000"
                style={{ width: '100%', background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, outline: 'none', fontFamily: 'Inter, sans-serif' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: D.textDim, marginBottom: 5 }}>From</label>
              <select
                value={from}
                onChange={e => setFrom(e.target.value)}
                style={{ width: '100%', background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: D.textBright, outline: 'none', fontFamily: 'Inter, sans-serif' }}
              >
                {fiatKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fiatKeys.filter(k => k !== from).map(function(code) {
              const converted = toUsd * (allFiat[code] ?? 1);
              return (
                <Row
                  key={code}
                  left={code}
                  right={converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                />
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: D.textDim, textAlign: 'right', marginTop: 10 }}>
            Rates via Frankfurter API · Updates every 60s
          </div>
        </div>
      </Panel>

      {/* Crypto converter */}
      <Panel D={D}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>Crypto Conversion</span>
          <span style={{ fontSize: 12, color: D.textDim, marginLeft: 8 }}>≈ ${toUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prices.map(function(coin) {
            const coinPrice = parseFloat(coin.price_usd);
            const cryptoAmt = coinPrice > 0 ? toUsd / coinPrice : 0;
            return (
              <div key={coin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: D.panel2, borderRadius: 6, border: `1px solid ${D.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CoinAvatar symbol={coin.symbol} size={26} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>{coin.symbol}</div>
                    <div style={{ fontSize: 11, color: D.textDim }}>${coinPrice.toLocaleString('en-US', { maximumFractionDigits: coinPrice > 10 ? 2 : 5 })}</div>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: D.textBright, fontVariantNumeric: 'tabular-nums' }}>
                  {cryptoAmt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: coinPrice > 100 ? 6 : 8 })}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
