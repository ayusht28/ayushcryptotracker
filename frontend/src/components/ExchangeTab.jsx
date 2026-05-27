// frontend/src/components/ExchangeTab.jsx
// Fiat + crypto currency converter. Rates from GET /api/market/rates (refresh every 60s).

import { useState, useEffect } from 'react';
import { fetchRates } from '../api/gateway';

const FIAT_FLAGS = {
  EUR: '🇪🇺', GBP: '🇬🇧', INR: '🇮🇳', JPY: '🇯🇵',
  AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', SGD: '🇸🇬',
};

export default function ExchangeTab({ prices }) {
  const [rates, setRates]   = useState({});
  const [amount, setAmount] = useState('1000');
  const [from, setFrom]     = useState('USD');

  const loadRates = async () => {
    try {
      const data = await fetchRates();
      setRates(data.rates ?? {});
    } catch (e) {
      console.error('[ExchangeTab] rate fetch error:', e.message);
    }
  };

  useEffect(() => {
    loadRates();
    const iv = setInterval(loadRates, 60000);
    return () => clearInterval(iv);
  }, []);

  const allFiat  = { USD: 1, ...rates };
  const fiatKeys = Object.keys(allFiat);
  const amt      = parseFloat(amount) || 0;

  // Convert 'amt' units of 'from' → USD first, then to target
  const toUsd = amt / (allFiat[from] ?? 1);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Fiat Converter */}
      <div className="bg-[#0c0c1a] border border-[#18183a] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#18183a]">
          <span className="font-['Orbitron'] text-[11px] tracking-[3px] text-[#00d4ff] uppercase">Fiat Exchange</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-['Rajdhani'] tracking-widest text-[#50507a] uppercase mb-1.5">Amount</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="1000" min="0"
                className="w-full bg-[#07070f] border border-[#18183a] text-[#e8e8ff] font-mono text-sm px-3 py-2 rounded focus:border-[#00d4ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-['Rajdhani'] tracking-widest text-[#50507a] uppercase mb-1.5">From</label>
              <select value={from} onChange={e => setFrom(e.target.value)}
                className="w-full bg-[#07070f] border border-[#18183a] text-[#e8e8ff] font-mono text-sm px-3 py-2 rounded focus:border-[#00d4ff] focus:outline-none">
                {fiatKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            {fiatKeys.filter(k => k !== from).map(code => {
              const converted = toUsd * (allFiat[code] ?? 1);
              return (
                <div key={code} className="flex items-center justify-between bg-[#0f0f24] border border-[#18183a] rounded px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{FIAT_FLAGS[code] || '🏳️'}</span>
                    <span className="font-['Orbitron'] text-[11px] text-[#50507a] tracking-widest">{code}</span>
                  </div>
                  <span className="font-mono text-[#e8e8ff] font-semibold text-sm">
                    {converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] font-mono text-[#50507a] text-right">
            Via Frankfurter API · Updates every 60s
          </p>
        </div>
      </div>

      {/* Crypto Converter */}
      <div className="bg-[#0c0c1a] border border-[#18183a] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#18183a]">
          <span className="font-['Orbitron'] text-[11px] tracking-[3px] text-[#ffd700] uppercase">Crypto Conversion</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-[#0f0f24] border border-[#18183a] rounded px-3 py-2 font-mono text-sm">
            <span className="text-[#50507a]">≈ </span>
            <span className="text-[#e8e8ff] font-semibold">${toUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[#50507a]"> USD</span>
          </div>

          <div className="space-y-1.5">
            {prices.map(coin => {
              const cp = parseFloat(coin.price_usd);
              const cryptoAmt = cp > 0 ? toUsd / cp : 0;
              return (
                <div key={coin.id} className="flex items-center justify-between bg-[#0f0f24] border border-[#18183a] rounded px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-['Orbitron'] text-[10px] text-[#50507a] tracking-widest w-12">{coin.symbol}</span>
                    <span className="font-mono text-[10px] text-[#50507a]">${cp.toLocaleString('en-US', { maximumFractionDigits: cp > 10 ? 2 : 5 })}</span>
                  </div>
                  <span className="font-mono text-[#e8e8ff] font-semibold text-sm">
                    {cryptoAmt.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: cp > 100 ? 6 : 8,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
