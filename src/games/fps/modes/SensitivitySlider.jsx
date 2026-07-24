import { useSensitivity, SENS_MIN, SENS_MAX, SENS_STEP, SENS_DEFAULT } from '../engine/settings';

// Mouse-look sensitivity control, shared by the FPS shell (always visible) and
// the pause menu (adjust mid-round). Backed by the persisted settings store, so
// every instance stays in sync and the value survives reloads.
export function SensitivitySlider({ compact = false }) {
  const [sens, setSens] = useSensitivity();

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        fontFamily: 'var(--font-mono)', fontSize: compact ? '0.72rem' : '0.8rem',
        color: 'var(--text-dim)',
      }}
    >
      <span style={{ letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>靈敏度 SENS</span>
      <input
        type="range"
        min={SENS_MIN}
        max={SENS_MAX}
        step={SENS_STEP}
        value={sens}
        onChange={(e) => setSens(parseFloat(e.target.value))}
        aria-label="Mouse sensitivity"
        style={{ width: compact ? '90px' : '130px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
      />
      <span style={{ minWidth: '2.9rem', color: 'var(--accent-primary)', textAlign: 'right' }}>
        {sens.toFixed(2)}×
      </span>
      {!compact && (
        <button
          type="button"
          onClick={() => setSens(SENS_DEFAULT)}
          disabled={sens === SENS_DEFAULT}
          title="Reset to default"
          style={{
            background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px',
            color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
            padding: '0.15rem 0.5rem', cursor: sens === SENS_DEFAULT ? 'default' : 'pointer',
            opacity: sens === SENS_DEFAULT ? 0.4 : 1,
          }}
        >
          RESET
        </button>
      )}
    </div>
  );
}
