import { useState, useCallback, useEffect } from 'react';
import { Panel, CoinAvatar, Badge, formatPnl, formatPct, formatQty, formatPrice, formatTime } from './ui';
import TradeModal from './TradeModal';
import { squareOffAll, fetchHistory, getErrorMessage } from '../api/gateway';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const SUBTABS = ['Holdings', 'History', 'Closed', 'Performance'];

export default function PortfolioTab({ portfolioId, portfolio, prices, coins, onRefresh, D }) {
  const [subTab,      setSubTab]      = useState('Holdings');
  const [showTrade,   setShowTrade]   = useState(false);
  const [showSquare,  setShowSquare]  = useState(false);
  const [squareLoad,  setSquareLoad]  = useState(false);
  const [squareErr,   setSquareErr]   = useState('');
  const [perfData,    setPerfData]    = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);

  const getPrice = useCallback(function(coinId) {
    const coin = prices.find(p => p.id === coinId);
    return coin ? parseFloat(coin.price_usd) : 0;
  }, [prices]);

  useEffect(function loadPerformanceData() {
    if (subTab !== 'Performance') return;
    const holdings = portfolio?.holdings ?? [];
    if (!holdings.length) return;

    setPerfLoading(true);

    const requests = holdings.map(h => fetchHistory(h.coin_id, 48).then(d => ({ coinId: h.coin_id, history: d.history ?? [], holding: h })));

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

  function PerfTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px' }}>
        <div style={{ fontSize: 11, color: D.textDim }}>{payload[0].payload.t}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>${payload[0].value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
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
        <Panel D={D}>
          {holdings.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: D.textDim, fontSize: 13 }}>No open positions</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Coin</Th><Th>Type</Th><Th right>Qty</Th><Th right>Avg Entry</Th><Th right>Current</Th><Th right>P&L</Th><Th right>P&L %</Th></tr></thead>
                <tbody>
                  {holdings.map(function(h) {
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
      )}

      {/* Trade History */}
      {subTab === 'History' && (
        <Panel D={D}>
          {trades.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: D.textDim, fontSize: 13 }}>No trades yet</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><Th>Time</Th><Th>Coin</Th><Th>Type</Th><Th right>Qty</Th><Th right>Price</Th><Th right>Total</Th></tr></thead>
                <tbody>
                  {trades.map(function(t) {
                    const typeColors = { buy: D.green, sell: D.red, short: D.gold, cover: D.blue };
                    return (
                      <tr key={t.id}>
                        <Td style={{ color: D.textDim, fontSize: 12 }}>{formatTime(t.created_at)}</Td>
                        <Td style={{ fontWeight: 600, color: D.textBright }}>{t.coin_symbol}</Td>
                        <Td><Badge label={t.trade_type} color={typeColors[t.trade_type] || D.text} /></Td>
                        <Td right>{formatQty(t.quantity)}</Td>
                        <Td right style={{ color: D.textDim }}>{formatPrice(t.price)}</Td>
                        <Td right style={{ color: D.textBright, fontWeight: 600 }}>${parseFloat(t.total_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </Panel>
      )}

      {/* Closed Positions */}
      {subTab === 'Closed' && (
        <Panel D={D}>
          {closed.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: D.textDim, fontSize: 13 }}>No closed positions</div>
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
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 13, fontWeight: 600, color: D.textBright }}>Portfolio Value — Last 24H</div>
          <div style={{ padding: 16 }}>
            {perfLoading
              ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontSize: 13 }}>Building chart…</div>
              : perfData.length < 2
              ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontSize: 13 }}>Not enough data yet</div>
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
                      <YAxis tick={{ fill: D.textDim, fontSize: 10 }} tickLine={false} axisLine={false} width={64} tickFormatter={v => '$' + (v/1000).toFixed(1) + 'k'} />
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

      {/* Square Off confirmation */}
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
