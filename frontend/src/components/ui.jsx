export function formatPrice(n) {
  if (n === null || n === undefined) return '—';
  if (n > 1) {
    return '$' + (+n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + (+n).toFixed(5);
}

export function formatLarge(n) {
  if (!n) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toFixed(2);
}

export function formatPnl(n) {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '-';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(n) {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + (+n).toFixed(2) + '%';
}

export function formatQty(n) {
  if (!n) return '—';
  return (+n).toFixed(Math.abs(+n) < 1 ? 6 : 4).replace(/\.?0+$/, '');
}

export function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Panel({ children, style, D }) {
  return (
    <div style={{
      background: D.panel,
      border: `1px solid ${D.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, D }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}` }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: D.textBright }}>
        {children}
      </span>
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = 'text', style, D }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: D.panel2,
        border: `1px solid ${D.border}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: D.textBright,
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        ...style,
      }}
    />
  );
}

export function Select({ value, onChange, options, D }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: D.panel2,
        border: `1px solid ${D.border}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: D.textBright,
        fontFamily: 'Inter, sans-serif',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map(function(opt) {
        const value = opt.value ?? opt;
        const label = opt.label ?? opt;
        return <option key={value} value={value}>{label}</option>;
      })}
    </select>
  );
}

export function Button({ children, onClick, disabled, variant = 'default', D }) {
  const colors = {
    default: { bg: D.panel2, border: D.border,  color: D.textBright },
    primary: { bg: D.blue,   border: D.blue,     color: '#ffffff'    },
    danger:  { bg: D.red,    border: D.red,       color: '#ffffff'    },
    success: { bg: D.green,  border: D.green,     color: '#ffffff'    },
  };

  const c = colors[variant] || colors.default;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '9px 16px',
        fontSize: 13,
        fontWeight: 500,
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'Inter, sans-serif',
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 8px',
      borderRadius: 4,
      color: color,
      background: color + '15',
      border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

export function Label({ children, D }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: D.textDim, marginBottom: 6 }}>
      {children}
    </label>
  );
}

export const COIN_COLORS = {
  BTC: '#f7931a', ETH: '#627eea', BNB: '#f0b90b', SOL: '#9945ff',
  ADA: '#0033ad', XRP: '#00aae4', DOGE: '#c2a633', DOT: '#e6007a',
  LTC: '#bfbbbb', LINK: '#375bd2', AVAX: '#e84142', MATIC: '#8247e5',
};

export function CoinAvatar({ symbol, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: COIN_COLORS[symbol] || '#888888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.28, fontWeight: 700, color: '#ffffff',
    }}>
      {symbol.slice(0, 3)}
    </div>
  );
}
