import { useEffect, useState } from 'react';

// Shared, persisted mouse-look sensitivity for every FPS mode. Kept outside
// React so the render loops can read the current value through a ref (see
// useControls) without re-subscribing or re-memoising their per-tick
// callbacks, while any number of UI widgets stay in sync via subscribe().

const KEY = 'fps.sensitivity';

// Sensitivity is stored as a human-friendly multiplier; 1.0x maps to the tuned
// baseline of radians-per-pixel the sim was balanced around.
export const SENS_MIN = 0.2;
export const SENS_MAX = 3.0;
export const SENS_DEFAULT = 1.0;
export const SENS_STEP = 0.05;
const BASE_RAD_PER_PX = 0.0025;

const clamp = (v) => Math.min(SENS_MAX, Math.max(SENS_MIN, v));

const listeners = new Set();
let multiplier = load();

function load() {
  try {
    const raw = parseFloat(localStorage.getItem(KEY));
    if (Number.isFinite(raw)) return clamp(raw);
  } catch { /* localStorage unavailable (SSR/private mode) — fall through */ }
  return SENS_DEFAULT;
}

export function getSensitivity() {
  return multiplier;
}

// radians of yaw per pixel of raw mouse movement — what useControls multiplies
// the accumulated mouse delta by.
export function getMouseSens() {
  return BASE_RAD_PER_PX * multiplier;
}

export function setSensitivity(v) {
  const next = clamp(v);
  if (next === multiplier) return;
  multiplier = next;
  try { localStorage.setItem(KEY, String(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l(next));
}

export function subscribeSensitivity(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// React binding for slider widgets: [value, setValue], live-synced across every
// mounted consumer.
export function useSensitivity() {
  const [v, setV] = useState(multiplier);
  useEffect(() => subscribeSensitivity(setV), []);
  return [v, setSensitivity];
}
