// Pause menu shown over the canvas when pointer lock is lost mid-game (Esc).
// Absolutely positioned to cover the canvas; buttons are real DOM so the freed
// cursor can click them. Resume re-locks the pointer (button click = the user
// gesture the browser requires); Quit ends the round.

export function PauseOverlay({ onResume, onQuit, quitLabel = 'QUIT' }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1.2rem',
        background: 'rgba(6,8,12,0.72)', backdropFilter: 'blur(2px)',
        borderRadius: '4px', fontFamily: 'var(--font-mono)', zIndex: 5,
      }}
    >
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.15em', textShadow: '0 0 20px rgba(87,201,214,0.5)' }}>
        PAUSED
      </div>
      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={onResume} className="cyber-btn" style={{ padding: '0.6rem 1.8rem', fontSize: '0.95rem' }}>
          [ RESUME ]
        </button>
        <button onClick={onQuit} className="cyber-btn" style={{ padding: '0.6rem 1.8rem', fontSize: '0.95rem', color: 'var(--accent-secondary)' }}>
          [ {quitLabel} ]
        </button>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Esc pauses · Resume re-locks the mouse</div>
    </div>
  );
}

// Wrap a canvas so the overlay can position over it. Keeps the canvas centred.
export function CanvasStage({ children }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      {children}
    </div>
  );
}
