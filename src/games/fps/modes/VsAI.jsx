import { useState, useCallback } from 'react';
import Duel from './Duel';
import { makeAiDriver } from '../sim/drivers';

const VsAI = () => {
  const [difficulty, setDifficulty] = useState(null);

  const makeDriver = useCallback((sampleLocal) =>
    makeAiDriver({ difficulty, seed: (Math.random() * 1e9) | 0, sampleLocal }),
  [difficulty]);

  if (!difficulty) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '1.4rem' }}>
          1v1 · First to 5 · AR / Handgun / Fists / Grenade / RPG
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setDifficulty('easy')}
            style={{ ...cardStyle, borderColor: '#2e7d46', color: '#8ef0a8' }}
          >
            <strong style={{ fontSize: '1.1rem' }}>EASY</strong>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>practice · slower · misses more</span>
          </button>
          <button
            onClick={() => setDifficulty('hard')}
            style={{ ...cardStyle, borderColor: '#a33a54', color: '#f0a0b4' }}
          >
            <strong style={{ fontSize: '1.1rem' }}>HARD</strong>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>aggressive · accurate · peeks</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Duel
      makeDriver={makeDriver}
      statusText={difficulty.toUpperCase()}
      hint={`vs AI (${difficulty}) · Esc releases the mouse`}
      canRematch
      onExit={() => setDifficulty(null)}
    />
  );
};

const cardStyle = {
  display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center',
  padding: '1.2rem 2.4rem', background: 'var(--accent-soft)', border: '1px solid',
  borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', minWidth: '200px',
};

export default VsAI;
