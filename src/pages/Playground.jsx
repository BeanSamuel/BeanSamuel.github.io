import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { FaDragon, FaCrosshairs } from 'react-icons/fa';
import SnakeGame from './SnakeGame';
import FPSGame from './FPSGame';

const GAMES = [
  {
    key: 'snake',
    label: 'Snake.exe',
    icon: <FaDragon />,
    color: 'var(--accent-primary)',
    Component: SnakeGame,
  },
  {
    key: 'fps',
    label: 'Cyber FPS',
    icon: <FaCrosshairs />,
    color: 'var(--accent-secondary)',
    Component: FPSGame,
  },
];

const DEFAULT_GAME = GAMES[0].key;

const Playground = () => {
  const { game } = useParams();
  const navigate = useNavigate();

  const active = GAMES.find((g) => g.key === game);
  // Covers both /playground and any bogus slug someone types.
  if (!active) return <Navigate to={`/playground/${DEFAULT_GAME}`} replace />;

  const { Component } = active;

  return (
    <div>
      {/* Switching route unmounts the other game, which stops its render loop. */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {GAMES.map((g) => {
          const isActive = g.key === active.key;
          return (
            <button
              key={g.key}
              onClick={() => navigate(`/playground/${g.key}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 1rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                borderRadius: '4px',
                color: isActive ? g.color : 'var(--text-dim)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border-color)'}`,
                transition: 'color var(--ease), background-color var(--ease), border-color var(--ease)',
              }}
            >
              {g.icon} {g.label}
            </button>
          );
        })}
      </div>

      <Component />
    </div>
  );
};

export default Playground;
