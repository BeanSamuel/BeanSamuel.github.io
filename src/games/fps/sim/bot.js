import { duelMap as map } from './duelSim';
import { normAngle } from '../engine/geometry';
import { WEAPONS } from '../engine/weapons';

// The bot never touches the world directly — it produces the same InputState a
// human would, which is fed into stepDuel. That means vs-AI exercises the exact
// data path the online mode uses, so shipping vs-AI gets online most of the way
// there. The bot runs only locally, so Math.random here is fine (it is not part
// of the networked deterministic sim).

const DIFF = {
  easy: { react: 0.38, aimErr: 0.16, aimLerp: 0.06, peek: 0.2, preferClose: 0.5, fireGap: 0.15 },
  hard: { react: 0.11, aimErr: 0.035, aimLerp: 0.18, peek: 0.7, preferClose: 0.8, fireGap: 0.0 },
};

export function makeBot(selfIdx, difficulty = 'easy') {
  return {
    selfIdx,
    d: DIFF[difficulty] || DIFF.easy,
    flow: null, flowCell: -1,
    reactTimer: 0, sawEnemy: false,
    aimNoiseX: 0, aimNoiseTimer: 0,
    strafeDir: 1, strafeTimer: 0,
  };
}

// dt here is the fixed sim DT; state is post/pre step — we read current state.
export function botInput(bot, state, dt) {
  const me = state.players[bot.selfIdx];
  const foe = state.players[1 - bot.selfIdx];
  const input = { fwd: 0, strafe: 0, turn: 0, fire: false, dash: false, weapon: me.weapon };
  if (!me.alive || state.phase !== 'live') return input;

  const dx = foe.x - me.x, dy = foe.y - me.y;
  const dist = Math.hypot(dx, dy);
  const los = foe.alive && map.hasLOS(me.x, me.y, foe.x, foe.y);

  // Refresh pathing toward the foe when either crosses a cell.
  const foeCell = Math.floor(foe.y) * map.w + Math.floor(foe.x);
  if (foeCell !== bot.flowCell) { bot.flow = map.computeFlow(foe.x, foe.y); bot.flowCell = foeCell; }

  // --- Aim ---
  const wantAngle = Math.atan2(dy, dx);
  // Wander the aim noise so it isn't a constant offset (reads as human sway).
  bot.aimNoiseTimer -= dt;
  if (bot.aimNoiseTimer <= 0) { bot.aimNoiseTimer = 0.25; bot.aimNoiseX = (Math.random() - 0.5) * 2 * bot.d.aimErr; }
  const targetAngle = wantAngle + bot.aimNoiseX;
  const delta = normAngle(targetAngle - me.angle);
  input.turn = Math.max(-0.55, Math.min(0.55, delta * bot.d.aimLerp * (dt / (1 / 30) )));

  // --- Reaction gate before firing on a fresh sighting ---
  if (los) {
    if (!bot.sawEnemy) { bot.sawEnemy = true; bot.reactTimer = bot.d.react; }
    if (bot.reactTimer > 0) bot.reactTimer -= dt;
  } else {
    bot.sawEnemy = false; bot.reactTimer = bot.d.react;
  }

  const w = WEAPONS[me.weapon];
  const aimed = Math.abs(delta) < (w.id === 'fist' ? 0.35 : 0.14);
  if (los && aimed && bot.reactTimer <= 0 && dist <= w.range + 1) {
    input.fire = Math.random() > bot.d.fireGap;
  }

  // --- Movement ---
  bot.strafeTimer -= dt;
  if (bot.strafeTimer <= 0) { bot.strafeTimer = 0.6 + Math.random() * 0.8; bot.strafeDir = Math.random() < 0.5 ? -1 : 1; }

  if (los) {
    // In a fight: keep preferred range and strafe to be a hard target.
    const ideal = w.id === 'fist' ? 1.2 : (w.id === 'rpg' || w.id === 'nade' ? 6 : 4);
    if (dist > ideal + 1) input.fwd = 1;
    else if (dist < ideal - 1) input.fwd = -1;
    input.strafe = bot.strafeDir;
    if (Math.random() < 0.004 && me.dashCd <= 0) input.dash = true;
  } else if (bot.flow) {
    // No sight: walk the flow field toward the foe (turn toward next cell).
    const s = map.flowStep(bot.flow, me.x, me.y);
    if (s) {
      const na = Math.atan2(s.y - me.y, s.x - me.x);
      const nd = normAngle(na - me.angle);
      input.turn = Math.max(-0.55, Math.min(0.55, nd * 0.3));
      input.fwd = 1;
    }
  }

  // Occasionally switch to a sensible weapon by range (hard bot only).
  if (bot.d.peek > 0.5 && Math.random() < 0.003) {
    input.weapon = dist < 2 ? 2 : dist > 7 ? 0 : 1;
  }
  return input;
}
