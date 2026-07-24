import { createDuelState, stepDuel } from './duelSim';
import { makeBot, botInput } from './bot';

// A driver owns the duel state and decides, each tick, what the two input
// slots are and whether the sim may advance. Duel.jsx is driver-agnostic: it
// renders driver.state and calls driver.tick() at a fixed cadence.

// Local practice vs the bot. Player 0 is the human; player 1 is the AI. Always
// ready, one tick per call.
export function makeAiDriver({ difficulty, seed, sampleLocal }) {
  const state = createDuelState(seed);
  const bot = makeBot(1, difficulty);
  return {
    kind: 'ai',
    localIndex: 0,
    state,
    status: 'live',
    onEvents: null,
    tick() {
      const local = sampleLocal(state.tick);
      const ai = botInput(bot, state, 1 / 30);
      const events = stepDuel(state, [local, ai]);
      if (events.length && this.onEvents) this.onEvents(events);
      return true;
    },
    destroy() {},
  };
}
