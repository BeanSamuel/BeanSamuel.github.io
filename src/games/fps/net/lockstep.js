import { createDuelState, stepDuel, hashState } from '../sim/duelSim';
import { makeValidator, sanitizeInput } from './anticheat';
import { INPUT_DELAY, HASH_INTERVAL, MSG, NEUTRAL_INPUT } from './protocol';

// Deterministic lockstep driver. Both peers run this over the same seed. Only
// InputStates cross the wire — never positions, HP or "I hit you". Each side
// derives every outcome from the shared inputs, so no peer can assert a result.
// A periodic state-hash exchange catches any divergence (desync or tamper) and
// voids the match. See docs/fps-modes-design.md §5.3–5.5.

export function makeOnlineDriver({ conn, localIndex, seed, sampleLocal, onStatus }) {
  const state = createDuelState(seed);
  const remoteIndex = 1 - localIndex;
  const localBuf = new Map();
  const remoteBuf = new Map();
  const localHashes = new Map();
  const remoteHashes = new Map();
  const validator = makeValidator();

  let inputTick = INPUT_DELAY;   // next future tick we generate local input for
  let terminal = null;           // 'peer-left' | 'desync' | 'cheat' — freezes the sim

  // Prefill the first INPUT_DELAY ticks on both sides with neutral input, so the
  // sim can start without a round-trip. These land during the countdown, where
  // inputs are ignored anyway.
  for (let t = 0; t < INPUT_DELAY; t++) {
    localBuf.set(t, { ...NEUTRAL_INPUT, tick: t });
    remoteBuf.set(t, { ...NEUTRAL_INPUT, tick: t });
  }

  const fail = (why) => {
    if (terminal) return;
    terminal = why;
    onStatus?.(why);
  };

  const compareHash = (tick) => {
    if (localHashes.has(tick) && remoteHashes.has(tick)) {
      if (localHashes.get(tick) !== remoteHashes.get(tick)) fail('desync');
    }
  };

  conn.onData((msg) => {
    if (terminal || !msg || typeof msg !== 'object') return;
    if (msg.t === MSG.INPUT) {
      const reason = validator.checkInput(msg.input, performance.now());
      if (reason) { fail('cheat'); return; }
      remoteBuf.set(msg.input.tick, sanitizeInput(msg.input));
    } else if (msg.t === MSG.HASH) {
      remoteHashes.set(msg.tick, msg.hash >>> 0);
      compareHash(msg.tick);
    }
  });
  conn.onClose(() => { if (state.phase !== 'matchover') fail('peer-left'); });

  const generateAheadTo = (target) => {
    while (inputTick <= target) {
      const input = sampleLocal(inputTick);
      input.tick = inputTick;
      localBuf.set(inputTick, input);
      conn.send({ t: MSG.INPUT, input });
      inputTick++;
    }
  };

  const prune = (tick) => {
    // Keep a small trailing window; drop everything well behind the sim.
    const cutoff = tick - 4;
    if (cutoff < 0) return;
    localBuf.delete(cutoff); remoteBuf.delete(cutoff);
    localHashes.delete(cutoff - HASH_INTERVAL);
    remoteHashes.delete(cutoff - HASH_INTERVAL);
  };

  const driver = {
    kind: 'online',
    localIndex,
    state,
    get status() {
      if (terminal) return terminal;
      return state.phase === 'live' || state.phase === 'countdown' ? 'live' : 'waiting';
    },
    tick() {
      if (terminal || state.phase === 'matchover') return false;
      const T = state.tick;
      generateAheadTo(T + INPUT_DELAY);

      const local = localBuf.get(T);
      const remote = remoteBuf.get(T);
      if (!local || !remote) { onStatus?.('waiting'); return false; } // stall on the peer

      const inputs = [];
      inputs[localIndex] = local;
      inputs[remoteIndex] = remote;
      stepDuel(state, inputs);

      // Fingerprint + exchange on the interval.
      if (state.tick % HASH_INTERVAL === 0) {
        const h = hashState(state);
        localHashes.set(state.tick, h);
        conn.send({ t: MSG.HASH, tick: state.tick, hash: h });
        compareHash(state.tick);
      }
      prune(T);
      return true;
    },
    destroy() { try { conn.close(); } catch { /* noop */ } },
  };

  return driver;
}
