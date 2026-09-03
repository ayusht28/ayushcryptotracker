export default function WsIndicator({ connected, D }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: connected ? D.green : D.red,
      }} />
      <span style={{ fontSize: 12, color: connected ? D.green : D.red, fontWeight: 500 }}>
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
