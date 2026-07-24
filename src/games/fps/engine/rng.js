// Deterministic PRNG. Everything in the duel simulation must draw randomness
// from here, seeded identically on both peers, or the two clients desync and
// the anti-cheat hash comparison (see net/anticheat.js) fires immediately.
// Math.random() is banned inside any simulation that networking touches.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A tiny stateful wrapper so callers can pass one object around and get
// reproducible sequences: rng.next() in [0,1), rng.range(a,b), rng.int(n).
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    seed,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}
