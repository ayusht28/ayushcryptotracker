import { useState, useEffect } from 'react';

export default function FearGreedIndex({ D }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(function loadFearGreed() {
    async function load() {
      try {
        const res  = await fetch('https://api.alternative.me/fng/');
        const json = await res.json();
        setData(json.data[0]);
      } catch (err) {
        console.error('Fear & Greed load failed:', err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3600000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) return null;

  const value = parseInt(data.value);
  const label = data.value_classification;

  function getColor(v) {
    if (v >= 75) return D.green;
    if (v >= 55) return '#86efac';
    if (v >= 45) return D.gold;
    if (v >= 25) return '#fb923c';
    return D.red;
  }

  const color        = getColor(value);
  const radius       = 40;
  const circumference = Math.PI * radius;
  const progress     = (value / 100) * circumference;

  return (
    <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 90, height: 50, flexShrink: 0 }}>
        <svg width="90" height="50" viewBox="0 0 90 50">
          <path d="M 5 45 A 40 40 0 0 1 85 45" fill="none" stroke={D.border} strokeWidth="8" strokeLinecap="round" />
          <path d="M 5 45 A 40 40 0 0 1 85 45" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`} />
        </svg>
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: D.textDim, marginBottom: 3 }}>Fear & Greed Index</div>
        <div style={{ fontSize: 15, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 11, color: D.textDim, marginTop: 2 }}>
          Updated {new Date(parseInt(data.timestamp) * 1000).toLocaleDateString()}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[
          { label: 'Extreme Fear',  range: '0–24',  c: D.red   },
          { label: 'Fear',          range: '25–44', c: '#fb923c' },
          { label: 'Neutral',       range: '45–54', c: D.gold  },
          { label: 'Greed',         range: '55–74', c: '#86efac' },
          { label: 'Extreme Greed', range: '75–100', c: D.green },
        ].map(function(row) {
          return (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.c, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: D.textDim }}>{row.label}</span>
              <span style={{ fontSize: 10, color: D.textDim, marginLeft: 'auto', paddingLeft: 8 }}>{row.range}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
