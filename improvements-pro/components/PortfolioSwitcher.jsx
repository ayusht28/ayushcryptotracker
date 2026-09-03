import { useState, useRef, useEffect } from 'react';
import { createPortfolio, renamePortfolio, deletePortfolio, getErrorMessage } from '../api/gateway';

export default function PortfolioSwitcher({ portfolios, activeId, onSwitch, onRefreshList, D }) {
  const [open,        setOpen]        = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState('');
  const [error,       setError]       = useState('');
  const dropdownRef = useRef(null);

  const activePortfolio = portfolios.find(p => p.id === activeId);

  useEffect(function closeOnOutsideClick() {
    function handleClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return setError('Enter a name');
    try {
      const result = await createPortfolio(newName.trim(), 'USD');
      setNewName('');
      setCreating(false);
      setError('');
      await onRefreshList();
      onSwitch(result.portfolio.id);
      setOpen(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDelete(portfolioId, event) {
    event.stopPropagation();
    try {
      await deletePortfolio(portfolioId);
      await onRefreshList();
      if (portfolioId === activeId && portfolios.length > 1) {
        const remaining = portfolios.find(p => p.id !== portfolioId);
        if (remaining) onSwitch(remaining.id);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: D.textBright, background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
      >
        {activePortfolio?.name ?? 'Portfolio'}
        <span style={{ fontSize: 10, color: D.textDim }}>▼</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 220, background: D.panel, border: `1px solid ${D.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 50, overflow: 'hidden' }}>
          {portfolios.map(function(p) {
            const isActive = p.id === activeId;
            return (
              <div
                key={p.id}
                onClick={() => { onSwitch(p.id); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', cursor: 'pointer', background: isActive ? D.hover : 'transparent', borderBottom: `1px solid ${D.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = D.hover}
                onMouseLeave={e => e.currentTarget.style.background = isActive ? D.hover : 'transparent'}
              >
                <span style={{ fontSize: 13, color: D.textBright, fontWeight: isActive ? 600 : 400 }}>
                  {isActive && '✓ '}{p.name}
                </span>
                {portfolios.length > 1 && (
                  <button
                    onClick={e => handleDelete(p.id, e)}
                    style={{ fontSize: 11, color: D.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {creating ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Portfolio name"
                autoFocus
                style={{ width: '100%', background: D.panel2, border: `1px solid ${D.border}`, borderRadius: 5, padding: '7px 10px', fontSize: 13, color: D.textBright, outline: 'none' }}
              />
              {error && <div style={{ fontSize: 11, color: D.red }}>{error}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setCreating(false); setError(''); }} style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 5, border: `1px solid ${D.border}`, background: 'none', color: D.text, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 5, border: 'none', background: D.blue, color: '#fff', cursor: 'pointer' }}>Create</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setCreating(true)}
              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: D.blue, fontWeight: 500 }}
              onMouseEnter={e => e.currentTarget.style.background = D.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              + New Portfolio
            </div>
          )}
        </div>
      )}
    </div>
  );
}
