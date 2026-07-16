import { useRef, useEffect, useState, useCallback } from 'react';
import SectionViewer from '../components/SectionViewer';

const COLS = 25;
const ROWS = 20;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const BASE_SPEED = 150;
const MIN_SPEED = 60;

function randomPos(snake) {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

const dpadBtnStyle = {
  width: '52px',
  height: '52px',
  background: 'var(--accent-soft)',
  border: '1px solid var(--border-strong)',
  color: 'var(--accent-primary)',
  fontSize: '1.1rem',
  cursor: 'pointer',
  borderRadius: '4px',
  fontFamily: 'var(--font-mono)',
  transition: 'border-color var(--ease), background-color var(--ease)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const SnakeGame = () => {
  const canvasRef = useRef(null);
  const gsRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('snake_hi') || 0));
  const [status, setStatus] = useState('idle'); // 'idle' | 'playing' | 'gameover'

  const drawCanvas = useCallback((isGameOver = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(69, 243, 255, 0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(W, j * CELL); ctx.stroke();
    }

    const gs = gsRef.current;

    if (!gs) {
      // Idle screen
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = '#45f3ff';
      ctx.font = 'bold 42px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SNAKE.EXE', W / 2, H / 2 - 30);
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff2a6d';
      ctx.fillStyle = '#ff2a6d';
      ctx.font = '18px "JetBrains Mono", monospace';
      ctx.fillText('[ PRESS START ]', W / 2, H / 2 + 20);
      ctx.shadowBlur = 0;
      return;
    }

    const { snake, food } = gs;

    // Food
    if (food) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ff2a6d';
      ctx.fillStyle = '#ff2a6d';
      ctx.fillRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6);
      ctx.shadowBlur = 0;
    }

    // Snake body
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.shadowBlur = isHead ? 20 : 8;
      ctx.shadowColor = isHead ? '#45f3ff' : '#05d9e8';
      const alpha = Math.max(0.25, 1 - i * 0.018);
      ctx.fillStyle = isHead ? '#45f3ff' : `rgba(5, 217, 232, ${alpha})`;
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.shadowBlur = 0;

    // Game over overlay
    if (isGameOver) {
      ctx.fillStyle = 'rgba(11, 12, 16, 0.82)';
      ctx.fillRect(0, 0, W, H);

      ctx.shadowBlur = 28;
      ctx.shadowColor = '#ff2a6d';
      ctx.fillStyle = '#ff2a6d';
      ctx.font = 'bold 42px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20);

      ctx.shadowBlur = 15;
      ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = '#45f3ff';
      ctx.font = '20px "JetBrains Mono", monospace';
      ctx.fillText(`SCORE: ${gs.score}`, W / 2, H / 2 + 28);
      ctx.shadowBlur = 0;
    }
  }, []);

  const gameTick = useCallback((timestamp) => {
    const gs = gsRef.current;
    if (!gs || !gs.running) return;

    if (timestamp - lastTickRef.current >= gs.speed) {
      lastTickRef.current = timestamp;

      gs.dir = gs.nextDir;
      const head = { x: gs.snake[0].x + gs.dir.x, y: gs.snake[0].y + gs.dir.y };

      const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
      // Skip last segment since it moves away this tick
      const hitSelf = gs.snake.slice(0, -1).some(s => s.x === head.x && s.y === head.y);

      if (hitWall || hitSelf) {
        gs.running = false;
        drawCanvas(true);
        setStatus('gameover');
        return;
      }

      gs.snake.unshift(head);

      if (head.x === gs.food.x && head.y === gs.food.y) {
        gs.score += 10;
        gs.food = randomPos(gs.snake);
        gs.speed = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(gs.score / 50) * 10);
        const s = gs.score;
        setScore(s);
        setHighScore(prev => {
          if (s > prev) {
            localStorage.setItem('snake_hi', String(s));
            return s;
          }
          return prev;
        });
      } else {
        gs.snake.pop();
      }
    }

    drawCanvas(false);
    rafRef.current = requestAnimationFrame(gameTick);
  }, [drawCanvas]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
    gsRef.current = {
      snake,
      food: randomPos(snake),
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      score: 0,
      speed: BASE_SPEED,
      running: true,
    };
    setScore(0);
    setStatus('playing');
    lastTickRef.current = 0;
    rafRef.current = requestAnimationFrame(gameTick);
  }, [gameTick]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      const gs = gsRef.current;
      if (!gs || !gs.running) return;
      const map = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
      };
      const nd = map[e.key];
      if (!nd) return;
      if (nd[0] === -gs.dir.x && nd[1] === -gs.dir.y) return;
      e.preventDefault();
      gs.nextDir = { x: nd[0], y: nd[1] };
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Touch swipe on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let sx, sy;
    const onTouchStart = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onTouchEnd = (e) => {
      const gs = gsRef.current;
      if (!gs || !gs.running) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      let nd;
      if (Math.abs(dx) > Math.abs(dy)) {
        nd = dx > 0 ? [1, 0] : [-1, 0];
      } else {
        nd = dy > 0 ? [0, 1] : [0, -1];
      }
      if (nd[0] === -gs.dir.x && nd[1] === -gs.dir.y) return;
      gs.nextDir = { x: nd[0], y: nd[1] };
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Mount: draw idle screen; unmount: cancel RAF
  useEffect(() => {
    drawCanvas(false);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [drawCanvas]);

  const moveDir = (dx, dy) => {
    const gs = gsRef.current;
    if (!gs || !gs.running) return;
    if (dx === -gs.dir.x && dy === -gs.dir.y) return;
    gs.nextDir = { x: dx, y: dy };
  };

  const speedLevel = Math.floor((BASE_SPEED - (gsRef.current?.speed ?? BASE_SPEED)) / 10) + 1;

  const statusColor = status === 'playing'
    ? 'var(--accent-primary)'
    : status === 'gameover'
    ? 'var(--accent-secondary)'
    : 'var(--text-dim)';

  return (
    <div>
      <SectionViewer title="Snake Game">
        {/* HUD */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9rem',
        }}>
          <span>
            <span style={{ color: 'var(--text-dim)' }}>SCORE </span>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{score}</span>
          </span>
          <span>
            <span style={{ color: 'var(--text-dim)' }}>HI-SCORE </span>
            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{highScore}</span>
          </span>
          <span>
            <span style={{ color: 'var(--text-dim)' }}>STATUS </span>
            <span style={{ color: statusColor }}>{status.toUpperCase()}</span>
          </span>
          {status === 'playing' && (
            <span>
              <span style={{ color: 'var(--text-dim)' }}>SPEED </span>
              <span style={{ color: 'var(--accent-tertiary)' }}>LV.{speedLevel}</span>
            </span>
          )}
        </div>

        {/* Canvas */}
        <div style={{ textAlign: 'center' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              maxWidth: '100%',
              display: 'block',
              margin: '0 auto',
              touchAction: 'none',
            }}
          />
        </div>

        {/* Start / Restart button */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          {status !== 'playing' && (
            <button onClick={startGame} className="cyber-btn" style={{ fontSize: '0.95rem', padding: '0.75rem 2rem' }}>
              {status === 'idle' ? '[ START GAME ]' : '[ PLAY AGAIN ]'}
            </button>
          )}
        </div>

        {/* D-pad (mobile) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.5rem', gap: '4px' }}>
          <button onPointerDown={() => moveDir(0, -1)} style={dpadBtnStyle}>▲</button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onPointerDown={() => moveDir(-1, 0)} style={dpadBtnStyle}>◄</button>
            <div style={{ width: '52px', height: '52px' }} />
            <button onPointerDown={() => moveDir(1, 0)} style={dpadBtnStyle}>►</button>
          </div>
          <button onPointerDown={() => moveDir(0, 1)} style={dpadBtnStyle}>▼</button>
        </div>

        {/* Controls hint */}
        <p style={{
          textAlign: 'center',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          marginTop: '1rem',
        }}>
          [ WASD / Arrow Keys ] &nbsp;·&nbsp; Swipe on mobile
        </p>
      </SectionViewer>
    </div>
  );
};

export default SnakeGame;
