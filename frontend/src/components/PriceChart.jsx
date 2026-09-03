import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatPrice } from './ui';

function CustomTooltip({ active, payload, D }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: D.textDim, marginBottom: 2 }}>{row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: D.textBright }}>{formatPrice(row.price_usd)}</div>
    </div>
  );
}

export default function PriceChart({ history, coinSymbol, D }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.textDim, fontSize: 12 }}>
        No price history yet — data accumulates every 60 seconds
      </div>
    );
  }

  const prices   = history.map(row => parseFloat(row.price_usd));
  const minPrice = Math.min(...prices) * 0.998;
  const maxPrice = Math.max(...prices) * 1.002;
  const isUp     = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? D.green : D.red;

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={D.border} />
          <XAxis
            dataKey="created_at"
            tickFormatter={val => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            tick={{ fill: D.textDim, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: D.border }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fill: D.textDim, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => formatPrice(v).replace('$', '')}
            width={56}
          />
          <Tooltip content={props => <CustomTooltip {...props} D={D} />} />
          <Line type="monotone" dataKey="price_usd" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: lineColor }} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: D.textDim, marginTop: 6 }}>
        <span>Low {formatPrice(Math.min(...prices))}</span>
        <span>{coinSymbol} / USD</span>
        <span>High {formatPrice(Math.max(...prices))}</span>
      </div>
    </div>
  );
}
