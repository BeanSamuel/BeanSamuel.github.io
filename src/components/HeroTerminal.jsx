import { useState, useEffect } from 'react';
import { personalInfo } from '../data/resumeData';
import useReducedMotion from '../hooks/useReducedMotion';

const LINES = [
  { kind: 'cmd', text: 'whoami' },
  {
    kind: 'out',
    text: `${personalInfo.name} (${personalInfo.chineseName}) — CS undergrad at National Central University.`,
  },
  { kind: 'cmd', text: 'cat about.txt' },
  {
    kind: 'out',
    text:
      'Research intern at Academia Sinica, working on how large pre-trained models line up ' +
      'meaning across modalities. I build backends when the experiments need somewhere to run.',
  },
];

const STEP_MS = 450;

const HeroTerminal = () => {
  const reducedMotion = useReducedMotion();
  // Reduced motion gets the finished state on frame one, not a faster reveal.
  const [shown, setShown] = useState(() => (reducedMotion ? LINES.length : 0));

  useEffect(() => {
    if (reducedMotion) {
      setShown(LINES.length);
      return;
    }
    if (shown >= LINES.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [shown, reducedMotion]);

  const done = shown >= LINES.length;

  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="window-controls">
          <div className="control close"></div>
          <div className="control minimize"></div>
          <div className="control maximize"></div>
        </div>
        <div className="window-title">~/about</div>
      </div>
      {/* Height is reserved for the full text so the page below does not jump
          as lines land — the reveal is the only thing that should move. */}
      <div
        className="terminal-body"
        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', minHeight: '260px' }}
      >
        {LINES.slice(0, shown).map((line, idx) =>
          line.kind === 'cmd' ? (
            <div key={idx} style={{ marginTop: idx === 0 ? 0 : '1.25rem' }}>
              <span style={{ color: 'var(--accent-primary)', userSelect: 'none' }}>$</span> {line.text}
            </div>
          ) : (
            <p key={idx} style={{ color: 'var(--text-main)', margin: '0.35rem 0 0 0' }}>
              {line.text}
            </p>
          )
        )}
        {done && (
          <div style={{ marginTop: '1.25rem' }}>
            <span style={{ color: 'var(--accent-primary)', userSelect: 'none' }}>$</span>{' '}
            <span className="cursor-blink" aria-hidden="true"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeroTerminal;
