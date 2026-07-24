import { useRef, useEffect, useState, useCallback } from 'react';
import { duelMap as map, DT, DUEL_CFG, WEAPONS } from '../sim/duelSim';
import { SW, SH } from '../engine/geometry';
import { useControls } from '../engine/input';
import {
  makeCamera, clearScreen, renderWorld, projectPoint, drawClipped, drawFighter, drawOrb,
  drawCrosshair, drawMuzzle, drawVignette, drawMinimap, drawHpBar, drawAmmo, drawEndOverlay,
} from '../engine/render';
import { TouchPad } from './touch';

// Shared duel presentation. Given a driver (local AI or networked lockstep),
// runs a fixed-timestep loop, renders from the local player's camera and shows
// the first-to-5 scoreline. Knows nothing about where the opponent input comes
// from.
const Duel = ({ makeDriver, statusText, hint, canRematch, onExit }) => {
  const canvasRef = useRef(null);
  const driverRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const [hud, setHud] = useState({ myHp: 100, myScore: 0, foeScore: 0, weapon: 0, ammo: 0, reserve: 0, reloading: false, phase: 'countdown', countdown: 3, winner: -1, status: '' });

  const syncHud = useCallback(() => {
    const drv = driverRef.current;
    if (!drv) return;
    const s = drv.state;
    const me = s.players[drv.localIndex];
    const foe = s.players[1 - drv.localIndex];
    const ld = me.loadout[me.weapon];
    setHud((prev) => {
      const next = {
        myHp: Math.max(0, Math.round(me.hp)), myScore: me.score, foeScore: foe.score,
        weapon: me.weapon, ammo: ld.ammo === Infinity ? 99 : ld.ammo,
        reserve: ld.reserve === Infinity ? 99 : ld.reserve, reloading: me.reloadTimer > 0,
        phase: s.phase, countdown: Math.max(0, Math.ceil(s.countdown)), winner: s.winner,
        status: drv.status,
      };
      for (const k in next) if (prev[k] !== next[k]) return next;
      return prev;
    });
  }, []);

  const controls = useControls({
    canvasRef,
    weaponCount: WEAPONS.length,
    isActive: () => driverRef.current?.state.phase === 'live',
  });

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const drv = driverRef.current;
    if (!drv) { clearScreen(ctx); return; }
    const s = drv.state;
    const me = s.players[drv.localIndex];
    const foe = s.players[1 - drv.localIndex];

    clearScreen(ctx);
    const cam = makeCamera(me);
    const zBuf = renderWorld(ctx, map, cam);

    // Opponent + projectiles as depth-sorted sprites.
    const sprites = [];
    if (foe.alive) {
      const p = projectPoint(cam, foe.x, foe.y);
      if (p) sprites.push({ kind: 'foe', p, hurt: foe.hitFlash > 0 });
    }
    s.projectiles.forEach((pr) => {
      const p = projectPoint(cam, pr.x, pr.y);
      if (p) sprites.push({ kind: 'proj', p });
    });
    sprites.sort((a, b) => b.p.depth - a.p.depth).forEach((sp) => {
      const size = Math.abs(SH / sp.p.depth);
      if (sp.kind === 'foe') {
        drawClipped(ctx, zBuf, sp.p.sx, size * 0.38, sp.p.depth, () =>
          drawFighter(ctx, sp.p.sx, size, sp.p.depth, { hurt: sp.hurt, color: '255,42,109', glow: '#ff2a6d' }));
      } else {
        drawClipped(ctx, zBuf, sp.p.sx, size * 0.15, sp.p.depth, () => drawOrb(ctx, sp.p.sx, size * 0.6, sp.p.depth, '#ffbb00'));
      }
    });
    ctx.shadowBlur = 0;

    const busy = me.fireCd > 0 || me.reloadTimer > 0;
    drawCrosshair(ctx, me.hitMarker > 0 ? '#fff' : busy ? '#ff2a6d' : '#45f3ff', me.hitMarker);
    drawMuzzle(ctx, me.flashTimer);
    drawVignette(ctx, me.dmgTimer);
    drawHpBar(ctx, me.hp, DUEL_CFG.maxHealth);
    const ld = me.loadout[me.weapon];
    drawAmmo(ctx, ld.ammo === Infinity ? 99 : ld.ammo, ld.reserve === Infinity ? 99 : ld.reserve, me.reloadTimer > 0, WEAPONS[me.weapon].name);
    drawMinimap(ctx, map, me, foe.alive ? [{ x: foe.x, y: foe.y, color: '#ff2a6d' }] : []);

    // Scoreline (first to 5).
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px "JetBrains Mono",monospace';
    ctx.fillStyle = '#45f3ff'; ctx.fillText(`${me.score}`, SW / 2 - 34, 30);
    ctx.fillStyle = 'rgba(197,198,199,0.6)'; ctx.font = '16px "JetBrains Mono",monospace'; ctx.fillText('—', SW / 2, 28);
    ctx.fillStyle = '#ff2a6d'; ctx.font = 'bold 22px "JetBrains Mono",monospace'; ctx.fillText(`${foe.score}`, SW / 2 + 34, 30);
    ctx.font = '10px "JetBrains Mono",monospace'; ctx.fillStyle = 'rgba(197,198,199,0.6)';
    ctx.fillText(`FIRST TO ${DUEL_CFG.winScore}`, SW / 2, 44);

    if (s.phase === 'countdown') {
      ctx.fillStyle = 'rgba(69,243,255,0.95)'; ctx.font = 'bold 64px "JetBrains Mono",monospace';
      ctx.fillText(`${Math.max(1, Math.ceil(s.countdown))}`, SW / 2, SH / 2 + 20);
    }
    if (!me.alive && s.phase === 'live') {
      ctx.fillStyle = 'rgba(255,42,109,0.9)'; ctx.font = '20px "JetBrains Mono",monospace';
      ctx.fillText(`RESPAWNING ${Math.ceil(me.respawnTimer)}`, SW / 2, SH / 2 + 40);
    }

    if (drv.status && drv.status !== 'live') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, SH / 2 - 20, SW, 40);
      ctx.fillStyle = '#ffbd2e'; ctx.font = '16px "JetBrains Mono",monospace';
      ctx.fillText(statusLabel(drv.status), SW / 2, SH / 2 + 6);
    }

    if (s.phase === 'matchover') {
      const win = s.winner === drv.localIndex;
      drawEndOverlay(ctx, {
        title: win ? 'VICTORY' : 'DEFEAT',
        titleColor: win ? '#27c93f' : '#ff2a6d',
        lines: [`${me.score} — ${foe.score}`, canRematch ? 'press REMATCH below' : 'back to menu'],
      });
    }
  }, [statusText, canRematch]); // eslint-disable-line react-hooks/exhaustive-deps

  const sampleLocal = useCallback((tick) => controls.sampleInput(tick, 2.7, DT), [controls]);

  const loop = useCallback((now) => {
    const drv = driverRef.current;
    if (!drv) return;
    const dt = Math.min(0.25, (now - lastRef.current) / 1000) || 0;
    lastRef.current = now;
    accRef.current += dt;
    let steps = 0;
    while (accRef.current >= DT && steps < 8) {
      const advanced = drv.tick();       // false = lockstep stall (waiting on peer)
      accRef.current -= DT;
      steps++;
      if (!advanced) { accRef.current = 0; break; }
      if (drv.state.phase === 'matchover') break;
    }
    render();
    syncHud();
    rafRef.current = requestAnimationFrame(loop);
  }, [render, syncHud]);

  const start = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    driverRef.current = makeDriver(sampleLocal);
    accRef.current = 0;
    lastRef.current = performance.now();
    syncHud();
    rafRef.current = requestAnimationFrame(loop);
  }, [makeDriver, sampleLocal, loop, syncHud]);

  useEffect(() => {
    start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      driverRef.current?.destroy();
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [start]);

  const onCanvasPointerDown = (e) => {
    const canvas = canvasRef.current;
    if (e.pointerType === 'touch') { controls.setKey('MouseLeft', true); return; }
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { canvas.requestPointerLock(); return; }
    controls.setKey('MouseLeft', true);
  };
  const onCanvasPointerUp = () => controls.setKey('MouseLeft', false);

  const s = hud;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
        <span><span style={{ color: 'var(--text-dim)' }}>YOU </span><span style={{ color: '#45f3ff' }}>{s.myScore}</span><span style={{ color: 'var(--text-dim)' }}> — </span><span style={{ color: '#ff2a6d' }}>{s.foeScore}</span><span style={{ color: 'var(--text-dim)' }}> FOE</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>HP </span><span style={{ color: s.myHp > 50 ? '#27c93f' : s.myHp > 25 ? '#ffbd2e' : '#ff5f56' }}>{s.myHp}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>{WEAPONS[s.weapon].name} </span><span style={{ color: s.reloading ? '#ffbd2e' : 'var(--accent-primary)' }}>{s.reloading ? '--' : s.ammo}</span><span style={{ color: 'var(--text-dim)' }}> / {s.reserve}</span></span>
        <span><span style={{ color: 'var(--text-dim)' }}>NET </span><span style={{ color: s.status === 'live' ? '#27c93f' : '#ffbd2e' }}>{statusText || s.status.toUpperCase()}</span></span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <canvas
          ref={canvasRef} width={SW} height={SH}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ border: '1px solid var(--border-color)', borderRadius: '4px', maxWidth: '100%', display: 'block', margin: '0 auto', cursor: 'crosshair', touchAction: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
        {(s.phase === 'matchover' && canRematch) && (
          <button onClick={start} className="cyber-btn" style={{ padding: '0.6rem 1.6rem' }}>[ REMATCH ]</button>
        )}
        {onExit && <button onClick={onExit} className="cyber-btn" style={{ padding: '0.6rem 1.6rem' }}>[ MENU ]</button>}
      </div>

      <TouchPad controls={controls} onFire={() => { controls.setKey('MouseLeft', true); setTimeout(() => controls.setKey('MouseLeft', false), 120); }} onReload={() => controls.setKey('KeyR', true)} />

      <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginTop: '1.2rem' }}>
        [ WASD ] Move · [ Mouse ] Aim · [ Click/SPACE ] Fire · [ Shift ] Dash · [ 1-5 ] Weapon · [ R ] Reload
      </p>
      {hint && <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '0.4rem' }}>{hint}</p>}
    </div>
  );
};

function statusLabel(status) {
  return {
    connecting: 'CONNECTING…', waiting: 'WAITING FOR OPPONENT…',
    'peer-left': 'OPPONENT LEFT', desync: 'DESYNC — MATCH VOIDED', cheat: 'CHEAT DETECTED — VOIDED',
  }[status] || status.toUpperCase();
}

export default Duel;
