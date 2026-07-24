// Shared on-screen controls for touch devices. The desktop path uses pointer
// lock + keyboard; phones drive the same `keys` map through these buttons.

export const padStyle = {
  height: '46px',
  background: 'var(--accent-soft)',
  border: '1px solid var(--border-strong)',
  color: 'var(--accent-primary)',
  fontSize: '0.9rem',
  cursor: 'pointer',
  borderRadius: '4px',
  fontFamily: 'var(--font-mono)',
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'none',
  userSelect: 'none',
};

export function TouchPad({ controls, onFire, onReload, gs }) {
  const hold = (code) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      if (gs?.current) gs.current.touch = true;
      controls.setKey(code, true);
    },
    onPointerUp: () => controls.setKey(code, false),
    onPointerLeave: () => controls.setKey(code, false),
    onPointerCancel: () => controls.setKey(code, false),
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 46px)', gridTemplateRows: 'repeat(2, 46px)', gap: '4px' }}>
        <button {...hold('KeyA')} style={padStyle}>◄</button>
        <button {...hold('KeyW')} style={padStyle}>▲</button>
        <button {...hold('KeyD')} style={padStyle}>►</button>
        <button {...hold('ArrowLeft')} style={padStyle}>↺</button>
        <button {...hold('KeyS')} style={padStyle}>▼</button>
        <button {...hold('ArrowRight')} style={padStyle}>↻</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
        <button onPointerDown={(e) => { e.preventDefault(); onFire(); }} style={{ ...padStyle, width: '92px', color: 'var(--accent-secondary)' }}>FIRE</button>
        <button onPointerDown={(e) => { e.preventDefault(); onReload(); }} style={{ ...padStyle, width: '92px' }}>RELOAD</button>
      </div>
    </div>
  );
}
