import { useState } from 'react';
import SectionViewer from '../../components/SectionViewer';
import Survival from './modes/Survival';
import AimTrainer from './modes/AimTrainer';
import VsAI from './modes/VsAI';
import Online from './modes/Online';
import { SensitivitySlider } from './modes/SensitivitySlider';

// Mode picker for Cyber FPS. Switching modes unmounts the previous one, which
// tears down its render loop, controls and (for online) its P2P connection.
const MODES = [
  { key: 'survival', label: '打怪 SURVIVAL', color: 'var(--accent-secondary)', Component: Survival },
  { key: 'aim', label: '打靶 AIM', color: 'var(--accent-primary)', Component: AimTrainer },
  { key: 'vs-ai', label: '人機 VS AI', color: '#ffbb00', Component: VsAI },
  { key: 'online', label: '聯機 ONLINE', color: '#27c93f', Component: Online },
];

const FPSShell = () => {
  const [mode, setMode] = useState('survival');
  const active = MODES.find((m) => m.key === mode) || MODES[0];
  const Active = active.Component;

  return (
    <SectionViewer title="Cyber FPS">
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {MODES.map((m) => {
          const on = m.key === mode;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                padding: '0.45rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
                cursor: 'pointer', borderRadius: '4px',
                color: on ? m.color : 'var(--text-dim)',
                background: on ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border-color)'}`,
                transition: 'color var(--ease), background-color var(--ease), border-color var(--ease)',
              }}
            >
              {m.label}
            </button>
          );
        })}
        </div>
        <SensitivitySlider />
      </div>

      {/* key forces a fresh mount per mode so loops/connections reset cleanly */}
      <Active key={active.key} />
    </SectionViewer>
  );
};

export default FPSShell;
