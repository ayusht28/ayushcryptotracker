import { useState, useCallback, useEffect } from 'react';
import TradeModal from './TradeModal';
import PriceChart from './PriceChart';
import { squareOffAll, fetchHistory, getErrorMessage } from '../api/gateway';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmtUsd = n => {
  if (n === undefined || n === null) return '—';
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtPnl = n => {
  if (n === undefined || n === null) return '—';
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtQty  = n => n ? (+n).toFixed(Math.abs(+n) < 1 ? 6 : 4).replace(/\.?0+$/, '') : '—';
const fmtPct  = n => `${n >= 0 ? '+' : ''}${(+n).toFixed(2)}%`;
const fmtTime = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const TRADE_COLORS_MAP = { buy: '#00ff88', sell: '#ff3355', short: '#ffd700', cover: '#00d4ff' };

export default function PortfolioTab({ portfolioId, portfolio, prices, coins, onRefresh, D }) {
  const [subTab, setSubTab]       = useState('holdings');
  const [showTrade, setShowTrade] = useState(false);
  const [showSqOff, setShowSqOff] = useState(false);
  const [sqLoading, setSqLoading] = useState(false);
  const [sqError, setSqError]     = useState('');
  const [perfData, setPerfData]   = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);

  const getPrice = useCallback(coinId => {
    const c = prices.find(p => p.id === coinId);
    return c ? parseFloat(c.price_usd) : 0;
  }, [prices]);

  // Build portfolio performance data from price history
  useEffect(() => {
    if (subTab !== 'performance') return;
    const holdings = portfolio?.holdings ?? [];
    if (!holdings.length) return;
    setPerfLoading(true);

    Promise.all(holdings.map(h => fetchHistory(h.coin_id, 48).then(d => ({ coinId: h.coin_id, history: d.history ?? [], holding: h }))))
      .then(results => {
        // Find common timestamps
        const allTimes = results[0]?.history.map(r => r.created_at) ?? [];
        const data = allTimes.map(t => {
          let totalVal = 0;
          results.forEach(({ history, holding }) => {
            const point = history.find(h => h.created_at === t);
            if (point && holding.position_type === 'long') {
              totalVal += parseFloat(point.price_usd) * parseFloat(holding.quantity);
            }
          });
          return {
            t: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: parseFloat(totalVal.toFixed(2))
          };
        }).filter(d => d.value > 0);
        setPerfData(data);
      })
      .catch(console.error)
      .finally(() => setPerfLoading(false));
  }, [subTab, portfolio?.holdings]);

  const handleSquareOff = async () => {
    setSqLoading(true); setSqError('');
    try {
      await squareOffAll(portfolioId);
      setShowSqOff(false);
      onRefresh();
    } catch (err) {
      setSqError(getErrorMessage(err));
    } finally {
      setSqLoading(false);
    }
  };

  const { holdings = [], trades = [], closed_positions: closed = [], total_value, total_unrealized, total_realized } = portfolio || {};

  const panel = { background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8 };
  const th = { padding: '10px 16px', fontSize: 11, letterSpacing: 2, color: D.textDim, fontWeight: 700, textTransform: 'uppercase', borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap' };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: D.panel, border: `1px solid ${D.border}`, padding: '8px 12px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12 }}>
        <div style={{ color: D.textDim }}>{payload[0].payload.t}</div>
        <div style={{ color: D.textBright, fontWeight: 700 }}>${payload[0].value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Portfolio Value',  val: fmtUsd(total_value),      color: D.cyan },
          { label: 'Unrealized P&L',   val: fmtPnl(total_unrealized), color: (total_unrealized ?? 0) >= 0 ? D.green : D.red },
          { label: 'Realized P&L',     val: fmtPnl(total_realized),   color: (total_realized ?? 0)   >= 0 ? D.green : D.red },
        ].map(s => (
          <div key={s.label} style={{ ...panel, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: D.textDim, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${D.border}` }}>
        {['holdings', 'history', 'closed', 'performance'].map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: `2px solid ${subTab === t ? D.cyan : 'transparent'}`,
            color: subTab === t ? D.cyan : D.textDim,
            fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 0.2s'
          }}>{t}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, paddingBottom: 4 }}>
          <button onClick={() => setShowTrade(true)} style={{
            padding: '6px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 11,
            fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            border: `1px solid ${D.green}`, color: D.green, background: `${D.green}10`, transition: 'all 0.2s'
          }}>+ Trade</button>
          <button onClick={() => setShowSqOff(true)} style={{
            padding: '6px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 11,
            fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            border: `1px solid ${D.red}`, color: D.red, background: `${D.red}10`, transition: 'all 0.2s'
          }}>Square Off All</button>
        </div>
      </div>

      {/* Holdings */}
      {subTab === 'holdings' && (
        <div style={panel}>
          {!holdings.length
            ? <div style={{ padding: 40, textAlign: 'center', color: D.textDim, fontFamily: 'monospace', fontSize: 13 }}>No open positions</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Coin','Type','Qty','Avg Entry','Current','Unreal P&L','P&L %'].map((h,i) => (
                      <th key={h} style={{ ...th, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {holdings.map(h => {
                      const pnl = parseFloat(h.unrealized_pnl ?? 0);
                      const pct = parseFloat(h.unrealized_pct ?? 0);
                      const cur = parseFloat(h.current_price ?? getPrice(h.coin_id));
                      return (
                        <tr key={h.id} style={{ borderBottom: `1px solid ${D.border}` }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: D.textBright, fontSize: 14 }}>{h.coin_symbol}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                              color: h.position_type === 'long' ? D.green : D.red,
                              background: h.position_type === 'long' ? `${D.green}15` : `${D.red}15`,
                              border: `1px solid ${h.position_type === 'long' ? D.green : D.red}40`
                            }}>{h.position_type.toUpperCase()}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.text, fontSize: 13 }}>{fmtQty(h.quantity)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textDim, fontSize: 13 }}>${parseFloat(h.avg_buy_price).toFixed(cur > 10 ? 2 : 5)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textBright, fontSize: 13, fontWeight: 600 }}>${cur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: cur > 10 ? 2 : 5 })}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: pnl >= 0 ? D.green : D.red }}>{fmtPnl(pnl)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: 12, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
                              color: pct >= 0 ? D.green : D.red,
                              background: pct >= 0 ? `${D.green}15` : `${D.red}15`,
                              border: `1px solid ${pct >= 0 ? D.green : D.red}40`
                            }}>{fmtPct(pct)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Trade History */}
      {subTab === 'history' && (
        <div style={panel}>
          {!trades.length
            ? <div style={{ padding: 40, textAlign: 'center', color: D.textDim, fontFamily: 'monospace', fontSize: 13 }}>No trades yet</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Time','Coin','Type','Qty','Price','Total'].map((h,i) => (
                      <th key={h} style={{ ...th, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {trades.map(t => (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${D.border}` }}>
                        <td style={{ padding: '12px 16px', color: D.textDim, fontSize: 12, fontFamily: 'monospace' }}>{fmtTime(t.created_at)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: D.textBright, fontSize: 14 }}>{t.coin_symbol}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                            color: TRADE_COLORS_MAP[t.trade_type] || D.text,
                            background: `${TRADE_COLORS_MAP[t.trade_type] || D.text}15`,
                            border: `1px solid ${TRADE_COLORS_MAP[t.trade_type] || D.text}40`
                          }}>{t.trade_type?.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.text, fontSize: 13 }}>{fmtQty(t.quantity)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textDim, fontSize: 13 }}>{fmtUsd(t.price)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textBright, fontSize: 13, fontWeight: 600 }}>{fmtUsd(t.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Closed Positions */}
      {subTab === 'closed' && (
        <div style={panel}>
          {!closed.length
            ? <div style={{ padding: 40, textAlign: 'center', color: D.textDim, fontFamily: 'monospace', fontSize: 13 }}>No closed positions</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Closed At','Coin','Type','Qty','Entry','Exit','Realized P&L'].map((h,i) => (
                      <th key={h} style={{ ...th, textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {closed.map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${D.border}` }}>
                        <td style={{ padding: '12px 16px', color: D.textDim, fontSize: 12, fontFamily: 'monospace' }}>{fmtTime(p.closed_at)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: D.textBright, fontSize: 14 }}>{p.coin_symbol}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                            color: p.position_type === 'long' ? D.green : D.red,
                            background: p.position_type === 'long' ? `${D.green}15` : `${D.red}15`,
                            border: `1px solid ${p.position_type === 'long' ? D.green : D.red}40`
                          }}>{p.position_type?.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.text, fontSize: 13 }}>{fmtQty(p.quantity)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.textDim, fontSize: 13 }}>{fmtUsd(p.entry_price)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: D.text, fontSize: 13 }}>{fmtUsd(p.exit_price)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: parseFloat(p.realized_pnl) >= 0 ? D.green : D.red }}>{fmtPnl(p.realized_pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Portfolio Performance Graph */}
      {subTab === 'performance' && (
        <div style={panel}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 11, letterSpacing: 3, color: D.cyan, fontWeight: 700, textTransform: 'uppercase' }}>
            Portfolio Value — Last 24H
          </div>
          <div style={{ padding: 16 }}>
            {perfLoading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontFamily: 'monospace', fontSize: 13 }}>
                Building performance chart…
              </div>
            ) : perfData.length < 2 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontFamily: 'monospace', fontSize: 13 }}>
                Not enough data yet — check back after a few price updates
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Start Value', val: `$${perfData[0]?.value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                    { label: 'Current Value', val: `$${perfData[perfData.length-1]?.value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                    { label: '24H Change', val: (() => {
                        const change = perfData[perfData.length-1]?.value - perfData[0]?.value;
                        return `${change >= 0 ? '+' : '-'}$${Math.abs(change).toFixed(2)}`;
                      })(),
                      color: (perfData[perfData.length-1]?.value - perfData[0]?.value) >= 0 ? D.green : D.red
                    },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 11, color: D.textDim, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: s.color || D.textBright }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={perfData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={D.border} />
                    <XAxis dataKey="t" tick={{ fill: D.textDim, fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: D.border }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: D.textDim, fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={70}
                      tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" stroke={D.cyan} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: D.cyan }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {showTrade && (
        <TradeModal portfolioId={portfolioId} coins={coins} getPrice={getPrice} D={D}
          onClose={() => setShowTrade(false)} onSuccess={onRefresh} />
      )}

      {/* Square-Off Modal */}
      {showSqOff && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSqOff(false)}>
          <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 12, padding: 24, width: '90%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, color: D.red, textTransform: 'uppercase', marginBottom: 12 }}>Confirm Square Off All</h3>
            <p style={{ fontFamily: 'monospace', color: D.text, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              This will close all {holdings.length} open position{holdings.length !== 1 ? 's' : ''} at current market prices. Cannot be undone.
            </p>
            {sqError && <p style={{ color: D.red, fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}>{sqError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowSqOff(false)} style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${D.border}`, background: 'none', color: D.textDim, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSquareOff} disabled={sqLoading} style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${D.red}`, background: `${D.red}15`, color: D.red, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: sqLoading ? 0.5 : 1 }}>
                {sqLoading ? 'Closing…' : 'Square Off All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
