import React, { useRef, useEffect, useState, useCallback } from 'react';
import SectionViewer from '../components/SectionViewer';

// 0=empty, 1=cyan wall, 2=red wall, 3=yellow wall
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,2,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,2,0,0,0,0,0,3,0,0,0,1],
  [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,2,2,2,0,1],
  [1,0,3,0,0,0,0,0,0,0,0,0,0,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,3,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const MAP_H = MAP.length;
const MAP_W = MAP[0].length;
const SW = 640;
const SH = 360;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 18;
const TOTAL_ENEMIES = 5;

// light color, dark color (N/S sides)
const WALL_COLORS = {
  1: ['#45f3ff', '#1a5f6a'],
  2: ['#ff2a6d', '#7a1535'],
  3: ['#ffbb00', '#7a5800'],
};

const INIT_ENEMIES = [
  { id: 0, x: 3.5, y: 3.5 },
  { id: 1, x: 8.5, y: 5.5 },
  { id: 2, x: 5.5, y: 10.5 },
  { id: 3, x: 12.5, y: 8.5 },
  { id: 4, x: 10.5, y: 12.5 },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

const FPSGame = () => {
  const canvasRef = useRef(null);
  const gs = useRef(null); // all mutable game state
  const rafRef = useRef(null);
  const keysRef = useRef({});

  const [hud, setHud] = useState({ phase: 'idle', score: 0, health: 100, ammo: 30, kills: 0 });

  const syncHud = useCallback(() => {
    const g = gs.current;
    if (!g) return;
    setHud({ phase: g.phase, score: g.score, health: g.health, ammo: g.ammo, kills: g.kills });
  }, []);

  // --- Raycasting ---
  const castRay = useCallback((px, py, angle) => {
    const rdx = Math.cos(angle);
    const rdy = Math.sin(angle);

    let mx = Math.floor(px);
    let my = Math.floor(py);

    const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
    const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);

    let stepX, stepY, sdx, sdy;

    if (rdx < 0) { stepX = -1; sdx = (px - mx) * ddx; }
    else          { stepX =  1; sdx = (mx + 1 - px) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (py - my) * ddy; }
    else          { stepY =  1; sdy = (my + 1 - py) * ddy; }

    let side = 0, wallType = 1;
    for (let i = 0; i < MAX_DEPTH * 2; i++) {
      if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; }
      else            { sdy += ddy; my += stepY; side = 1; }
      if (mx >= 0 && mx < MAP_W && my >= 0 && my < MAP_H && MAP[my][mx] > 0) {
        wallType = MAP[my][mx];
        break;
      }
    }

    const dist = side === 0 ? sdx - ddx : sdy - ddy;
    return { dist: Math.max(0.1, dist), side, wallType };
  }, []);

  // --- Render ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g = gs.current;

    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, SW, SH);

    if (!g || g.phase === 'idle') {
      ctx.textAlign = 'center';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = '#45f3ff';
      ctx.font = 'bold 52px "Fira Code", monospace';
      ctx.fillText('CYBER.FPS', SW / 2, SH / 2 - 40);
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff2a6d';
      ctx.fillStyle = '#ff2a6d';
      ctx.font = '20px "Fira Code", monospace';
      ctx.fillText('[ CLICK START TO PLAY ]', SW / 2, SH / 2 + 20);
      ctx.shadowBlur = 0;
      return;
    }

    const { player, enemies } = g;

    // Ceiling
    const cg = ctx.createLinearGradient(0, 0, 0, SH / 2);
    cg.addColorStop(0, '#050810'); cg.addColorStop(1, '#0a1020');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, SW, SH / 2);

    // Floor
    const fg = ctx.createLinearGradient(0, SH / 2, 0, SH);
    fg.addColorStop(0, '#0a1020'); fg.addColorStop(1, '#050408');
    ctx.fillStyle = fg; ctx.fillRect(0, SH / 2, SW, SH / 2);

    const zBuf = new Float32Array(SW);

    // Walls
    for (let x = 0; x < SW; x++) {
      const angle = player.angle - HALF_FOV + (x / SW) * FOV;
      const { dist, side, wallType } = castRay(player.x, player.y, angle);
      zBuf[x] = dist;

      const wh = Math.min(SH * 2, SH / dist);
      const wt = (SH - wh) / 2;
      const fog = Math.max(0, 1 - dist / MAX_DEPTH);
      const [lc, dc] = WALL_COLORS[wallType] || WALL_COLORS[1];
      const [r, gv, b] = hexToRgb(side === 0 ? lc : dc);
      ctx.fillStyle = `rgba(${r},${gv},${b},${Math.max(0.05, fog)})`;
      ctx.fillRect(x, wt, 1, wh);
    }

    // Enemies (billboard sprites)
    const sorted = [...enemies].filter(e => e.alive).sort((a, b) => {
      const da = (a.x - player.x) ** 2 + (a.y - player.y) ** 2;
      const db = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
      return db - da;
    });

    sorted.forEach(en => {
      const dx = en.x - player.x;
      const dy = en.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > MAX_DEPTH || dist < 0.4) return;

      let ang = Math.atan2(dy, dx) - player.angle;
      while (ang >  Math.PI) ang -= 2 * Math.PI;
      while (ang < -Math.PI) ang += 2 * Math.PI;
      if (Math.abs(ang) > HALF_FOV + 0.15) return;

      const sx = ((ang + HALF_FOV) / FOV) * SW;
      const size = Math.min(SH * 1.5, SH / dist);
      const top = (SH - size) / 2;
      const fog = Math.max(0.1, 1 - dist / 12);

      const col = Math.floor(sx);
      if (col < 0 || col >= SW || zBuf[col] < dist) return;

      const half = size * 0.38;
      ctx.shadowBlur = 20 * fog;
      ctx.shadowColor = '#ff2a6d';
      ctx.fillStyle = `rgba(255,42,109,${fog})`;
      ctx.beginPath();
      ctx.moveTo(sx, top + size * 0.5 - half);
      ctx.lineTo(sx + half * 0.55, top + size * 0.5);
      ctx.lineTo(sx, top + size * 0.5 + half);
      ctx.lineTo(sx - half * 0.55, top + size * 0.5);
      ctx.closePath();
      ctx.fill();
      // eye
      ctx.fillStyle = `rgba(255,255,255,${fog})`;
      ctx.shadowBlur = 8; ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.arc(sx, top + size * 0.5 - half * 0.28, half * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.shadowBlur = 0;

    // Crosshair
    const cx2 = SW / 2, cy2 = SH / 2;
    const chColor = g.shootCooldown > 0 ? '#ff2a6d' : '#45f3ff';
    ctx.strokeStyle = chColor; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8; ctx.shadowColor = chColor;
    ctx.beginPath();
    ctx.moveTo(cx2 - 14, cy2); ctx.lineTo(cx2 - 5, cy2);
    ctx.moveTo(cx2 + 5, cy2); ctx.lineTo(cx2 + 14, cy2);
    ctx.moveTo(cx2, cy2 - 14); ctx.lineTo(cx2, cy2 - 5);
    ctx.moveTo(cx2, cy2 + 5); ctx.lineTo(cx2, cy2 + 14);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Muzzle flash
    if (g.flashTimer > 0) {
      const alpha = g.flashTimer / 6;
      ctx.fillStyle = `rgba(255,200,60,${alpha * 0.7})`;
      ctx.shadowBlur = 60; ctx.shadowColor = '#ffcc33';
      ctx.beginPath();
      ctx.arc(SW / 2, SH - 50, 18 + g.flashTimer * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Damage vignette
    if (g.dmgTimer > 0) {
      const alpha = g.dmgTimer / 12;
      const rg = ctx.createRadialGradient(SW/2, SH/2, SH*0.2, SW/2, SH/2, SH*0.8);
      rg.addColorStop(0, 'rgba(255,0,0,0)');
      rg.addColorStop(1, `rgba(255,0,0,${alpha})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, SW, SH);
    }

    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(10, SH - 50, 180, 28);
    const hpFrac = Math.max(0, g.health / 100);
    ctx.fillStyle = hpFrac > 0.5 ? '#27c93f' : hpFrac > 0.25 ? '#ffbd2e' : '#ff5f56';
    ctx.fillRect(12, SH - 48, hpFrac * 176, 24);
    ctx.strokeStyle = 'rgba(69,243,255,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(10, SH - 50, 180, 28);
    ctx.fillStyle = '#fff'; ctx.font = '11px "Fira Code",monospace'; ctx.textAlign = 'center';
    ctx.fillText(`HP ${g.health}`, 100, SH - 31);

    // Ammo
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(SW - 90, SH - 50, 80, 28);
    ctx.fillStyle = '#45f3ff';
    ctx.font = '13px "Fira Code",monospace'; ctx.textAlign = 'center';
    ctx.fillText(`AMMO ${g.ammo}`, SW - 50, SH - 31);

    // Minimap
    const MM = 8;
    const mmX = SW - MAP_W * MM - 10;
    const mmY = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(mmX - 2, mmY - 2, MAP_W * MM + 4, MAP_H * MM + 4);
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const t = MAP[row][col];
        if (t > 0) {
          ctx.fillStyle = (WALL_COLORS[t] || WALL_COLORS[1])[0];
          ctx.globalAlpha = 0.65;
          ctx.fillRect(mmX + col * MM, mmY + row * MM, MM - 1, MM - 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Enemies on minimap
    enemies.forEach(en => {
      if (!en.alive) return;
      ctx.fillStyle = '#ff2a6d'; ctx.shadowBlur = 4; ctx.shadowColor = '#ff2a6d';
      ctx.beginPath();
      ctx.arc(mmX + en.x * MM, mmY + en.y * MM, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Player on minimap
    const pmx = mmX + player.x * MM;
    const pmy = mmY + player.y * MM;
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 6; ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(pmx, pmy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#45f3ff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pmx, pmy);
    ctx.lineTo(pmx + Math.cos(player.angle) * 9, pmy + Math.sin(player.angle) * 9);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Overlays
    if (g.phase === 'gameover' || g.phase === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, SW, SH);
      ctx.textAlign = 'center';
      if (g.phase === 'gameover') {
        ctx.fillStyle = '#ff2a6d'; ctx.shadowBlur = 30; ctx.shadowColor = '#ff2a6d';
        ctx.font = 'bold 54px "Fira Code",monospace';
        ctx.fillText('YOU DIED', SW / 2, SH / 2 - 20);
      } else {
        ctx.fillStyle = '#45f3ff'; ctx.shadowBlur = 30; ctx.shadowColor = '#45f3ff';
        ctx.font = 'bold 42px "Fira Code",monospace';
        ctx.fillText('MISSION CLEAR', SW / 2, SH / 2 - 20);
      }
      ctx.shadowBlur = 12; ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = '#45f3ff'; ctx.font = '22px "Fira Code",monospace';
      ctx.fillText(`SCORE: ${g.score}`, SW / 2, SH / 2 + 30);
      ctx.shadowBlur = 0;
    }
  }, [castRay]);

  // --- Shoot ---
  const shoot = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing' || g.ammo <= 0 || g.shootCooldown > 0) return;
    g.ammo--;
    g.shootCooldown = 10;
    g.flashTimer = 6;

    const { player, enemies } = g;
    let best = null, bestDist = Infinity;

    enemies.forEach(en => {
      if (!en.alive) return;
      const dx = en.x - player.x;
      const dy = en.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 14) return;
      let ang = Math.atan2(dy, dx) - player.angle;
      while (ang >  Math.PI) ang -= 2 * Math.PI;
      while (ang < -Math.PI) ang += 2 * Math.PI;
      const hitCone = Math.atan2(0.45, dist);
      if (Math.abs(ang) < hitCone && dist < bestDist) { bestDist = dist; best = en; }
    });

    if (best) {
      best.alive = false;
      g.kills++;
      g.score += Math.ceil(120 / bestDist);
      if (g.kills >= TOTAL_ENEMIES) {
        g.phase = 'won';
        cancelAnimationFrame(rafRef.current);
        render(); // draw the won overlay immediately
      }
    }
    syncHud();
  }, [syncHud, render]);

  // --- Game loop ---
  const gameLoop = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') return;

    const keys = keysRef.current;
    const { player } = g;

    if (keys['ArrowLeft'])  player.angle -= 0.035;
    if (keys['ArrowRight']) player.angle += 0.035;

    const cosA = Math.cos(player.angle);
    const sinA = Math.sin(player.angle);
    const speed = 0.055;

    const tryMove = (dx, dy) => {
      const nx = player.x + dx;
      const ny = player.y + dy;
      if (MAP[Math.floor(player.y)][Math.floor(nx)] === 0) player.x = nx;
      if (MAP[Math.floor(ny)][Math.floor(player.x)] === 0) player.y = ny;
    };

    if (keys['w'] || keys['W']) tryMove(cosA * speed, sinA * speed);
    if (keys['s'] || keys['S']) tryMove(-cosA * speed, -sinA * speed);
    if (keys['a'] || keys['A']) tryMove(sinA * speed, -cosA * speed);  // strafe left
    if (keys['d'] || keys['D']) tryMove(-sinA * speed, cosA * speed); // strafe right

    if (g.shootCooldown > 0) g.shootCooldown--;
    if (g.flashTimer > 0) g.flashTimer--;
    if (g.dmgTimer > 0) g.dmgTimer--;

    render();
    syncHud();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [render, syncHud]);

  // --- Start ---
  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    keysRef.current = {};
    gs.current = {
      phase: 'playing',
      player: { x: 1.5, y: 1.5, angle: 0 },
      enemies: INIT_ENEMIES.map(e => ({ ...e, alive: true })),
      score: 0, health: 100, ammo: 30, kills: 0,
      shootCooldown: 0, flashTimer: 0, dmgTimer: 0,
    };
    syncHud();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, syncHud]);

  // --- Keyboard ---
  useEffect(() => {
    const onDown = (e) => {
      keysRef.current[e.key] = true;
      if (e.key === ' ') { e.preventDefault(); shoot(); }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    };
    const onUp = (e) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [shoot]);

  // --- Mount ---
  useEffect(() => {
    render();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [render]);

  const { phase, score, health, ammo, kills } = hud;
  const phaseColor = phase === 'playing' ? 'var(--accent-primary)' : phase === 'gameover' ? 'var(--accent-secondary)' : 'var(--text-dim)';

  return (
    <div>
      <SectionViewer title="Cyber FPS">
        {/* HUD row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
          <span><span style={{ color: 'var(--text-dim)' }}>HP </span><span style={{ color: health > 50 ? '#27c93f' : health > 25 ? '#ffbd2e' : '#ff5f56' }}>{health}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>AMMO </span><span style={{ color: 'var(--accent-primary)' }}>{ammo}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>KILLS </span><span style={{ color: 'var(--accent-secondary)' }}>{kills}/{TOTAL_ENEMIES}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>SCORE </span><span style={{ color: '#ffbb00' }}>{score}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>STATUS </span><span style={{ color: phaseColor }}>{phase.toUpperCase()}</span></span>
        </div>

        {/* Canvas */}
        <div style={{ textAlign: 'center' }}>
          <canvas
            ref={canvasRef}
            width={SW}
            height={SH}
            onClick={phase !== 'playing' ? startGame : shoot}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              maxWidth: '100%',
              display: 'block',
              margin: '0 auto',
              boxShadow: '0 0 30px rgba(69,243,255,0.1)',
              cursor: 'crosshair',
            }}
          />
        </div>

        {/* Start / Restart */}
        {phase !== 'playing' && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button onClick={startGame} className="cyber-btn" style={{ fontSize: '0.95rem', padding: '0.75rem 2rem' }}>
              {phase === 'idle' ? '[ START GAME ]' : '[ PLAY AGAIN ]'}
            </button>
          </div>
        )}

        {/* Controls legend */}
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginTop: '1.2rem' }}>
          [ W/S ] Forward/Back &nbsp;·&nbsp; [ A/D ] Strafe &nbsp;·&nbsp; [ ←/→ ] Turn &nbsp;·&nbsp; [ SPACE / Click ] Shoot
        </p>
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
          Objective: eliminate all <span style={{ color: '#ff2a6d' }}>{TOTAL_ENEMIES}</span> enemies · Use minimap (top-right) to locate targets
        </p>
      </SectionViewer>
    </div>
  );
};

export default FPSGame;
