import { duelMap as map, DUEL_SPAWNS } from '../engine/maps';
import { normAngle } from '../engine/geometry';
import { WEAPONS, makeLoadout } from '../engine/weapons';
import { makeRng } from '../engine/rng';

// Deterministic 1v1 simulation. Given the same seed and the same per-tick input
// pair, both clients produce byte-identical state — that determinism is the
// entire basis of the online anti-cheat: nobody transmits "I hit you" or their
// HP, both derive it. Absolutely no Math.random / Date.now / rAF-dt in here.

export const DUEL_CFG = {
  tickHz: 30,
  moveSpeed: 3.4, strafeSpeed: 2.8, turnCap: 0.6, // max radians/tick (anti-cheat bound)
  dashSpeed: 6.2, dashTime: 0.16, dashCd: 1.1,
  playerRadius: 0.24,
  maxHealth: 100,
  respawn: 1.8,
  winScore: 5,
  hitCone: 0.24, // extra angular half-width added to body when resolving hitscan
};

export const DT = 1 / DUEL_CFG.tickHz;

function makePlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y, angle: spawn.angle,
    hp: DUEL_CFG.maxHealth, alive: true, respawnTimer: 0,
    weapon: 0, loadout: makeLoadout(),
    fireCd: 0, reloadTimer: 0, firedHeld: false,
    dashTimer: 0, dashCd: 0, dashDX: 0, dashDY: 0,
    score: 0,
    // visual-only, still deterministic
    hitFlash: 0, dmgTimer: 0, flashTimer: 0, hitMarker: 0,
  };
}

export function createDuelState(seed) {
  return {
    tick: 0,
    rng: makeRng(seed >>> 0),
    players: [makePlayer(DUEL_SPAWNS[0]), makePlayer(DUEL_SPAWNS[1])],
    projectiles: [],
    nextProjId: 0,
    phase: 'countdown', // countdown | live | matchover
    countdown: 3.0,
    winner: -1,
  };
}

function damage(state, victim, dmg, events, killerIdx, victimIdx) {
  if (!victim.alive) return;
  victim.hp -= dmg;
  victim.dmgTimer = 0.4;
  if (victim.hp <= 0) {
    victim.hp = 0; victim.alive = false; victim.respawnTimer = DUEL_CFG.respawn;
    if (killerIdx >= 0 && killerIdx !== victimIdx) {
      state.players[killerIdx].score++;
      events.push({ type: 'kill', killer: killerIdx, victim: victimIdx });
      if (state.players[killerIdx].score >= DUEL_CFG.winScore) {
        state.phase = 'matchover'; state.winner = killerIdx;
      }
    }
  }
}

function fireWeapon(state, shooterIdx, events) {
  const p = state.players[shooterIdx];
  const w = WEAPONS[p.weapon];
  const oppIdx = 1 - shooterIdx;
  const opp = state.players[oppIdx];
  p.fireCd = w.fireCooldown;
  p.flashTimer = 0.1;
  const ld = p.loadout[p.weapon];
  if (ld.ammo !== Infinity) ld.ammo--;

  if (w.kind === 'hitscan') {
    // Deterministic spread from the shared rng.
    const jitter = (state.rng.next() - 0.5) * 2 * w.spread;
    const aim = p.angle + jitter;
    if (!opp.alive) return;
    const dx = opp.x - p.x, dy = opp.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > w.range) return;
    const ang = Math.abs(normAngle(Math.atan2(dy, dx) - aim));
    const cone = Math.atan2(DUEL_CFG.playerRadius, dist);
    if (ang > cone) return;
    if (!map.hasLOS(p.x, p.y, opp.x, opp.y)) return;
    // Distance falloff keeps fists/short range from sniping across the map.
    damage(state, opp, w.damage, events, shooterIdx, oppIdx);
    p.hitMarker = 0.12; opp.hitFlash = 0.12;
    events.push({ type: 'hit', shooter: shooterIdx });
  } else {
    // Projectile: spawn a travelling shell resolved in stepProjectiles.
    state.projectiles.push({
      id: state.nextProjId++, owner: shooterIdx, weapon: p.weapon,
      x: p.x + Math.cos(p.angle) * 0.4, y: p.y + Math.sin(p.angle) * 0.4,
      vx: Math.cos(p.angle) * w.speed, vy: Math.sin(p.angle) * w.speed,
      fuse: w.fuse,
    });
  }
}

function explode(state, proj, events) {
  const w = WEAPONS[proj.weapon];
  events.push({ type: 'explosion', x: proj.x, y: proj.y });
  state.players.forEach((pl, idx) => {
    if (!pl.alive) return;
    const d = Math.hypot(pl.x - proj.x, pl.y - proj.y);
    if (d > w.aoe) return;
    if (!map.hasLOS(proj.x, proj.y, pl.x, pl.y)) return;
    const dmg = Math.round(w.damage * (1 - d / w.aoe));
    if (dmg > 0) damage(state, pl, dmg, events, proj.owner, idx);
  });
}

function stepProjectiles(state, events) {
  const survivors = [];
  for (const proj of state.projectiles) {
    proj.fuse -= DT;
    const nx = proj.x + proj.vx * DT;
    const ny = proj.y + proj.vy * DT;
    let boom = proj.fuse <= 0 || map.isWall(nx, ny);
    // Direct impact on the other player.
    if (!boom) {
      for (const pl of state.players) {
        if (pl.alive && Math.hypot(pl.x - nx, pl.y - ny) < DUEL_CFG.playerRadius + 0.2) { boom = true; break; }
      }
    }
    proj.x = nx; proj.y = ny;
    if (boom) explode(state, proj, events);
    else survivors.push(proj);
  }
  state.projectiles = survivors;
}

