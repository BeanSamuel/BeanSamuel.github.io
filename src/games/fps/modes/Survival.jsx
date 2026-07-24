import { useRef, useEffect, useState, useCallback } from 'react';
import { survivalMap } from '../engine/maps';
import { normAngle, SW, SH } from '../engine/geometry';
import { useControls } from '../engine/input';
import {
  makeCamera, clearScreen, renderWorld, projectPoint, drawClipped, drawFighter,
  drawCrosshair, drawMuzzle, drawVignette, drawMinimap, drawHpBar, drawAmmo,
  drawBanner, drawTitle, drawEndOverlay,
} from '../engine/render';
import { TouchPad } from './touch';
import { PauseOverlay, CanvasStage } from './PauseOverlay';

const map = survivalMap;

const CFG = {
  moveSpeed: 3.1, strafeSpeed: 2.5, turnSpeed: 2.7,
  playerRadius: 0.22, enemyRadius: 0.28,
  magSize: 12, reserveStart: 36, reloadTime: 1.1, fireCooldown: 0.16,
  maxHealth: 100, aggroRange: 10, attackRange: 8, enemyStopRange: 2.2,
};

const WAVES = [
  { count: 4, speed: 1.05, damage: 6,  fireCooldown: 2.0, hp: 1 },
  { count: 6, speed: 1.35, damage: 9,  fireCooldown: 1.35, hp: 2 },
  { count: 8, speed: 1.65, damage: 11, fireCooldown: 1.05, hp: 2 },
];

