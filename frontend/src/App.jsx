import { useState, useEffect, useCallback } from 'react';
import { usePrices } from './hooks/usePrices';
import { initPortfolio, fetchPortfolio, fetchTrades, fetchClosedPositions, listPortfolios } from './api/gateway';
import MarketTab        from './components/MarketTab';
import PortfolioTab     from './components/PortfolioTab';
import AlertsTab        from './components/AlertsTab';
import ExchangeTab      from './components/ExchangeTab';
import BlockchainTab    from './components/BlockchainTab';
import WsIndicator      from './components/WsIndicator';
import PortfolioSwitcher from './components/PortfolioSwitcher';

const TABS = [
  { id: 'market',     label: 'Market',     key: 'M' },
  { id: 'portfolio',  label: 'Portfolio',  key: 'P' },
  { id: 'alerts',     label: 'Alerts',     key: 'A' },
  { id: 'exchange',   label: 'Exchange',   key: 'E' },
  { id: 'blockchain', label: 'Blockchain', key: 'B' },
];

function buildTheme(dark) {
  if (dark) {
    return {
      bg: '#0a0a0a', panel: '#111111', panel2: '#161616', border: '#222222',
      text: '#888888', textBright: '#ededed', textDim: '#444444',
      green: '#22c55e', red: '#ef4444', blue: '#3b82f6', gold: '#f59e0b',
      hover: 'rgba(255,255,255,0.04)', shadow: '0 1px 3px rgba(0,0,0,0.4)',
    };
  }
  return {
    bg: '#fafafa', panel: '#ffffff', panel2: '#f5f5f5', border: '#e5e5e5',
    text: '#737373', textBright: '#0a0a0a', textDim: '#a3a3a3',
    green: '#16a34a', red: '#dc2626', blue: '#2563eb', gold: '#d97706',
    hover: 'rgba(0,0,0,0.03)', shadow: '0 1px 3px rgba(0,0,0,0.08)',
  };
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(function() {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(function watchResize() {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

function ShortcutsModal({ onClose, D }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="slide-up" style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, padding: 24, width: 340, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: D.textBright }}>Keyboard Shortcuts</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: D.textDim, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'M', desc: 'Go to Market tab' },
            { key: 'P', desc: 'Go to Portfolio tab' },
            { key: 'A', desc: 'Go to Alerts tab' },
            { key: 'E', desc: 'Go to Exchange tab' },
            { key: 'B', desc: 'Go to Blockchain tab' },
            { key: '?', desc: 'Show this dialog' },
            { key: 'Esc', desc: 'Close any modal' },
          ].map(function(s) {
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: D.text }}>{s.desc}</span>
                <kbd style={{ fontSize: 11, fontWeight: 600, color: D.textBright, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 4, padding: '3px 8px', fontFamily: 'monospace' }}>{s.key}</kbd>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { prices, connected } = usePrices();
  const isMobile = useIsMobile();

  const [activeTab,     setActiveTab]     = useState('market');
  const [portfolioId,   setPortfolioId]   = useState(null);
  const [portfolioList, setPortfolioList] = useState([]);
  const [portfolio,     setPortfolio]     = useState(null);
  const [toast,         setToast]         = useState(null);
  const [clock,         setClock]         = useState(new Date());
  const [darkMode,      setDarkMode]      = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const D = buildTheme(darkMode);

  useEffect(function startClock() {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshPortfolioList = useCallback(async function() {
    try {
      const data = await listPortfolios();
      setPortfolioList(data.portfolios ?? []);
    } catch (err) {
      console.error('listPortfolios failed:', err.message);
    }
  }, []);

  useEffect(function bootstrap() {
    initPortfolio()
      .then(function(data) {
        setPortfolioId(data.portfolioId);
        return refreshPortfolioList();
      })
      .catch(err => console.error('initPortfolio failed:', err.message));
  }, [refreshPortfolioList]);

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

  useEffect(function loadOnPortfolioChange() {
    refreshPortfolio();
  }, [refreshPortfolio]);

  useEffect(function recalcPnlOnPriceUpdate() {
    if (!portfolio || !prices.length) return;

    const priceMap = {};
    prices.forEach(coin => { priceMap[coin.id] = parseFloat(coin.price_usd); });

    const enrichedHoldings = (portfolio.holdings ?? []).map(function(holding) {
      const currentPrice  = priceMap[holding.coin_id] ?? parseFloat(holding.avg_buy_price);
      const quantity      = parseFloat(holding.quantity);
      const avgPrice      = parseFloat(holding.avg_buy_price);
      const unrealizedPnl = holding.position_type === 'long'
        ? (currentPrice - avgPrice) * quantity
        : (avgPrice - currentPrice) * quantity;
      const unrealizedPct = avgPrice > 0
        ? (holding.position_type === 'long' ? (currentPrice - avgPrice) / avgPrice : (avgPrice - currentPrice) / avgPrice) * 100
        : 0;
      return { ...holding, current_price: currentPrice, unrealized_pnl: unrealizedPnl, unrealized_pct: unrealizedPct };
    });

    const totalValue      = enrichedHoldings.filter(h => h.position_type === 'long').reduce((sum, h) => sum + h.current_price * parseFloat(h.quantity), 0);
    const totalUnrealized = enrichedHoldings.reduce((sum, h) => sum + h.unrealized_pnl, 0);

    setPortfolio(prev => ({ ...prev, holdings: enrichedHoldings, total_value: totalValue, total_unrealized: totalUnrealized }));
  }, [prices]);

  useEffect(function setupKeyboardShortcuts() {
    function handleKeyDown(event) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const keyMap = { m: 'market', p: 'portfolio', a: 'alerts', e: 'exchange', b: 'blockchain' };
      const key    = event.key.toLowerCase();

      if (keyMap[key]) setActiveTab(keyMap[key]);
      else if (key === '?') setShowShortcuts(prev => !prev);
      else if (key === 'escape') setShowShortcuts(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const timeString = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateString = clock.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: D.bg, color: D.text, fontFamily: 'Inter, sans-serif', transition: 'background 0.2s, color 0.2s' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 14px' : '0 24px', height: 56, borderBottom: `1px solid ${D.border}`, background: D.panel, flexWrap: 'nowrap' }}>
        <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: D.textBright, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
          {isMobile ? 'ACT' : 'AyushCryptoTracker'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          {!isMobile && portfolioList.length > 0 && (
            <PortfolioSwitcher
              portfolios={portfolioList}
              activeId={portfolioId}
              onSwitch={setPortfolioId}
              onRefreshList={refreshPortfolioList}
              D={D}
            />
          )}

          {!isMobile && (
            <span style={{ fontSize: 12, color: D.textDim }}>{dateString} · {timeString}</span>
          )}

          <WsIndicator connected={connected} D={D} />

          {!isMobile && (
            <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)" style={{ fontSize: 12, color: D.textDim, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>?</button>
          )}

          <button onClick={() => setDarkMode(!darkMode)} style={{ fontSize: 12, color: D.text, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            {darkMode ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      {/* Tab navigation — scrollable on mobile */}
      <nav style={{ display: 'flex', borderBottom: `1px solid ${D.border}`, background: D.panel, padding: isMobile ? '0 8px' : '0 24px', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(function(tab) {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ padding: isMobile ? '0 14px' : '0 16px', height: 44, fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? D.textBright : D.textDim, background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? D.textBright : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Mobile portfolio switcher below nav */}
      {isMobile && portfolioList.length > 0 && activeTab === 'portfolio' && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, background: D.panel }}>
          <PortfolioSwitcher
            portfolios={portfolioList}
            activeId={portfolioId}
            onSwitch={setPortfolioId}
            onRefreshList={refreshPortfolioList}
            D={D}
          />
        </div>
      )}

      {/* Content */}
      <main style={{ padding: isMobile ? '14px' : '20px 24px', maxWidth: 1280, margin: '0 auto' }}>
        {activeTab === 'market'     && <MarketTab     prices={prices} D={D} isMobile={isMobile} />}
        {activeTab === 'portfolio'  && <PortfolioTab  portfolioId={portfolioId} portfolio={portfolio} prices={prices} coins={prices} onRefresh={refreshPortfolio} onToast={showToast} D={D} isMobile={isMobile} />}
        {activeTab === 'alerts'     && <AlertsTab     portfolioId={portfolioId} prices={prices} D={D} isMobile={isMobile} />}
        {activeTab === 'exchange'   && <ExchangeTab   prices={prices} D={D} isMobile={isMobile} />}
        {activeTab === 'blockchain' && <BlockchainTab D={D} isMobile={isMobile} />}
      </main>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} D={D} />}

      {toast && (
        <div className="slide-up" style={{ position: 'fixed', bottom: 20, right: 20, left: isMobile ? 20 : 'auto', zIndex: 9999, padding: '10px 16px', borderRadius: 8, background: toast.type === 'error' ? D.red : D.green, color: '#ffffff', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
