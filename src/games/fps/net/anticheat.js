import { DUEL_CFG } from '../sim/duelSim';
import { WEAPONS } from '../engine/weapons';

// Plausibility gate on the *other* peer's inputs before they enter the
// deterministic sim. Because outcomes are computed identically on both sides
// (never transmitted), the remaining attack surface is the input stream itself:
// a tampered client sending impossible inputs (teleport-sized turns, no-cooldown
// fire, out-of-range weapon ids). We reject those and void the match.
//
// What this canNOT catch: aimbot / wallhack — legal-but-superhuman inputs are
// indistinguishable from a skilled human without a trusted server. See
// docs/fps-modes-design.md §5.3.

const MAX_MSG_PER_SEC = 120; // generous ceiling; lockstep is ~30 in/s + hashes

export function makeValidator() {
  let lastTick = -1;
  let windowStart = 0;
  let msgCount = 0;

  return {
    // Returns null if OK, or a string reason if the input is illegal.
    checkInput(input, nowMs) {
      if (!input || typeof input !== 'object') return 'malformed input';
      if (typeof input.tick !== 'number' || input.tick < 0) return 'bad tick';
      // Ticks must strictly advance and not jump backward.
      if (input.tick <= lastTick) return 'non-monotonic tick';
      lastTick = input.tick;

      if (![-1, 0, 1].includes(input.fwd | 0)) return 'fwd out of range';
      if (![-1, 0, 1].includes(input.strafe | 0)) return 'strafe out of range';
      if (typeof input.turn !== 'number' || Math.abs(input.turn) > DUEL_CFG.turnCap + 1e-6) return 'turn exceeds cap';
      if (typeof input.weapon !== 'number' || input.weapon < 0 || input.weapon >= WEAPONS.length) return 'bad weapon id';
      if (typeof input.fire !== 'boolean' && input.fire !== 0 && input.fire !== 1) return 'bad fire flag';

      // Flood protection.
      if (nowMs - windowStart > 1000) { windowStart = nowMs; msgCount = 0; }
      if (++msgCount > MAX_MSG_PER_SEC) return 'message flood';
      return null;
    },
  };
}

// Sanitise an input to the exact InputState shape the sim expects, so a peer
// cannot smuggle extra fields that some future sim change might read.
export function sanitizeInput(input) {
  return {
    tick: input.tick | 0,
    fwd: input.fwd | 0,
    strafe: input.strafe | 0,
    turn: Math.max(-DUEL_CFG.turnCap, Math.min(DUEL_CFG.turnCap, +input.turn || 0)),
    fire: !!input.fire,
    dash: !!input.dash,
    weapon: input.weapon | 0,
  };
}
