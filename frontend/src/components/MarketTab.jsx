import { useState } from 'react';
import { Panel, CoinAvatar, Badge, formatPrice, formatLarge, formatPct } from './ui';
import { fetchHistory } from '../api/gateway';
import PriceChart from './PriceChart';
import FearGreedIndex from './FearGreedIndex';

export default function MarketTab({ prices, D }) {
  const [search,       setSearch]       = useState('');
  const [drawer,       setDrawer]       = useState(null);
  const [coinDetail,   setCoinDetail]   = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [watchlist,    setWatchlist]    = useState(function() {
    try {
      const stored = localStorage.getItem('watchlist');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showWatchlist, setShowWatchlist] = useState(false);

  function toggleWatchlist(coinId) {
    const next = new Set(watchlist);
    if (next.has(coinId)) {
      next.delete(coinId);
    } else {
      next.add(coinId);
    }
    setWatchlist(next);
    localStorage.setItem('watchlist', JSON.stringify([...next]));
  }

  const filtered = prices.filter(function(coin) {
    const query     = search.toLowerCase();
    const matchName = coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query);
    const inWatch   = showWatchlist ? watchlist.has(coin.id) : true;
    return matchName && inWatch;
  });

  async function openDrawer(coin) {
    setDrawer(coin);
    setDrawerOpen(true);
    setCoinDetail(null);
    setPriceHistory([]);
    setLoading(true);

    try {
      const historyData = await fetchHistory(coin.id, 100);
      setPriceHistory(historyData.history ?? []);

      const cgResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
      );
      const cgData = await cgResponse.json();
      setCoinDetail(cgData);
    } catch (err) {
      console.error('Drawer load failed:', err.message);
    } finally {
      setLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(function() {
      setDrawer(null);
      setCoinDetail(null);
      setPriceHistory([]);
    }, 300);
  }

  function StatBox({ label, value, sub }) {
    return (
      <div style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: D.textDim, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: D.textBright }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: D.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Fear & Greed Index */}
      <FearGreedIndex D={D} />

      {/* Drawer backdrop */}
      {drawer && (
        <div onClick={closeDrawer} style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)',
          opacity: drawerOpen ? 1 : 0,
          transition: 'opacity 0.3s',
          backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* Sliding drawer */}
      {drawer && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 101,
          width: 460, maxWidth: '95vw',
          background: D.panel,
          borderLeft: `1px solid ${D.border}`,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${D.border}`, position: 'sticky', top: 0, background: D.panel, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CoinAvatar symbol={drawer.symbol} size={40} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: D.textBright }}>{drawer.name}</div>
                <div style={{ fontSize: 12, color: D.textDim }}>{drawer.symbol} / USD</div>
              </div>
            </div>
            <button onClick={closeDrawer} style={{ background: 'none', border: 'none', color: D.textDim, fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${D.border}` }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: D.textBright }}>{formatPrice(drawer.price_usd)}</span>
            <Badge label={formatPct(drawer.change_24h)} color={(drawer.change_24h ?? 0) >= 0 ? D.green : D.red} />
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: D.textDim, marginBottom: 10 }}>Price — Last 24H</div>
              {loading
                ? <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontSize: 13 }}>Loading…</div>
                : <PriceChart history={priceHistory} coinSymbol={drawer.symbol} D={D} />
              }
            </div>

            {coinDetail && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatBox label="All-Time High" value={formatPrice(coinDetail.market_data?.ath?.usd)} sub={coinDetail.market_data?.ath_date?.usd ? new Date(coinDetail.market_data.ath_date.usd).toLocaleDateString() : ''} />
                <StatBox label="All-Time Low"  value={formatPrice(coinDetail.market_data?.atl?.usd)} sub={coinDetail.market_data?.atl_date?.usd ? new Date(coinDetail.market_data.atl_date.usd).toLocaleDateString() : ''} />
                <StatBox label="Market Cap"    value={formatLarge(drawer.market_cap)} />
                <StatBox label="Volume 24H"    value={formatLarge(drawer.volume_24h)} />
                <StatBox label="Circulating"   value={coinDetail.market_data?.circulating_supply ? (coinDetail.market_data.circulating_supply / 1e6).toFixed(2) + 'M' : '—'} sub={drawer.symbol} />
                <StatBox label="Total Supply"  value={coinDetail.market_data?.total_supply ? (coinDetail.market_data.total_supply / 1e6).toFixed(2) + 'M' : '∞'} sub={drawer.symbol} />
              </div>
            )}

            {coinDetail?.description?.en && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: D.textDim, marginBottom: 8 }}>About {drawer.name}</div>
                <p style={{ fontSize: 13, color: D.text, lineHeight: 1.7 }}>
                  {coinDetail.description.en.replace(/<[^>]*>/g, '').slice(0, 400)}…
                </p>
              </div>
            )}

            {coinDetail?.links && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {coinDetail.links.homepage?.[0] && (
                  <a href={coinDetail.links.homepage[0]} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: D.blue, padding: '5px 12px', borderRadius: 5, border: `1px solid ${D.border}`, textDecoration: 'none' }}>
                    Website ↗
                  </a>
                )}
                {coinDetail.links.subreddit_url && (
                  <a href={coinDetail.links.subreddit_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: D.text, padding: '5px 12px', borderRadius: 5, border: `1px solid ${D.border}`, textDecoration: 'none' }}>
                    Reddit ↗
                  </a>
                )}
                {coinDetail.links.repos_url?.github?.[0] && (
                  <a href={coinDetail.links.repos_url.github[0]} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: D.text, padding: '5px 12px', borderRadius: 5, border: `1px solid ${D.border}`, textDecoration: 'none' }}>
                    GitHub ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market table */}
      <Panel D={D}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${D.border}`, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>Live Market</span>
            <button
              onClick={() => setShowWatchlist(!showWatchlist)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${D.border}`, background: showWatchlist ? D.gold + '20' : 'transparent', color: showWatchlist ? D.gold : D.textDim, cursor: 'pointer' }}
            >
              ★ Watchlist {watchlist.size > 0 ? `(${watchlist.size})` : ''}
            </button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search coins…"
            style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: D.textBright, outline: 'none', width: 160 }}
          />
        </div>

        {showWatchlist && watchlist.size === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>★</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: D.textBright, marginBottom: 6 }}>No coins in watchlist</div>
            <div style={{ fontSize: 13, color: D.textDim }}>Click the star icon next to any coin to add it here</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                {['#', 'Coin', 'Price', '24H', 'Market Cap', 'Volume', ''].map(function(h, i) {
                  return (
                    <th key={i} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 500, color: D.textDim, textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(coin, index) {
                const isPositive = (coin.change_24h ?? 0) >= 0;
                const isStarred  = watchlist.has(coin.id);
                return (
                  <tr
                    key={coin.id}
                    style={{ borderBottom: `1px solid ${D.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = D.hover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 12, color: D.textDim, width: 36 }}>{index + 1}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CoinAvatar symbol={coin.symbol} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>{coin.name}</div>
                          <div style={{ fontSize: 11, color: D.textDim }}>{coin.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: D.textBright }}>{formatPrice(coin.price_usd)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Badge label={formatPct(coin.change_24h)} color={isPositive ? D.green : D.red} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: D.text }}>{formatLarge(coin.market_cap)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: D.textDim }}>{formatLarge(coin.volume_24h)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => toggleWatchlist(coin.id)}
                          title={isStarred ? 'Remove from watchlist' : 'Add to watchlist'}
                          style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: isStarred ? D.gold : D.textDim, padding: '0 2px', lineHeight: 1 }}
                        >
                          {isStarred ? '★' : '☆'}
                        </button>
                        <button
                          onClick={() => openDrawer(coin)}
                          style={{ fontSize: 12, color: D.blue, background: 'none', border: `1px solid ${D.border}`, borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
