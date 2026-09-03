import { useState, useCallback, useEffect } from 'react';
import { Panel, CoinAvatar, Badge, formatPnl, formatPct, formatQty, formatPrice, formatTime, COIN_COLORS } from './ui';
import TradeModal from './TradeModal';
import { squareOffAll, fetchHistory, getErrorMessage } from '../api/gateway';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const SUBTABS  = ['Holdings', 'History', 'Closed', 'Performance'];
const PER_PAGE = 10;

export default function PortfolioTab({ portfolioId, portfolio, prices, coins, onRefresh, D }) {
  const [subTab,      setSubTab]      = useState('Holdings');
  const [showTrade,   setShowTrade]   = useState(false);
  const [showSquare,  setShowSquare]  = useState(false);
  const [squareLoad,  setSquareLoad]  = useState(false);
  const [squareErr,   setSquareErr]   = useState('');
  const [perfData,    setPerfData]    = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [holdSearch,  setHoldSearch]  = useState('');
  const [tradePage,   setTradePage]   = useState(1);

  const getPrice = useCallback(function(coinId) {
    const coin = prices.find(p => p.id === coinId);
    return coin ? parseFloat(coin.price_usd) : 0;
  }, [prices]);

  useEffect(function loadPerformanceData() {
    if (subTab !== 'Performance') return;
    const holdings = portfolio?.holdings ?? [];
    if (!holdings.length) return;

    setPerfLoading(true);

    const requests = holdings.map(h =>
      fetchHistory(h.coin_id, 48).then(d => ({ coinId: h.coin_id, history: d.history ?? [], holding: h }))
    );

    Promise.all(requests).then(function(results) {
      const times = results[0]?.history.map(r => r.created_at) ?? [];
      const data  = times.map(function(t) {
        let totalValue = 0;
        results.forEach(function({ history, holding }) {
          const point = history.find(h => h.created_at === t);
          if (point && holding.position_type === 'long') {
            totalValue += parseFloat(point.price_usd) * parseFloat(holding.quantity);
          }
        });
        return {
          t:     new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: parseFloat(totalValue.toFixed(2)),
        };
      }).filter(d => d.value > 0);
      setPerfData(data);
    }).catch(console.error).finally(() => setPerfLoading(false));
  }, [subTab, portfolio?.holdings]);

  async function handleSquareOff() {
    setSquareLoad(true);
    setSquareErr('');
    try {
      await squareOffAll(portfolioId);
      setShowSquare(false);
      onRefresh();
    } catch (err) {
      setSquareErr(getErrorMessage(err));
    } finally {
      setSquareLoad(false);
    }
  }

  const holdings = portfolio?.holdings         ?? [];
  const trades   = portfolio?.trades           ?? [];
  const closed   = portfolio?.closed_positions ?? [];
  const totalVal = portfolio?.total_value      ?? 0;
  const totalUnr = portfolio?.total_unrealized ?? 0;
  const totalRel = portfolio?.total_realized   ?? 0;

  // Filter holdings by search
  const filteredHoldings = holdings.filter(function(h) {
    return h.coin_symbol.toLowerCase().includes(holdSearch.toLowerCase());
  });

  // Paginate trades
  const totalPages   = Math.ceil(trades.length / PER_PAGE);
  const pagedTrades  = trades.slice((tradePage - 1) * PER_PAGE, tradePage * PER_PAGE);

  // Pie chart data — long positions only
  const pieData = holdings
    .filter(h => h.position_type === 'long')
    .map(function(h) {
      return {
        name:  h.coin_symbol,
        value: parseFloat(h.current_price ?? getPrice(h.coin_id)) * parseFloat(h.quantity),
        color: COIN_COLORS[h.coin_symbol] || '#888888',
      };
    })
    .filter(d => d.value > 0);

  function SummaryCard({ label, value, color }) {
    return (
      <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, padding: '16px' }}>
        <div style={{ fontSize: 12, color: D.textDim, marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: color || D.textBright }}>{value}</div>
      </div>
    );
  }

  function Th({ children, right }) {
    return <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 500, color: D.textDim, textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${D.border}` }}>{children}</th>;
  }

  function Td({ children, right, style }) {
    return <td style={{ padding: '12px 16px', fontSize: 13, color: D.text, textAlign: right ? 'right' : 'left', borderBottom: `1px solid ${D.border}`, ...style }}>{children}</td>;
  }

  function EmptyState({ icon, title, subtitle }) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: D.textBright, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: D.textDim }}>{subtitle}</div>
      </div>
    );
  }

  function PerfTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px' }}>
        <div style={{ fontSize: 11, color: D.textDim }}>{payload[0].payload.t}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>
          ${payload[0].value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
      </div>
    );
  }

  function PieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: D.textBright }}>{payload[0].name}</div>
        <div style={{ fontSize: 12, color: D.textDim }}>${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div style={{ fontSize: 11, color: D.textDim }}>{((payload[0].value / totalVal) * 100).toFixed(1)}%</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <SummaryCard label="Portfolio Value"  value={'$' + totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
        <SummaryCard label="Unrealized P&L"   value={formatPnl(totalUnr)} color={totalUnr >= 0 ? D.green : D.red} />
        <SummaryCard label="Realized P&L"     value={formatPnl(totalRel)} color={totalRel >= 0 ? D.green : D.red} />
      </div>

      {/* Subtab nav + actions */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${D.border}` }}>
        {SUBTABS.map(function(tab) {
          const isActive = subTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              style={{ padding: '10px 16px', fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? D.textBright : D.textDim, background: 'none', border: 'none', borderBottom: `2px solid ${isActive ? D.textBright : 'transparent'}`, cursor: 'pointer' }}
            >
              {tab}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
          <button onClick={() => setShowTrade(true)} style={{ fontSize: 12, fontWeight: 500, color: D.blue, background: 'none', border: `1px solid ${D.border}`, borderRadius: 5, padding: '5px 12px', cursor: 'pointer' }}>
            New Trade
          </button>
          <button onClick={() => setShowSquare(true)} style={{ fontSize: 12, fontWeight: 500, color: D.red, background: 'none', border: `1px solid ${D.border}`, borderRadius: 5, padding: '5px 12px', cursor: 'pointer' }}>
            Square Off All
          </button>
        </div>
      </div>

      {/* Holdings */}
      {subTab === 'Holdings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Portfolio pie chart */}
          {pieData.length > 0 && (
            <Panel D={D}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>
                Portfolio Breakdown
              </div>
              <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 24 }}>
                <ResponsiveContainer width={200} height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                      {pieData.map(function(entry, index) {
                        return <Cell key={index} fill={entry.color} />;
                      })}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pieData.map(function(entry) {
                    const pct = totalVal > 0 ? ((entry.value / totalVal) * 100).toFixed(1) : 0;
                    return (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: D.textBright, fontWeight: 500, width: 50 }}>{entry.name}</span>
                        <span style={{ fontSize: 12, color: D.textDim }}>{pct}%</span>
                        <span style={{ fontSize: 12, color: D.text }}>${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}

          {/* Holdings table with search */}
          <Panel D={D}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>Open Positions</span>
              {holdings.length > 3 && (
                <input
                  value={holdSearch}
                  onChange={e => setHoldSearch(e.target.value)}
                  placeholder="Filter by coin…"
                  style={{ background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 12, color: D.textBright, outline: 'none', width: 140 }}
                />
              )}
            </div>
            {filteredHoldings.length === 0
              ? <EmptyState icon="📊" title="No open positions" subtitle="Execute a trade to open your first position" />
              : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Coin</Th><Th>Type</Th><Th right>Qty</Th><Th right>Avg Entry</Th><Th right>Current</Th><Th right>P&L</Th><Th right>P&L %</Th></tr></thead>
                  <tbody>
                    {filteredHoldings.map(function(h) {
                      const pnl = parseFloat(h.unrealized_pnl ?? 0);
                      const pct = parseFloat(h.unrealized_pct ?? 0);
                      const cur = parseFloat(h.current_price  ?? getPrice(h.coin_id));
                      return (
                        <tr key={h.id}>
                          <Td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CoinAvatar symbol={h.coin_symbol} size={28} /><span style={{ fontWeight: 600, color: D.textBright }}>{h.coin_symbol}</span></div></Td>
                          <Td><Badge label={h.position_type} color={h.position_type === 'long' ? D.green : D.red} /></Td>
                          <Td right style={{ color: D.textBright }}>{formatQty(h.quantity)}</Td>
                          <Td right style={{ color: D.textDim }}>{formatPrice(h.avg_buy_price)}</Td>
                          <Td right style={{ color: D.textBright, fontWeight: 600 }}>{formatPrice(cur)}</Td>
                          <Td right style={{ color: pnl >= 0 ? D.green : D.red, fontWeight: 600 }}>{formatPnl(pnl)}</Td>
                          <Td right><Badge label={formatPct(pct)} color={pct >= 0 ? D.green : D.red} /></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
          </Panel>
        </div>
      )}

      {/* Trade History with pagination + notes */}
      {subTab === 'History' && (
        <Panel D={D}>
          {trades.length === 0
            ? <EmptyState icon="📝" title="No trades yet" subtitle="Your trade history will appear here after your first trade" />
            : <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><Th>Time</Th><Th>Coin</Th><Th>Type</Th><Th right>Qty</Th><Th right>Price</Th><Th right>Total</Th><Th>Notes</Th></tr></thead>
                  <tbody>
                    {pagedTrades.map(function(t) {
                      const typeColors = { buy: D.green, sell: D.red, short: D.gold, cover: D.blue };
                      return (
                        <tr key={t.id}>
                          <Td style={{ color: D.textDim, fontSize: 12 }}>{formatTime(t.created_at)}</Td>
                          <Td style={{ fontWeight: 600, color: D.textBright }}>{t.coin_symbol}</Td>
                          <Td><Badge label={t.trade_type} color={typeColors[t.trade_type] || D.text} /></Td>
                          <Td right>{formatQty(t.quantity)}</Td>
                          <Td right style={{ color: D.textDim }}>{formatPrice(t.price)}</Td>
                          <Td right style={{ color: D.textBright, fontWeight: 600 }}>${parseFloat(t.total_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Td>
                          <Td style={{ color: D.textDim, fontSize: 12, maxWidth: 180 }}>{t.notes || '—'}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${D.border}` }}>
                    <span style={{ fontSize: 12, color: D.textDim }}>
                      Page {tradePage} of {totalPages} · {trades.length} trades total
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setTradePage(p => Math.max(1, p - 1))}
                        disabled={tradePage === 1}
                        style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${D.border}`, borderRadius: 5, background: 'none', color: D.text, cursor: tradePage === 1 ? 'not-allowed' : 'pointer', opacity: tradePage === 1 ? 0.4 : 1 }}
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => setTradePage(p => Math.min(totalPages, p + 1))}
                        disabled={tradePage === totalPages}
                        style={{ padding: '5px 12px', fontSize: 12, border: `1px solid ${D.border}`, borderRadius: 5, background: 'none', color: D.text, cursor: tradePage === totalPages ? 'not-allowed' : 'pointer', opacity: tradePage === totalPages ? 0.4 : 1 }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
          }
        </Panel>
      )}

      {/* Closed Positions */}
      {subTab === 'Closed' && (
        <Panel D={D}>
          {closed.length === 0
            ? <EmptyState icon="✅" title="No closed positions" subtitle="Positions you fully close will appear here with their realized P&L" />
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Closed</Th><Th>Coin</Th><Th>Type</Th><Th right>Qty</Th><Th right>Entry</Th><Th right>Exit</Th><Th right>Realized P&L</Th></tr></thead>
                <tbody>
                  {closed.map(function(p) {
                    const pnl = parseFloat(p.realized_pnl);
                    return (
                      <tr key={p.id}>
                        <Td style={{ color: D.textDim, fontSize: 12 }}>{formatTime(p.closed_at)}</Td>
                        <Td style={{ fontWeight: 600, color: D.textBright }}>{p.coin_symbol}</Td>
                        <Td><Badge label={p.position_type} color={p.position_type === 'long' ? D.green : D.red} /></Td>
                        <Td right>{formatQty(p.quantity)}</Td>
                        <Td right style={{ color: D.textDim }}>{formatPrice(p.entry_price)}</Td>
                        <Td right>{formatPrice(p.exit_price)}</Td>
                        <Td right style={{ color: pnl >= 0 ? D.green : D.red, fontWeight: 600 }}>{formatPnl(pnl)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </Panel>
      )}

      {/* Performance */}
      {subTab === 'Performance' && (
        <Panel D={D}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>
            Portfolio Value — Last 24H
          </div>
          <div style={{ padding: 16 }}>
            {perfLoading
              ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontSize: 13 }}>Building chart…</div>
              : perfData.length < 2
              ? <EmptyState icon="📈" title="Not enough data yet" subtitle="Performance data accumulates every 60 seconds as prices update" />
              : <>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, color: D.textDim, marginBottom: 3 }}>Start</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: D.textBright }}>${perfData[0]?.value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: D.textDim, marginBottom: 3 }}>Now</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: D.textBright }}>${perfData[perfData.length - 1]?.value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: D.textDim, marginBottom: 3 }}>Change</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: (perfData[perfData.length-1]?.value - perfData[0]?.value) >= 0 ? D.green : D.red }}>
                        {formatPnl(perfData[perfData.length-1]?.value - perfData[0]?.value)}
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={perfData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={D.border} />
                      <XAxis dataKey="t" tick={{ fill: D.textDim, fontSize: 10 }} tickLine={false} axisLine={{ stroke: D.border }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: D.textDim, fontSize: 10 }} tickLine={false} axisLine={false} width={64} tickFormatter={v => '$' + (v / 1000).toFixed(1) + 'k'} />
                      <Tooltip content={<PerfTooltip />} />
                      <Line type="monotone" dataKey="value" stroke={D.blue} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: D.blue }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
            }
          </div>
        </Panel>
      )}

      {/* Trade Modal */}
      {showTrade && (
        <TradeModal portfolioId={portfolioId} coins={coins} getPrice={getPrice} D={D}
          onClose={() => setShowTrade(false)} onSuccess={onRefresh} />
      )}

      {/* Square Off Modal */}
      {showSquare && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSquare(false)}>
          <div className="slide-up" style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 10, padding: 24, width: '90%', maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: D.textBright, marginBottom: 10 }}>Square Off All Positions?</div>
            <p style={{ fontSize: 13, color: D.text, lineHeight: 1.6, marginBottom: 16 }}>
              This will close all {holdings.length} open position{holdings.length !== 1 ? 's' : ''} at current market prices. This cannot be undone.
            </p>
            {squareErr && <div style={{ fontSize: 12, color: D.red, marginBottom: 12 }}>{squareErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSquare(false)} style={{ flex: 1, padding: 9, borderRadius: 6, border: `1px solid ${D.border}`, background: 'none', color: D.text, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSquareOff} disabled={squareLoad} style={{ flex: 1, padding: 9, borderRadius: 6, border: 'none', background: D.red, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: squareLoad ? 0.6 : 1 }}>
                {squareLoad ? 'Closing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
