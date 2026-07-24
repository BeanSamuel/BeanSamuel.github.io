import { useRef, useEffect, useState, useCallback } from 'react';
import { aimMap } from '../engine/maps';
import { normAngle, SW, SH } from '../engine/geometry';
import { useControls } from '../engine/input';
import {
  makeCamera, clearScreen, renderWorld, projectPoint, drawClipped, drawOrb,
  drawCrosshair, drawMuzzle, drawTitle, drawEndOverlay,
} from '../engine/render';

const map = aimMap;
const CENTER = { x: 6.5, y: 4.5 };
const ROUND_TIME = 60;
const TARGET_RADIUS = 0.34;

// Each drill differs only in how targets spawn/move and how many live at once.
const DRILLS = {
  flick:    { label: 'FLICK',    live: 1, ttl: Infinity, moving: false, spread: 4.2 },
  tracking: { label: 'TRACKING', live: 1, ttl: Infinity, moving: true,  spread: 3.2 },
  grid:     { label: 'GRID',     live: 5, ttl: 2.6,       moving: false, spread: 4.6 },
};

const BEST_KEY = 'cyberfps.aim.best';

const AimTrainer = () => {
  const canvasRef = useRef(null);
  const gs = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const [drill, setDrill] = useState('flick');
  const [hud, setHud] = useState({ phase: 'idle', time: ROUND_TIME, hits: 0, shots: 0, combo: 0 });
  const [result, setResult] = useState(null);
  const [best, setBest] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch { return {}; }
  });

  const syncHud = useCallback(() => {
    const g = gs.current;
    if (!g) return;
    setHud((prev) => {
      const next = { phase: g.phase, time: Math.max(0, Math.ceil(g.time)), hits: g.hits, shots: g.shots, combo: g.combo };
      for (const k in next) if (prev[k] !== next[k]) return next;
      return prev;
    });
  }, []);

  const spawnTarget = useCallback((g) => {
    const d = DRILLS[g.drill];
    // Place targets in front-ish of the arena within the drill's spread box,
    // biased away from walls. Deterministic randomness isn't needed here (solo).
    const angle = (Math.random() - 0.5) * 2.4;   // spread around forward
    const dist = 2.4 + Math.random() * d.spread;
    let x = CENTER.x + Math.cos(angle - Math.PI / 2 + g.baseAngle) * dist;
    let y = CENTER.y + Math.sin(angle - Math.PI / 2 + g.baseAngle) * dist;
    x = Math.max(1.4, Math.min(map.w - 1.4, x));
    y = Math.max(1.4, Math.min(map.h - 1.4, y));
    return {
      id: g.nextId++, x, y, born: g.elapsed, ttl: d.ttl,
      vx: d.moving ? (Math.random() - 0.5) * 1.8 : 0,
      vy: d.moving ? (Math.random() - 0.5) * 1.8 : 0,
    };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g = gs.current;

    if (!g || g.phase === 'idle') {
      drawTitle(ctx, 'AIM', `[ ${DRILLS[drill].label} · CLICK START ]`);
      return;
    }

    clearScreen(ctx);
    const cam = makeCamera(g.player);
    const zBuf = renderWorld(ctx, map, cam);

    g.targets
      .map((t) => ({ t, p: projectPoint(cam, t.x, t.y) }))
      .filter((s) => s.p)
      .sort((a, b) => b.p.depth - a.p.depth)
      .forEach(({ p }) => {
        const size = Math.abs(SH / p.depth);
        drawClipped(ctx, zBuf, p.sx, size * 0.22, p.depth, () => drawOrb(ctx, p.sx, size, p.depth));
      });

    drawCrosshair(ctx, g.hitMarker > 0 ? '#fff' : '#45f3ff', g.hitMarker);
    drawMuzzle(ctx, g.flashTimer);

    // Big centred timer + accuracy readout.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(69,243,255,0.9)';
    ctx.font = 'bold 30px "JetBrains Mono",monospace';
    ctx.fillText(`${Math.max(0, Math.ceil(g.time))}`, SW / 2, 44);
    ctx.font = '12px "JetBrains Mono",monospace';
    ctx.fillStyle = 'rgba(197,198,199,0.8)';
    const acc = g.shots ? Math.round((g.hits / g.shots) * 100) : 0;
    ctx.fillText(`${g.hits} hit · ${acc}% · x${g.combo}`, SW / 2, 62);

    if (g.phase === 'done') {
      const acc2 = g.shots ? Math.round((g.hits / g.shots) * 100) : 0;
      drawEndOverlay(ctx, {
        title: 'TIME', titleColor: '#45f3ff',
        lines: [`${g.hits} HITS · ${acc2}%`, `KPM ${Math.round(g.hits / (ROUND_TIME / 60))} · avg react ${g.avgReact}ms · best combo x${g.bestCombo}`],
      });
    }
  }, [drill]);

  const controls = useControls({ canvasRef, isActive: () => gs.current?.phase === 'playing' });

  const shoot = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing' || g.shootCooldown > 0) return;
    g.shootCooldown = 0.08; g.flashTimer = 0.1; g.shots++;

    const { player } = g;
    let best = null, bestAng = Infinity;
    g.targets.forEach((t) => {
      const dx = t.x - player.x, dy = t.y - player.y;
      const dist = Math.hypot(dx, dy);
      const ang = Math.abs(normAngle(Math.atan2(dy, dx) - player.angle));
      if (ang > Math.atan2(TARGET_RADIUS, dist)) return;
      if (ang < bestAng) { bestAng = ang; best = t; }
    });

    if (best) {
      g.hits++; g.combo++; g.hitMarker = 0.12;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      g.reactSum += (g.elapsed - best.born) * 1000; g.reactN++;
      g.targets = g.targets.filter((t) => t !== best);
    } else {
      g.combo = 0;
    }
    while (g.targets.length < DRILLS[g.drill].live) g.targets.push(spawnTarget(g));
    syncHud();
  }, [syncHud, spawnTarget]);

  const step = useCallback((dt) => {
    const g = gs.current;
    g.elapsed += dt; g.time -= dt;
    if (g.shootCooldown > 0) g.shootCooldown -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;
    if (g.hitMarker > 0) g.hitMarker -= dt;

    const inp = controls.sampleInput(0, 2.7, dt);
    g.player.angle += inp.turn;

    // Move + expire targets.
    g.targets.forEach((t) => {
      if (t.vx || t.vy) {
        const nx = t.x + t.vx * dt, ny = t.y + t.vy * dt;
        if (nx < 1.4 || nx > map.w - 1.4) t.vx *= -1; else t.x = nx;
        if (ny < 1.4 || ny > map.h - 1.4) t.vy *= -1; else t.y = ny;
      }
    });
    g.targets = g.targets.filter((t) => g.elapsed - t.born < t.ttl);
    while (g.targets.length < DRILLS[g.drill].live) g.targets.push(spawnTarget(g));

    if (g.time <= 0) {
      g.phase = 'done';
      g.avgReact = g.reactN ? Math.round(g.reactSum / g.reactN) : 0;
      const acc = g.shots ? Math.round((g.hits / g.shots) * 100) : 0;
      const rec = { hits: g.hits, acc, combo: g.bestCombo };
      setBest((prevBest) => {
        const cur = prevBest[g.drill];
        if (!cur || rec.hits > cur.hits) {
          const merged = { ...prevBest, [g.drill]: rec };
          try { localStorage.setItem(BEST_KEY, JSON.stringify(merged)); } catch { /* private mode */ }
          return merged;
        }
        return prevBest;
      });
      setResult(rec);
    }
  }, [controls, spawnTarget]);

  const loop = useCallback((now) => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') return;
    const dt = Math.min(0.05, (now - lastRef.current) / 1000) || 0;
    lastRef.current = now;
    step(dt); render(); syncHud();
    if (g.phase === 'playing') rafRef.current = requestAnimationFrame(loop);
    else {
      g.flashTimer = 0; g.hitMarker = 0;
      render(); syncHud();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [step, render, syncHud]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setResult(null);
    gs.current = {
      phase: 'playing', drill,
      player: { x: CENTER.x, y: CENTER.y, angle: -Math.PI / 2 },
      baseAngle: -Math.PI / 2,
      targets: [], nextId: 0,
      time: ROUND_TIME, elapsed: 0,
      hits: 0, shots: 0, combo: 0, bestCombo: 0,
      reactSum: 0, reactN: 0, avgReact: 0,
      shootCooldown: 0, flashTimer: 0, hitMarker: 0,
    };
    while (gs.current.targets.length < DRILLS[drill].live) gs.current.targets.push(spawnTarget(gs.current));
    syncHud();
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [drill, loop, syncHud, spawnTarget]);

  useEffect(() => {
    render();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [render]);

  const onCanvasPointerDown = (e) => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') { startGame(); return; }
    if (e.pointerType === 'touch') { shoot(); return; }
    const canvas = canvasRef.current;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { canvas.requestPointerLock(); return; }
    shoot();
  };

  const playing = hud.phase === 'playing';
  const acc = hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(DRILLS).map(([key, d]) => (
          <button
            key={key}
            onClick={() => !playing && setDrill(key)}
            disabled={playing}
            style={{
              padding: '0.4rem 0.9rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
              cursor: playing ? 'default' : 'pointer', borderRadius: '4px',
              color: drill === key ? 'var(--accent-primary)' : 'var(--text-dim)',
              background: drill === key ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${drill === key ? 'var(--border-strong)' : 'var(--border-color)'}`,
              opacity: playing && drill !== key ? 0.4 : 1,
            }}
          >
            {d.label}{best[key] ? ` · best ${best[key].hits}` : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
        <span><span style={{ color: 'var(--text-dim)' }}>TIME </span><span style={{ color: 'var(--accent-primary)' }}>{hud.time}s</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>HITS </span><span style={{ color: '#27c93f' }}>{hud.hits}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>ACC </span><span style={{ color: 'var(--accent-primary)' }}>{acc}%</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>COMBO </span><span style={{ color: '#ffbb00' }}>x{hud.combo}</span></span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <canvas
          ref={canvasRef} width={SW} height={SH}
          onPointerDown={onCanvasPointerDown}
          onContextMenu={(e) => e.preventDefault()}
          style={{ border: '1px solid var(--border-color)', borderRadius: '4px', maxWidth: '100%', display: 'block', margin: '0 auto', cursor: 'crosshair', touchAction: 'none' }}
        />
      </div>

      {!playing && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button onClick={startGame} className="cyber-btn" style={{ fontSize: '0.95rem', padding: '0.75rem 2rem' }}>
            {result ? '[ RETRY ]' : '[ START ]'}
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginTop: '1.2rem' }}>
        [ Mouse / ←→ ] Aim &nbsp;·&nbsp; [ Click / SPACE ] Shoot &nbsp;·&nbsp; 60s · targets pop, keep your crosshair on them
      </p>
    </div>
  );
};

export default AimTrainer;
