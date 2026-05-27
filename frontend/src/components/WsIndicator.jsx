// frontend/src/components/WsIndicator.jsx
// A small live/disconnected status dot shown in the app header.

export default function WsIndicator({ connected }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2 h-2 rounded-full transition-colors duration-300 ${
          connected ? 'bg-green-400 animate-pulse shadow-[0_0_6px_#4ade80]' : 'bg-red-500'
        }`}
      />
      <span className={`text-xs font-mono tracking-widest ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  );
}
