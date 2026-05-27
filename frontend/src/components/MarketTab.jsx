import { useState, useEffect } from 'react';
import PriceChart from './PriceChart';
import { fetchHistory } from '../api/gateway';

const fmtPrice = n => {
  if (!n && n !== 0) return '—';
  return n > 1
    ? `$${(+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${(+n).toFixed(5)}`;
};
const fmtLarge = n => {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
};

const COIN_COLORS = {
  BTC:'#f7931a', ETH:'#627eea', BNB:'#f0b90b', SOL:'#9945ff',
  ADA:'#0033ad', XRP:'#00aae4', DOGE:'#c2a633', DOT:'#e6007a',
  LTC:'#bfbbbb', LINK:'#375bd2', AVAX:'#e84142', MATIC:'#8247e5',
};

function CoinAvatar({ symbol, size = 36 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: COIN_COLORS[symbol] || '#2e2e5a',
      color: '#fff', fontSize: size * 0.25, fontWeight: 900, fontFamily: 'monospace',
    }}>{symbol.slice(0,3)}</span>
  );
}

export default function MarketTab({ prices, D }) {
  const [search, setSearch]     = useState('');
  const [drawer, setDrawer]     = useState(null);   // coin object
  const [detail, setDetail]     = useState(null);   // CoinGecko data
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = prices.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const openDrawer = async (coin) => {
    setDrawer(coin);
    setDrawerOpen(true);
    setDetail(null);
    setHistory([]);
    setLoading(true);
    try {
      const [histData, cgData] = await Promise.all([
        fetchHistory(coin.id, 100),
        fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`)
          .then(r => r.json()).catch(() => null),
      ]);
      setHistory(histData.history ?? []);
      setDetail(cgData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => { setDrawer(null); setDetail(null); setHistory([]); }, 300);
  };

  const panel = { background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8 };
  const th = { padding: '10px 16px', fontSize: 11, letterSpacing: 2, color: D.textDim, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap' };

  return (
    <div style={{ position: 'relative' }}>
      {/* Drawer overlay */}
      {drawer && (
        <>
          {/* Backdrop */}
          <div onClick={closeDrawer} style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.5)',
            opacity: drawerOpen ? 1 : 0,
            transition: 'opacity 0.3s ease',
            backdropFilter: 'blur(2px)',
          }} />

          {/* Sliding drawer from right */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
            width: 480, maxWidth: '95vw',
            background: D.panel,
            borderLeft: `1px solid ${D.border}`,
            transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
            overflowY: 'auto',
          }}>
            {/* Drawer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${D.border}`,
              position: 'sticky', top: 0, background: D.panel, zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CoinAvatar symbol={drawer.symbol} size={42} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: D.textBright }}>{drawer.name}</div>
                  <div style={{ fontSize: 12, color: D.textDim, fontFamily: 'monospace' }}>{drawer.symbol} / USD</div>
                </div>
              </div>
              <button onClick={closeDrawer} style={{
                background: 'none', border: `1px solid ${D.border}`, color: D.textDim,
                fontSize: 18, cursor: 'pointer', borderRadius: 6, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>×</button>
            </div>

            {/* Price + change */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 800, color: D.textBright }}>{fmtPrice(drawer.price_usd)}</div>
              <span style={{
                fontSize: 13, fontFamily: 'monospace', padding: '4px 10px', borderRadius: 6, fontWeight: 700,
                color: (drawer.change_24h ?? 0) >= 0 ? D.green : D.red,
                background: (drawer.change_24h ?? 0) >= 0 ? `${D.green}18` : `${D.red}18`,
                border: `1px solid ${(drawer.change_24h ?? 0) >= 0 ? D.green : D.red}40`,
              }}>{(drawer.change_24h ?? 0) >= 0 ? '+' : ''}{(drawer.change_24h ?? 0).toFixed(2)}%</span>
            </div>

            {/* Content */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Price Chart */}
              <div style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: D.cyan, textTransform: 'uppercase', marginBottom: 12 }}>Price Chart — 24H</div>
                {loading
                  ? <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontFamily: 'monospace', fontSize: 12 }}>Loading chart…</div>
                  : <PriceChart history={history} coinSymbol={drawer.symbol} D={D} />
                }
              </div>

              {/* Stats grid */}
              {detail && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'All-Time High', value: fmtPrice(detail.market_data?.ath?.usd), sub: detail.market_data?.ath_date?.usd ? new Date(detail.market_data.ath_date.usd).toLocaleDateString() : '' },
                    { label: 'All-Time Low',  value: fmtPrice(detail.market_data?.atl?.usd), sub: detail.market_data?.atl_date?.usd ? new Date(detail.market_data.atl_date.usd).toLocaleDateString() : '' },
                    { label: 'Market Cap',    value: fmtLarge(drawer.market_cap), sub: 'USD' },
                    { label: 'Volume 24H',    value: fmtLarge(drawer.volume_24h), sub: 'USD' },
                    { label: 'Circulating',   value: detail.market_data?.circulating_supply ? `${(detail.market_data.circulating_supply/1e6).toFixed(2)}M` : '—', sub: drawer.symbol },
                    { label: 'Total Supply',  value: detail.market_data?.total_supply ? `${(detail.market_data.total_supply/1e6).toFixed(2)}M` : '∞', sub: drawer.symbol },
                  ].map(s => (
                    <div key={s.label} style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: D.textDim, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>{s.label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: D.textBright }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: D.textDim, marginTop: 2 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* About */}
              {detail?.description?.en && (
                <div style={{ background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: D.textDim, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>About {drawer.name}</div>
                  <p style={{ fontSize: 13, color: D.text, lineHeight: 1.7 }}>
                    {detail.description.en.replace(/<[^>]*>/g, '').slice(0, 500)}…
                  </p>
                </div>
              )}

              {/* Links */}
              {detail?.links && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {detail.links.homepage?.[0] && (
                    <a href={detail.links.homepage[0]} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${D.border}`, color: D.cyan, fontSize: 12, textDecoration: 'none', background: `${D.cyan}10`, fontWeight: 600 }}>
                      🌐 Website
                    </a>
                  )}
                  {detail.links.subreddit_url && (
                    <a href={detail.links.subreddit_url} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${D.border}`, color: D.text, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                      Reddit
                    </a>
                  )}
                  {detail.links.repos_url?.github?.[0] && (
                    <a href={detail.links.repos_url.github[0]} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${D.border}`, color: D.text, fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                      GitHub
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Market Table */}
      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
          <span style={{ fontSize: 11, letterSpacing: 3, color: D.cyan, fontWeight: 700, textTransform: 'uppercase' }}>Live Market</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.textBright, fontFamily: "'Inter', sans-serif", fontSize: 12, padding: '6px 12px', borderRadius: 6, width: 180, outline: 'none' }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Coin', 'Price', '24H %', 'Market Cap', 'Volume 24H', ''].map((h, i) => (
                  <th key={i} style={{ ...th, textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const up = (c.change_24h ?? 0) >= 0;
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${D.border}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = D.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', color: D.textDim, fontSize: 12, width: 36 }}>{i+1}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CoinAvatar symbol={c.symbol} />
                        <div>
                          <div style={{ fontWeight: 700, color: D.textBright, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: D.textDim, fontFamily: 'monospace' }}>{c.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textBright, fontWeight: 600, fontSize: 14 }}>{fmtPrice(c.price_usd)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 12, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
                        color: up ? D.green : D.red,
                        background: up ? `${D.green}18` : `${D.red}18`,
                        border: `1px solid ${up ? D.green : D.red}40`
                      }}>{up ? '+' : ''}{(c.change_24h ?? 0).toFixed(2)}%</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.text, fontSize: 13 }}>{fmtLarge(c.market_cap)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textDim, fontSize: 13 }}>{fmtLarge(c.volume_24h)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => openDrawer(c)} style={{
                        padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
                        border: `1px solid ${D.cyan}50`, color: D.cyan,
                        background: `${D.cyan}10`, fontSize: 11, fontWeight: 700,
                        letterSpacing: 1, transition: 'all 0.2s', whiteSpace: 'nowrap',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${D.cyan}25`; e.currentTarget.style.borderColor = D.cyan; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${D.cyan}10`; e.currentTarget.style.borderColor = `${D.cyan}50`; }}
                      >View History →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
