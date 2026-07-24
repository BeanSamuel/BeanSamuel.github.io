import { useEffect, useMemo, useRef } from 'react';

// Shared control layer. Collects keyboard, mouse-look (pointer lock) and touch
// into a mutable `keys` map + accumulated mouse delta, and exposes a
// `sampleInput()` that snapshots the current intent into the InputState shape
// the sim consumes. Modes read snapshots each tick; the online path serialises
// that same snapshot onto the wire (see net/protocol.js).

const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function useControls({ canvasRef, isActive, mouseSens = 0.0025, weaponCount = 0, onFire, onReload, onWeapon }) {
  const keys = useRef({});
  const mouseDX = useRef(0);
  const locked = useRef(false);
  const touch = useRef(false);
  const weapon = useRef(0);

  useEffect(() => {
    const onDown = (e) => {
      if (!isActive()) { keys.current[e.code] = true; return; }
      keys.current[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); onFire?.(); }
      if (e.code === 'KeyR') { e.preventDefault(); onReload?.(); }
      if (/^Digit[1-5]$/.test(e.code)) {
        e.preventDefault();
        const idx = +e.code.slice(5) - 1;
        if (!weaponCount || idx < weaponCount) { weapon.current = idx; onWeapon?.(idx); }
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
  }, [isActive, onFire, onReload, onWeapon, weaponCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const onMove = (e) => {
      if (locked.current && isActive()) mouseDX.current += e.movementX;
    };
    const onLockChange = () => { locked.current = document.pointerLockElement === canvas; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [canvasRef, isActive]);

  // Snapshot the current control state as a bounded InputState. `turn` folds in
  // the accumulated mouse delta and is cleared so it is consumed exactly once.
  // Memoised so the returned API keeps a stable identity across renders — a
  // fresh object each render would retrigger every effect that depends on it
  // (e.g. Duel would rebuild its driver every frame and never advance).
  const sampleInput = (tick, turnSpeed, dt) => {
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
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({
    keys, locked, touch, weapon, sampleInput,
    setKey: (code, v) => { keys.current[code] = v; },
    setWeapon: (i) => { weapon.current = i; },
    isLocked: () => locked.current,
  }), [mouseSens]);
}

function MOVE_KEYS_INCLUDES(code) {
  return MOVE_KEYS.includes(code);
}
