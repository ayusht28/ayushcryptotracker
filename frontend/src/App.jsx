import { useState, useEffect, useCallback } from 'react';
import { usePrices } from './hooks/usePrices';
import { initPortfolio, fetchPortfolio, fetchTrades, fetchClosedPositions } from './api/gateway';
import WsIndicator  from './components/WsIndicator';
import MarketTab    from './components/MarketTab';
import PortfolioTab from './components/PortfolioTab';
import AlertsTab    from './components/AlertsTab';
import ExchangeTab  from './components/ExchangeTab';

const TABS = [
  { id: 'market',    label: 'Market',    icon: '◈' },
  { id: 'portfolio', label: 'Portfolio', icon: '◉' },
  { id: 'alerts',    label: 'Alerts',    icon: '◎' },
  { id: 'exchange',  label: 'Exchange',  icon: '⇄' },
];

export default function App() {
  const { prices, connected, lastUpdate } = usePrices();
  const [activeTab, setActiveTab]     = useState('market');
  const [portfolioId, setPortfolioId] = useState(null);
  const [portfolio, setPortfolio]     = useState(null);
  const [toast, setToast]             = useState(null);
  const [clock, setClock]             = useState(new Date());
  const [darkMode, setDarkMode]       = useState(true);

  const D = darkMode ? {
    bg: '#07070f', panel: '#0c0c1a', border: '#18183a', borderHi: '#2e2e5a',
    text: '#b8b8d8', textBright: '#e8e8ff', textDim: '#50507a',
    cyan: '#00d4ff', green: '#00ff88', red: '#ff3355', gold: '#ffd700',
    rowHover: 'rgba(255,255,255,0.03)', tabActiveBorder: '#00d4ff',
  } : {
    bg: '#f0f4f8', panel: '#ffffff', border: '#e2e8f0', borderHi: '#cbd5e1',
    text: '#475569', textBright: '#0f172a', textDim: '#94a3b8',
    cyan: '#0284c7', green: '#16a34a', red: '#dc2626', gold: '#d97706',
    rowHover: 'rgba(0,0,0,0.02)', tabActiveBorder: '#0284c7',
  };

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    initPortfolio()
      .then(d => setPortfolioId(d.portfolioId))
      .catch(err => console.error('[App] initPortfolio error:', err.message));
  }, []);

  const refreshPortfolio = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const [portData, tradeData, closedData] = await Promise.all([
        fetchPortfolio(portfolioId),
        fetchTrades(portfolioId),
        fetchClosedPositions(portfolioId),
      ]);
      setPortfolio({
        ...portData,
        trades: tradeData.trades ?? [],
        closed_positions: closedData.closed_positions ?? [],
      });
    } catch (err) {
      console.error('[App] refreshPortfolio error:', err.message);
    }
  }, [portfolioId]);

  useEffect(() => { refreshPortfolio(); }, [refreshPortfolio]);

  useEffect(() => {
    if (!portfolio || !prices.length) return;
    const priceMap = prices.reduce((m, c) => { m[c.id] = parseFloat(c.price_usd); return m; }, {});
    const enriched = (portfolio.holdings ?? []).map(h => {
      const cur = priceMap[h.coin_id] ?? parseFloat(h.avg_buy_price);
      const qty = parseFloat(h.quantity);
      const avg = parseFloat(h.avg_buy_price);
      const pnl = h.position_type === 'long' ? (cur - avg) * qty : (avg - cur) * qty;
      const pct = avg > 0 ? (h.position_type === 'long' ? (cur - avg) / avg : (avg - cur) / avg) * 100 : 0;
      return { ...h, current_price: cur, unrealized_pnl: pnl, unrealized_pct: pct };
    });
    const totalValue      = enriched.filter(h => h.position_type === 'long').reduce((s, h) => s + h.current_price * parseFloat(h.quantity), 0);
    const totalUnrealized = enriched.reduce((s, h) => s + h.unrealized_pnl, 0);
    setPortfolio(prev => ({ ...prev, holdings: enriched, total_value: totalValue, total_unrealized: totalUnrealized }));
  }, [prices]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: "'Inter', sans-serif", transition: 'all 0.3s' }}>
      <div className="pointer-events-none fixed inset-0 z-[999]" style={{ backgroundImage: darkMode ? 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.04) 3px,rgba(0,0,0,0.04) 4px)' : 'none' }} />

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: `1px solid ${D.border}`, background: D.panel, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: '#a0a0a0' }}>
            AyushCryptoTracker
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: D.textDim }}>
            {clock.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            <span style={{ color: D.text }}>{clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </span>

          {/* Dark/Light toggle */}
          <button onClick={() => setDarkMode(!darkMode)} style={{
            background: darkMode ? '#1a1a35' : '#e2e8f0',
            border: `1px solid ${D.border}`,
            borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: D.text, fontSize: 12, fontWeight: 600, transition: 'all 0.3s'
          }}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          <WsIndicator connected={connected} />
        </div>
      </header>

      {/* Tab nav */}
      <nav style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, background: D.panel, padding: '0 12px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '12px 20px',
            fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 12,
            letterSpacing: '2px', textTransform: 'uppercase',
            borderBottom: `2px solid ${activeTab === t.id ? D.tabActiveBorder : 'transparent'}`,
            color: activeTab === t.id ? D.tabActiveBorder : D.textDim,
            background: 'none', border: 'none',
            borderBottom: `2px solid ${activeTab === t.id ? D.tabActiveBorder : 'transparent'}`,
            cursor: 'pointer', transition: 'all 0.2s'
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: 16 }}>
        {activeTab === 'market'    && <MarketTab    prices={prices} D={D} />}
        {activeTab === 'portfolio' && <PortfolioTab portfolioId={portfolioId} portfolio={portfolio} prices={prices} coins={prices} onRefresh={refreshPortfolio} onToast={showToast} D={D} />}
        {activeTab === 'alerts'    && <AlertsTab    portfolioId={portfolioId} prices={prices} D={D} />}
        {activeTab === 'exchange'  && <ExchangeTab  prices={prices} D={D} />}
      </main>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 6, fontFamily: 'monospace', fontSize: 13,
          background: toast.type === 'error' ? '#450a0a' : '#052e16',
          border: `1px solid ${toast.type === 'error' ? '#dc2626' : '#16a34a'}`,
          color: toast.type === 'error' ? '#fca5a5' : '#86efac',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>{toast.msg}</div>
      )}
    </div>
  );
}