const Survival = () => {
  const canvasRef = useRef(null);
  const gs = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);

  const [hud, setHud] = useState({
    phase: 'idle', score: 0, health: CFG.maxHealth,
    ammo: CFG.magSize, reserve: CFG.reserveStart,
    kills: 0, wave: 0, waveTotal: 0, reloading: false,
  });
  const [paused, setPaused] = useState(false);

  const syncHud = useCallback(() => {
    const g = gs.current;
    if (!g) return;
    const next = {
      phase: g.phase, score: g.score, health: Math.max(0, Math.round(g.health)),
      ammo: g.ammo, reserve: g.reserve, kills: g.kills,
      wave: g.wave, waveTotal: g.waveTotal, reloading: g.reloadTimer > 0,
    };
    setHud((prev) => {
      for (const k in next) if (prev[k] !== next[k]) return next;
      return prev;
    });
  }, []);

  const spawnWave = useCallback((g, waveIdx) => {
    const cfg = WAVES[waveIdx];
    const spots = map.openCells
      .filter((c) => Math.hypot(c.x - g.player.x, c.y - g.player.y) > 6)
      .sort(() => Math.random() - 0.5)
      .slice(0, cfg.count);
    g.enemies = spots.map((c, i) => ({
      id: `${waveIdx}-${i}`, x: c.x, y: c.y,
      hp: cfg.hp, maxHp: cfg.hp, speed: cfg.speed, damage: cfg.damage,
      fireCooldown: cfg.fireCooldown, cd: 0.6 + Math.random() * cfg.fireCooldown,
      hitFlash: 0,
    }));
    g.wave = waveIdx + 1;
    g.waveTotal = cfg.count;
    g.banner = { text: `WAVE ${waveIdx + 1}`, timer: 1.6 };
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g = gs.current;

    if (!g || g.phase === 'idle') {
      drawTitle(ctx, 'SURVIVAL', '[ CLICK START TO PLAY ]');
      return;
    }

    clearScreen(ctx);
    const cam = makeCamera(g.player);
    const zBuf = renderWorld(ctx, map, cam);

    g.enemies
      .map((en) => ({ en, p: projectPoint(cam, en.x, en.y) }))
      .filter((s) => s.p)
      .sort((a, b) => b.p.depth - a.p.depth)
      .forEach(({ en, p }) => {
        const size = Math.abs(SH / p.depth);
        drawClipped(ctx, zBuf, p.sx, size * 0.38, p.depth, () =>
          drawFighter(ctx, p.sx, size, p.depth, {
            hurt: en.hitFlash > 0, hp: en.hp, maxHp: en.maxHp,
          }));
      });
    ctx.shadowBlur = 0;

    const busy = g.shootCooldown > 0 || g.reloadTimer > 0 || g.ammo <= 0;
    drawCrosshair(ctx, g.hitMarker > 0 ? '#fff' : busy ? '#ff2a6d' : '#45f3ff', g.hitMarker);
    drawMuzzle(ctx, g.flashTimer);
    drawVignette(ctx, g.dmgTimer);
    drawHpBar(ctx, g.health, CFG.maxHealth);
    drawAmmo(ctx, g.ammo, g.reserve, g.reloadTimer > 0, 'AMMO');
    drawMinimap(ctx, map, g.player, g.enemies.map((e) => ({ x: e.x, y: e.y, color: '#ff2a6d' })));
    drawBanner(ctx, g.banner);

    if (g.phase === 'playing' && !controls.isLocked() && !g.touch) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(197,198,199,0.75)';
      ctx.font = '12px "JetBrains Mono",monospace';
      ctx.fillText('click to lock mouse look · esc to release', SW / 2, SH - 62);
    }

    if (g.phase === 'gameover' || g.phase === 'won') {
      drawEndOverlay(ctx, {
        title: g.phase === 'gameover' ? 'YOU DIED' : 'MISSION CLEAR',
        titleColor: g.phase === 'gameover' ? '#ff2a6d' : '#45f3ff',
        lines: [`SCORE: ${g.score}`, `wave ${g.wave}/${WAVES.length} · ${g.totalKills} eliminated`],
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') return;
    if (g.reloadTimer > 0 || g.ammo >= CFG.magSize || g.reserve <= 0) return;
    g.reloadTimer = CFG.reloadTime;
  }, []);

  const shoot = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing' || g.reloadTimer > 0 || g.shootCooldown > 0) return;
    if (g.ammo <= 0) { reload(); return; }
    g.ammo--; g.shootCooldown = CFG.fireCooldown; g.flashTimer = 0.1;

    const { player, enemies } = g;
    let best = null, bestDist = Infinity;
    enemies.forEach((en) => {
      const dx = en.x - player.x, dy = en.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 16) return;
      const ang = normAngle(Math.atan2(dy, dx) - player.angle);
      if (Math.abs(ang) > Math.atan2(CFG.enemyRadius, dist)) return;
      if (!map.hasLOS(player.x, player.y, en.x, en.y)) return;
      if (dist < bestDist) { bestDist = dist; best = en; }
    });
    if (best) {
      best.hp--; best.hitFlash = 0.12; g.hitMarker = 0.12;
      if (best.hp <= 0) {
        g.enemies = g.enemies.filter((e) => e !== best);
        g.kills++; g.totalKills++;
        g.score += Math.max(10, Math.ceil(120 / Math.max(1, bestDist)));
      }
    }
    syncHud();
  }, [syncHud, reload]);

  // Esc releases pointer lock (browser-enforced); useControls reports that as a
  // pause so we freeze the sim and show the menu.
  const pause = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing' || g.paused) return;
    g.paused = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    render();
    setPaused(true);
  }, [render]);

  const controls = useControls({
    canvasRef,
    isActive: () => gs.current?.phase === 'playing' && !gs.current?.paused,
    onFire: shoot,
    onReload: reload,
    onPause: pause,
  });

  const step = useCallback((dt) => {
    const g = gs.current;
    const { player } = g;

    if (g.shootCooldown > 0) g.shootCooldown -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;
    if (g.dmgTimer > 0) g.dmgTimer -= dt;
    if (g.hitMarker > 0) g.hitMarker -= dt;
    if (g.banner && g.banner.timer > 0) g.banner.timer -= dt;

    if (g.reloadTimer > 0) {
      g.reloadTimer -= dt;
      if (g.reloadTimer <= 0) {
        const take = Math.min(CFG.magSize - g.ammo, g.reserve);
        g.ammo += take; g.reserve -= take; g.reloadTimer = 0;
      }
    }

    const inp = controls.sampleInput(0, CFG.turnSpeed, dt);
    player.angle += inp.turn;
    const cosA = Math.cos(player.angle), sinA = Math.sin(player.angle);
    if (inp.fwd || inp.strafe) {
      const len = Math.hypot(inp.fwd, inp.strafe);
      const fwd = inp.fwd / len, strafe = inp.strafe / len;
      const dx = (cosA * fwd * CFG.moveSpeed - sinA * strafe * CFG.strafeSpeed) * dt;
      const dy = (sinA * fwd * CFG.moveSpeed + cosA * strafe * CFG.strafeSpeed) * dt;
      map.moveWithSlide(player, dx, dy, CFG.playerRadius);
    }

    const pCell = Math.floor(player.y) * map.w + Math.floor(player.x);
    if (pCell !== g.flowCell) { g.flow = map.computeFlow(player.x, player.y); g.flowCell = pCell; }

    g.enemies.forEach((en) => {
      if (en.hitFlash > 0) en.hitFlash -= dt;
      if (en.cd > 0) en.cd -= dt;
      const dx = player.x - en.x, dy = player.y - en.y;
      const dist = Math.hypot(dx, dy);
      const los = dist < CFG.aggroRange && map.hasLOS(en.x, en.y, player.x, player.y);
      let tx = null, ty = null;
      if (dist > CFG.enemyStopRange) {
        if (los) { tx = player.x; ty = player.y; }
        else {
          const s = map.flowStep(g.flow, en.x, en.y);
          if (s) { tx = s.x; ty = s.y; }
        }
      }
      if (tx !== null) {
        const len = Math.hypot(tx - en.x, ty - en.y) || 1;
        map.moveWithSlide(en, ((tx - en.x) / len) * en.speed * dt, ((ty - en.y) / len) * en.speed * dt, CFG.enemyRadius);
      }
      if (los && dist < CFG.attackRange && en.cd <= 0) {
        en.cd = en.fireCooldown;
        const hitChance = 0.75 - Math.min(0.45, (dist / CFG.attackRange) * 0.45);
        if (Math.random() < hitChance) {
          g.health -= en.damage; g.dmgTimer = 0.4;
          if (g.health <= 0) { g.health = 0; g.phase = 'gameover'; }
        }
      }
    });

    if (g.phase === 'playing' && g.enemies.length === 0) {
      if (g.wave >= WAVES.length) {
        g.phase = 'won'; g.score += Math.round(g.health * 2);
      } else {
        g.health = Math.min(CFG.maxHealth, g.health + 25);
        g.reserve = CFG.reserveStart; g.ammo = CFG.magSize; g.score += 150;
        spawnWave(g, g.wave);
      }
    }
  }, [spawnWave, controls]);

  const loop = useCallback((now) => {
    const g = gs.current;
    if (!g || g.phase !== 'playing' || g.paused) return;
    const dt = Math.min(0.05, (now - lastRef.current) / 1000) || 0;
    lastRef.current = now;
    step(dt); render(); syncHud();
    if (g.phase === 'playing') rafRef.current = requestAnimationFrame(loop);
    else {
      g.flashTimer = 0; g.dmgTimer = 0; g.hitMarker = 0; g.banner = null;
      render(); syncHud();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [step, render, syncHud]);

  const resume = useCallback(() => {
    const g = gs.current;
    if (!g || !g.paused) return;
    g.paused = false;
    setPaused(false);
    controls.lock();                 // re-acquire pointer lock from this click
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [controls, loop]);

  const quit = useCallback(() => {
    const g = gs.current;
    if (!g) return;
    g.paused = false;
    g.phase = 'idle';
    setPaused(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    render();
    syncHud();
  }, [render, syncHud]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPaused(false);
    gs.current = {
      phase: 'playing', player: { x: 1.5, y: 1.5, angle: 0 }, enemies: [],
      score: 0, health: CFG.maxHealth, ammo: CFG.magSize, reserve: CFG.reserveStart,
      kills: 0, totalKills: 0, wave: 0, waveTotal: 0,
      shootCooldown: 0, flashTimer: 0, dmgTimer: 0, hitMarker: 0, reloadTimer: 0,
      touch: false, paused: false, flow: map.computeFlow(1.5, 1.5), flowCell: -1, banner: null,
    };
    spawnWave(gs.current, 0);
    syncHud();
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, syncHud, spawnWave]);

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
    if (e.pointerType === 'touch') { g.touch = true; shoot(); return; }
    const canvas = canvasRef.current;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock(); return;
    }
    shoot();
  };

  const { phase, score, health, ammo, reserve, kills, wave, waveTotal, reloading } = hud;
  const phaseColor = phase === 'playing' ? 'var(--accent-primary)'
    : phase === 'gameover' ? 'var(--accent-secondary)'
      : phase === 'won' ? '#27c93f' : 'var(--text-dim)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
        <span><span style={{ color: 'var(--text-dim)' }}>HP </span><span style={{ color: health > 50 ? '#27c93f' : health > 25 ? '#ffbd2e' : '#ff5f56' }}>{health}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>AMMO </span><span style={{ color: reloading ? '#ffbd2e' : 'var(--accent-primary)' }}>{reloading ? '--' : ammo}</span><span style={{ color: 'var(--text-dim)' }}> / {reserve}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>WAVE </span><span style={{ color: 'var(--accent-primary)' }}>{wave}/{WAVES.length}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>LEFT </span><span style={{ color: 'var(--accent-secondary)' }}>{Math.max(0, waveTotal - kills)}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>SCORE </span><span style={{ color: '#ffbb00' }}>{score}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>STATUS </span><span style={{ color: phaseColor }}>{phase.toUpperCase()}</span></span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <CanvasStage>
          <canvas
            ref={canvasRef} width={SW} height={SH}
            onPointerDown={onCanvasPointerDown}
            onContextMenu={(e) => e.preventDefault()}
            style={{ border: '1px solid var(--border-color)', borderRadius: '4px', maxWidth: '100%', display: 'block', margin: '0 auto', cursor: 'crosshair', touchAction: 'none' }}
          />
          {paused && <PauseOverlay onResume={resume} onQuit={quit} quitLabel="END" />}
        </CanvasStage>
      </div>

      {phase !== 'playing' && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button onClick={startGame} className="cyber-btn" style={{ fontSize: '0.95rem', padding: '0.75rem 2rem' }}>
            {phase === 'idle' ? '[ START GAME ]' : '[ PLAY AGAIN ]'}
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <TouchPad controls={controls} onFire={shoot} onReload={reload} gs={gs} />
      )}

      <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginTop: '1.2rem' }}>
        [ W/A/S/D ] Move &nbsp;·&nbsp; [ Mouse / ←→ ] Look &nbsp;·&nbsp; [ Click / SPACE ] Shoot &nbsp;·&nbsp; [ R ] Reload
      </p>
      <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
        Survive <span style={{ color: 'var(--accent-primary)' }}>{WAVES.length}</span> waves · they shoot back, and they hunt you around corners
      </p>
    </div>
  );
};

export default Survival;
