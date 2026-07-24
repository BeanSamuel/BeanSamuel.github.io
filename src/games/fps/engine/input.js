import { useCallback, useEffect, useMemo, useRef } from 'react';

// Shared control layer. Collects keyboard, mouse-look (pointer lock) and touch
// into a mutable `keys` map + accumulated mouse delta, and exposes a
// `sampleInput()` that snapshots the current intent into the InputState shape
// the sim consumes. Modes read snapshots each tick; the online path serialises
// that same snapshot onto the wire (see net/protocol.js).

const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function useControls({ canvasRef, isActive, mouseSens = 0.0025, weaponCount = 0, onFire, onReload, onWeapon, onPause }) {
  const keys = useRef({});
  const mouseDX = useRef(0);
  const locked = useRef(false);
  const touch = useRef(false);
  const weapon = useRef(0);

  // Latest-ref pattern: callers pass fresh inline functions (isActive, onFire…)
  // every render. If the effects below depended on them they would re-subscribe
  // each render — and the mouse effect's cleanup calls exitPointerLock(), so a
  // single HUD re-render after a shot would release pointer lock and the cursor
  // would pop out mid-game. Reading them through a ref keeps the listeners
  // mounted once, so pointer lock is only dropped on real unmount.
  const cb = useRef({});
  cb.current = { isActive, onFire, onReload, onWeapon, onPause, weaponCount };

  useEffect(() => {
    const onDown = (e) => {
      const c = cb.current;
      if (!c.isActive()) { keys.current[e.code] = true; return; }
      keys.current[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); c.onFire?.(); }
      if (e.code === 'KeyR') { e.preventDefault(); c.onReload?.(); }
      if (/^Digit[1-5]$/.test(e.code)) {
        e.preventDefault();
        const idx = +e.code.slice(5) - 1;
        if (!c.weaponCount || idx < c.weaponCount) { weapon.current = idx; c.onWeapon?.(idx); }
      }
      if (MOVE_KEYS_INCLUDES(e.code)) e.preventDefault();
    };
    const onUp = (e) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (locked.current && cb.current.isActive()) mouseDX.current += e.movementX;
    };
    // The browser force-releases pointer lock on Esc; we can't intercept that
    // key. So "lock lost while playing" is the pause signal: detect the
    // locked→unlocked transition here and let the mode open its pause menu.
    const onLockChange = () => {
      const nowLocked = document.pointerLockElement === canvasRef.current;
      const wasLocked = locked.current;
      locked.current = nowLocked;
      if (wasLocked && !nowLocked && cb.current.isActive?.()) cb.current.onPause?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [canvasRef]);

  // Snapshot the current control state as a bounded InputState. `turn` folds in
  // the accumulated mouse delta and is cleared so it is consumed exactly once.
  const sampleInput = useCallback((tick, turnSpeed, dt) => {
    const k = keys.current;
    let fwd = 0, strafe = 0;
    if (k.KeyW) fwd += 1;
    if (k.KeyS) fwd -= 1;
    if (k.KeyD) strafe += 1;
    if (k.KeyA) strafe -= 1;

    let turn = mouseDX.current * mouseSens;
    if (k.ArrowLeft) turn -= turnSpeed * dt;
    if (k.ArrowRight) turn += turnSpeed * dt;
    mouseDX.current = 0;

    return {
      tick,
      fwd: Math.sign(fwd),
      strafe: Math.sign(strafe),
      turn,
      fire: !!k.Space || !!k.MouseLeft,
      dash: !!k.ShiftLeft || !!k.ShiftRight,
      weapon: weapon.current,
    };
  }, [mouseSens]);

  // Request pointer lock on the canvas. Must be called from a user gesture
  // (canvas click or a Resume button click), or the browser rejects it.
  const lock = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  }, [canvasRef]);

  // Memoised so the returned API keeps a stable identity across renders — a
  // fresh object each render would retrigger every effect that depends on it
  // (e.g. Duel would rebuild its driver every frame and never advance).
  return useMemo(() => ({
    keys, locked, touch, weapon, sampleInput, lock,
    setKey: (code, v) => { keys.current[code] = v; },
    setWeapon: (i) => { weapon.current = i; },
    isLocked: () => locked.current,
  }), [sampleInput, lock]);
}

function MOVE_KEYS_INCLUDES(code) {
  return MOVE_KEYS.includes(code);
}