function movePlayer(p, inp) {
  // Turn is pre-clamped by anti-cheat, but clamp again defensively.
  p.angle = normAngle(p.angle + Math.max(-DUEL_CFG.turnCap, Math.min(DUEL_CFG.turnCap, inp.turn || 0)));
  const cosA = Math.cos(p.angle), sinA = Math.sin(p.angle);

  if (p.dashTimer > 0) {
    p.dashTimer -= DT;
    map.moveWithSlide(p, p.dashDX * DT, p.dashDY * DT, DUEL_CFG.playerRadius);
    return;
  }

  let fwd = inp.fwd | 0, strafe = inp.strafe | 0;
  if (fwd || strafe) {
    const len = Math.hypot(fwd, strafe);
    fwd /= len; strafe /= len;
    if (inp.dash && p.dashCd <= 0) {
      p.dashCd = DUEL_CFG.dashCd; p.dashTimer = DUEL_CFG.dashTime;
      p.dashDX = cosA * fwd * DUEL_CFG.dashSpeed - sinA * strafe * DUEL_CFG.dashSpeed;
      p.dashDY = sinA * fwd * DUEL_CFG.dashSpeed + cosA * strafe * DUEL_CFG.dashSpeed;
      return;
    }
    const dx = (cosA * fwd * DUEL_CFG.moveSpeed - sinA * strafe * DUEL_CFG.strafeSpeed) * DT;
    const dy = (sinA * fwd * DUEL_CFG.moveSpeed + cosA * strafe * DUEL_CFG.strafeSpeed) * DT;
    map.moveWithSlide(p, dx, dy, DUEL_CFG.playerRadius);
  }
}

/**
 * Advance exactly one fixed tick. `inputs` is [inpA, inpB]. Returns an event
 * list for local effects/sound; the events are derived, never transmitted.
 */
export function stepDuel(state, inputs) {
  const events = [];
  state.tick++;

  if (state.phase === 'countdown') {
    state.countdown -= DT;
    // decay visual timers even during countdown
    state.players.forEach((p) => decayTimers(p));
    if (state.countdown <= 0) { state.phase = 'live'; events.push({ type: 'go' }); }
    return events;
  }
  if (state.phase === 'matchover') return events;

  state.players.forEach((p, idx) => {
    const inp = inputs[idx] || {};
    decayTimers(p);
    if (p.fireCd > 0) p.fireCd -= DT;
    if (p.dashCd > 0) p.dashCd -= DT;

    if (!p.alive) {
      p.respawnTimer -= DT;
      if (p.respawnTimer <= 0) {
        const s = DUEL_SPAWNS[idx];
        p.x = s.x; p.y = s.y; p.angle = s.angle; p.hp = DUEL_CFG.maxHealth;
        p.alive = true; p.loadout = makeLoadout(); p.weapon = 0;
      }
      return;
    }

    // Weapon switch (bounded).
    if (typeof inp.weapon === 'number' && inp.weapon >= 0 && inp.weapon < WEAPONS.length) p.weapon = inp.weapon;

    movePlayer(p, inp);

    // Reload handling.
    const w = WEAPONS[p.weapon];
    const ld = p.loadout[p.weapon];
    if (p.reloadTimer > 0) {
      p.reloadTimer -= DT;
      if (p.reloadTimer <= 0 && ld.reserve !== Infinity) {
        const take = Math.min(w.magSize - ld.ammo, ld.reserve);
        ld.ammo += take; ld.reserve -= take;
      }
    }

    // Fire: auto weapons repeat while held; semi requires a release between shots.
    const wantFire = !!inp.fire;
    if (wantFire && p.fireCd <= 0 && p.reloadTimer <= 0 && (w.auto || !p.firedHeld)) {
      if (ld.ammo === Infinity || ld.ammo > 0) fireWeapon(state, idx, events);
      else if (ld.reserve !== Infinity && ld.reserve > 0) p.reloadTimer = w.reload;
    }
    p.firedHeld = wantFire;
    // Auto-reload when dry.
    if (ld.ammo === 0 && p.reloadTimer <= 0 && ld.reserve > 0) p.reloadTimer = w.reload;
  });

  stepProjectiles(state, events);
  return events;
}

function decayTimers(p) {
  if (p.hitFlash > 0) p.hitFlash -= DT;
  if (p.dmgTimer > 0) p.dmgTimer -= DT;
  if (p.flashTimer > 0) p.flashTimer -= DT;
  if (p.hitMarker > 0) p.hitMarker -= DT;
}

// Quantised state fingerprint for the desync / tamper check (net/anticheat.js).
// Positions to 1/64 cell, angles to 1/256 turn, plus hp/score/ammo/tick.
export function hashState(state) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h ^= v & 0xffffffff; h = Math.imul(h, 16777619) >>> 0; };
  mix(state.tick);
  mix(state.phase === 'live' ? 1 : state.phase === 'countdown' ? 2 : 3);
  for (const p of state.players) {
    mix(Math.round(p.x * 64));
    mix(Math.round(p.y * 64));
    mix(Math.round(((p.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 256));
    mix(Math.round(p.hp));
    mix(p.score);
    mix(p.alive ? 1 : 0);
    mix(p.weapon);
    mix(p.loadout[p.weapon].ammo === Infinity ? 999 : p.loadout[p.weapon].ammo);
  }
  mix(state.projectiles.length);
  return h >>> 0;
}

export { WEAPONS, map as duelMap };
