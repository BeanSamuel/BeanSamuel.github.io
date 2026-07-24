// Wire protocol for the online duel. Kept tiny and versioned so a mismatched
// build refuses to connect instead of desyncing silently.

export const PROTOCOL_VERSION = 1;

// Lockstep tuning.
export const INPUT_DELAY = 3;    // ticks of input buffering (~100ms at 30Hz)
export const HASH_INTERVAL = 30; // exchange a state fingerprint once per sim second

export const MSG = {
  HELLO: 'hello', // { t, version, seed, hostIndex }
  INPUT: 'in',    // { t, input }
  HASH: 'hash',   // { t, tick, hash }
};

export const NEUTRAL_INPUT = { fwd: 0, strafe: 0, turn: 0, fire: false, dash: false, weapon: 0 };
