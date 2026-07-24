// Data-driven weapon table. `kind: 'hitscan'` resolves instantly along the aim
// ray; `kind: 'projectile'` spawns a travelling shell that explodes on impact
// (handled in sim/duelSim.js). All numbers are deterministic — any spread is
// drawn from the shared seeded rng, never Math.random.

export const WEAPONS = [
  {
    id: 'ar', key: '1', name: 'AR', label: 'ASSAULT',
    kind: 'hitscan', auto: true,
    damage: 22, spread: 0.045, range: 16,
    fireCooldown: 0.11, magSize: 30, reserve: 90, reload: 1.6,
  },
  {
    id: 'hg', key: '2', name: 'HG', label: 'HANDGUN',
    kind: 'hitscan', auto: false,
    damage: 34, spread: 0.012, range: 16,
    fireCooldown: 0.26, magSize: 12, reserve: 48, reload: 1.1,
  },
  {
    id: 'fist', key: '3', name: 'FIST', label: 'FISTS',
    kind: 'hitscan', auto: false,
    damage: 55, spread: 0, range: 1.6,
    fireCooldown: 0.4, magSize: Infinity, reserve: Infinity, reload: 0,
  },
  {
    id: 'nade', key: '4', name: 'NADE', label: 'GRENADE',
    kind: 'projectile', auto: false,
    damage: 80, aoe: 2.6, speed: 7, fuse: 1.4, gravityless: true,
    fireCooldown: 0.9, magSize: 2, reserve: 4, reload: 1.8,
  },
  {
    id: 'rpg', key: '5', name: 'RPG', label: 'RPG',
    kind: 'projectile', auto: false,
    damage: 100, aoe: 3.0, speed: 9, fuse: 3.0,
    fireCooldown: 1.2, magSize: 1, reserve: 3, reload: 2.2,
  },
];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// Fresh per-weapon ammo state for a loadout (used at spawn / round reset).
export function makeLoadout() {
  return WEAPONS.map((w) => ({
    ammo: w.magSize === Infinity ? Infinity : w.magSize,
    reserve: w.reserve === Infinity ? Infinity : w.reserve,
  }));
}
