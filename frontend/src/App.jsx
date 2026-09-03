import { useState, useEffect, useCallback } from 'react';
import { usePrices } from './hooks/usePrices';
import { initPortfolio, fetchPortfolio, fetchTrades, fetchClosedPositions } from './api/gateway';
import MarketTab     from './components/MarketTab';
import PortfolioTab  from './components/PortfolioTab';
import AlertsTab     from './components/AlertsTab';
import ExchangeTab   from './components/ExchangeTab';
import BlockchainTab from './components/BlockchainTab';
import WsIndicator   from './components/WsIndicator';

const TABS = [
  { id: 'market',     label: 'Market'     },
  { id: 'portfolio',  label: 'Portfolio'  },
  { id: 'alerts',     label: 'Alerts'     },
  { id: 'exchange',   label: 'Exchange'   },
  { id: 'blockchain', label: 'Blockchain' },
];

function buildTheme(dark) {
  if (dark) {
    return {
      bg:         '#0a0a0a',
      panel:      '#111111',
      panel2:     '#161616',
      border:     '#222222',
      text:       '#888888',
      textBright: '#ededed',
      textDim:    '#444444',
      green:      '#22c55e',
      red:        '#ef4444',
      blue:       '#3b82f6',
      gold:       '#f59e0b',
      hover:      'rgba(255,255,255,0.04)',
      shadow:     '0 1px 3px rgba(0,0,0,0.4)',
    };
  }
  return {
    bg:         '#fafafa',
    panel:      '#ffffff',
    panel2:     '#f5f5f5',
    border:     '#e5e5e5',
    text:       '#737373',
    textBright: '#0a0a0a',
    textDim:    '#a3a3a3',
    green:      '#16a34a',
    red:        '#dc2626',
    blue:       '#2563eb',
    gold:       '#d97706',
    hover:      'rgba(0,0,0,0.03)',
    shadow:     '0 1px 3px rgba(0,0,0,0.08)',
  };
}

export default function App() {
  const { prices, connected } = usePrices();

  const [activeTab,   setActiveTab]   = useState('market');
  const [portfolioId, setPortfolioId] = useState(null);
  const [portfolio,   setPortfolio]   = useState(null);
  const [toast,       setToast]       = useState(null);
  const [clock,       setClock]       = useState(new Date());
  const [darkMode,    setDarkMode]    = useState(true);

  const D = buildTheme(darkMode);

  useEffect(function startClock() {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(function loadPortfolio() {
    initPortfolio()
      .then(data => setPortfolioId(data.portfolioId))
      .catch(err  => console.error('initPortfolio failed:', err.message));
  }, []);

  const refreshPortfolio = useCallback(async function() {
    if (!portfolioId) return;
    try {
      const [portData, tradeData, closedData] = await Promise.all([
        fetchPortfolio(portfolioId),
        fetchTrades(portfolioId),
        fetchClosedPositions(portfolioId),
      ]);
      setPortfolio({
        ...portData,
        trades:           tradeData.trades            ?? [],
        closed_positions: closedData.closed_positions ?? [],
      });
    } catch (err) {
      console.error('refreshPortfolio failed:', err.message);
    }
  }, [portfolioId]);

  useEffect(function loadOnPortfolioReady() {
    refreshPortfolio();
  }, [refreshPortfolio]);

  useEffect(function recalcPnlOnPriceUpdate() {
    if (!portfolio || !prices.length) return;

    const priceMap = {};
    prices.forEach(coin => { priceMap[coin.id] = parseFloat(coin.price_usd); });

    const enrichedHoldings = (portfolio.holdings ?? []).map(function(holding) {
      const currentPrice = priceMap[holding.coin_id] ?? parseFloat(holding.avg_buy_price);
      const quantity     = parseFloat(holding.quantity);
      const avgPrice     = parseFloat(holding.avg_buy_price);

      const unrealizedPnl = holding.position_type === 'long'
        ? (currentPrice - avgPrice) * quantity
        : (avgPrice - currentPrice) * quantity;

      const unrealizedPct = avgPrice > 0
        ? (holding.position_type === 'long'
            ? (currentPrice - avgPrice) / avgPrice
            : (avgPrice - currentPrice) / avgPrice) * 100
        : 0;

      return { ...holding, current_price: currentPrice, unrealized_pnl: unrealizedPnl, unrealized_pct: unrealizedPct };
    });

    const totalValue      = enrichedHoldings
      .filter(h => h.position_type === 'long')
      .reduce((sum, h) => sum + h.current_price * parseFloat(h.quantity), 0);

    const totalUnrealized = enrichedHoldings
      .reduce((sum, h) => sum + h.unrealized_pnl, 0);

    setPortfolio(prev => ({
      ...prev,
      holdings:        enrichedHoldings,
      total_value:     totalValue,
      total_unrealized: totalUnrealized,
    }));
  }, [prices]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const timeString = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateString = clock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: 'Inter, sans-serif', transition: 'background 0.2s, color 0.2s' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, borderBottom: `1px solid ${D.border}`, background: D.panel }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: D.textBright, letterSpacing: '-0.3px' }}>
          AyushCryptoTracker
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: D.textDim }}>
            {dateString} · {timeString}
          </span>

          <WsIndicator connected={connected} D={D} />

          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{ fontSize: 12, color: D.text, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
          >
            {darkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, background: D.panel, padding: '0 24px' }}>
        {TABS.map(function(tab) {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0 16px',
                height: 44,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? D.textBright : D.textDim,
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? D.textBright : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Page content */}
      <main style={{ padding: '20px 24px', maxWidth: 1280, margin: '0 auto' }}>
        {activeTab === 'market'     && <MarketTab     prices={prices} D={D} />}
        {activeTab === 'portfolio'  && <PortfolioTab  portfolioId={portfolioId} portfolio={portfolio} prices={prices} coins={prices} onRefresh={refreshPortfolio} onToast={showToast} D={D} />}
        {activeTab === 'alerts'     && <AlertsTab     portfolioId={portfolioId} prices={prices} D={D} />}
        {activeTab === 'exchange'   && <ExchangeTab   prices={prices} D={D} />}
        {activeTab === 'blockchain' && <BlockchainTab D={D} />}
      </main>

      {/* Toast */}
      {toast && (
        <div
          className="slide-up"
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
            padding: '10px 16px', borderRadius: 8,
            background: toast.type === 'error' ? D.red : D.green,
            color: '#ffffff', fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
