// frontend/src/components/PriceChart.jsx
// Recharts line chart for historical coin prices.
// Receives an array of { coin_id, price_usd, created_at } rows from the API.

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(n) {
  if (!n && n !== 0) return '—';
  return n > 1 ? `$${(+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
               : `$${(+n).toFixed(5)}`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { price_usd, created_at } = payload[0].payload;
  return (
    <div className="bg-[#0f0f24] border border-[#2e2e5a] rounded px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-[#00d4ff] mb-1">{formatTime(created_at)}</p>
      <p className="text-white font-semibold">{formatPrice(price_usd)}</p>
    </div>
  );
};

export default function PriceChart({ history = [], coinSymbol }) {
  if (!history.length) {
    return (
      <div className="flex items-center justify-center h-48 text-[#50507a] font-mono text-sm">
        No price history yet — data accumulates every 60 seconds
      </div>
    );
  }

  const prices   = history.map(r => parseFloat(r.price_usd));
  const minPrice = Math.min(...prices) * 0.998;
  const maxPrice = Math.max(...prices) * 1.002;
  const isUp     = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#00ff88' : '#ff3355';

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={history} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#18183a" />
          <XAxis
            dataKey="created_at"
            tickFormatter={formatTime}
            tick={{ fill: '#50507a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={{ stroke: '#18183a' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fill: '#50507a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => (v > 1 ? `$${(v/1000).toFixed(0)}k` : `$${v.toFixed(4)}`)}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="price_usd"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-between mt-2 text-xs font-mono text-[#50507a] px-1">
        <span>LOW <span className="text-[#b8b8d8]">{formatPrice(Math.min(...prices))}</span></span>
        <span className="text-[#50507a]">{coinSymbol} / USD · {history.length} data points</span>
        <span>HIGH <span className="text-[#b8b8d8]">{formatPrice(Math.max(...prices))}</span></span>
      </div>
    </div>
  );
}
