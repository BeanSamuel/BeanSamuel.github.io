import { useRef, useEffect, useState, useCallback } from 'react';
import SectionViewer from '../components/SectionViewer';

// 0=empty, 1=cyan wall, 2=red wall, 3=yellow wall
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,2,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,2,0,0,0,0,0,3,0,0,0,1],
  [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,2,2,2,0,1],
  [1,0,3,0,0,0,0,0,0,0,0,0,0,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,3,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,2,2,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const MAP_H = MAP.length;
const MAP_W = MAP[0].length;
const SW = 640;
const SH = 360;
const FOV = Math.PI / 3;
const MAX_DEPTH = 18;

// Everything in world units per second, so behaviour is identical at any
// refresh rate.
const CFG = {
  moveSpeed: 3.1,
  strafeSpeed: 2.5,
  turnSpeed: 2.7,        // rad/s for arrow keys
  mouseSens: 0.0025,     // rad per pixel of mouse movement
  playerRadius: 0.22,
  enemyRadius: 0.28,
  magSize: 12,
  reserveStart: 36,
  reloadTime: 1.1,
  fireCooldown: 0.16,
  maxHealth: 100,
  aggroRange: 10,
  attackRange: 8,
  enemyStopRange: 2.2,   // back off so they don't pile onto the player
};

// Each wave scales pressure rather than just count, so later waves feel
// different instead of merely longer.
// Wave 1 is deliberately gentle: it is the first thing a visitor meets, and
// four enemies converging at full rate can strip 80 HP before you get your
// bearings. Waves 2-3 are where it bites.
const WAVES = [
  { count: 4, speed: 1.05, damage: 6,  fireCooldown: 2.0, hp: 1 },
  { count: 6, speed: 1.35, damage: 9,  fireCooldown: 1.35, hp: 2 },
  { count: 8, speed: 1.65, damage: 11, fireCooldown: 1.05, hp: 2 },
];

const WALL_COLORS = {
  1: ['#45f3ff', '#1a5f6a'],
  2: ['#ff2a6d', '#7a1535'],
  3: ['#ffbb00', '#7a5800'],
};

// Pre-parsed once: hexToRgb ran 640x per frame in the old version.
const WALL_RGB = Object.fromEntries(
  Object.entries(WALL_COLORS).map(([k, [light, dark]]) => [k, [rgb(light), rgb(dark)]])
);
function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const OPEN_CELLS = [];
for (let y = 0; y < MAP_H; y++) {
  for (let x = 0; x < MAP_W; x++) {
    if (MAP[y][x] === 0) OPEN_CELLS.push({ x: x + 0.5, y: y + 0.5 });
  }
}

const isWall = (x, y) => {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  // Treat out-of-bounds as solid; the old code indexed MAP[y][x] unguarded
  // and would have thrown if anything ever escaped the border.
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return true;
  return MAP[my][mx] > 0;
};

// Body is a box, not a point, so you can no longer stand inside a wall face.
const canStand = (x, y, r) =>
  !isWall(x - r, y - r) && !isWall(x + r, y - r) &&
  !isWall(x - r, y + r) && !isWall(x + r, y + r);

// Axis-separated so sliding along a wall works instead of sticking.
function moveWithSlide(ent, dx, dy, r) {
  if (canStand(ent.x + dx, ent.y, r)) ent.x += dx;
  if (canStand(ent.x, ent.y + dy, r)) ent.y += dy;
}

// Walls are a full cell thick, so a 0.15 step cannot tunnel through one.
function hasLOS(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 0.15);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(ax + dx * t, ay + dy * t)) return false;
  }
  return true;
}

const normAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

/**
 * BFS step-count from the player's cell to every reachable cell. Enemies walk
 * downhill on it, which is what lets them come around corners: line-of-sight
 * chasing alone left them frozen whenever a wall was in the way, and greedy
 * "walk straight at the player" just wedges them into walls. 256 cells, only
 * recomputed when the player crosses a cell boundary.
 */
function computeFlow(px, py) {
  const field = new Int16Array(MAP_W * MAP_H).fill(-1);
  const sx = Math.floor(px);
  const sy = Math.floor(py);
  if (isWall(px, py)) return field;

  const queue = [sy * MAP_W + sx];
  field[sy * MAP_W + sx] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % MAP_W;
    const cy = (cur - cx) / MAP_W;
    const d = field[cur];
    const neighbours = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const idx = ny * MAP_W + nx;
      if (field[idx] !== -1 || MAP[ny][nx] > 0) continue;
      field[idx] = d + 1;
      queue.push(idx);
    }
  }
  return field;
}

/**
 * DDA against the grid using a raw (non-normalised) ray direction, which makes
 * `sideDist - deltaDist` the *perpendicular* distance to the wall. That is what
 * the projection needs: the old version swept angles and returned euclidean
 * distance, which bowed the walls outward at the screen edges (fisheye).
 */
function castRay(px, py, rdx, rdy) {
  let mx = Math.floor(px);
  let my = Math.floor(py);
  const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
  const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);

  let stepX, stepY, sdx, sdy;
  if (rdx < 0) { stepX = -1; sdx = (px - mx) * ddx; }
  else { stepX = 1; sdx = (mx + 1 - px) * ddx; }
  if (rdy < 0) { stepY = -1; sdy = (py - my) * ddy; }
  else { stepY = 1; sdy = (my + 1 - py) * ddy; }

  let side = 0;
  let wallType = 1;
  for (let i = 0; i < 128; i++) {
    if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; }
    else { sdy += ddy; my += stepY; side = 1; }
    if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) break;
    if (MAP[my][mx] > 0) { wallType = MAP[my][mx]; break; }
  }

  const perp = side === 0 ? sdx - ddx : sdy - ddy;
  return { dist: Math.max(0.05, perp), side, wallType };
}

const FPSGame = () => {
  const canvasRef = useRef(null);
  const gs = useRef(null);
  const rafRef = useRef(null);
  const keysRef = useRef({});
  const lastRef = useRef(0);

  const [hud, setHud] = useState({
    phase: 'idle', score: 0, health: CFG.maxHealth,
    ammo: CFG.magSize, reserve: CFG.reserveStart,
    kills: 0, wave: 0, waveTotal: 0, reloading: false, locked: false,
  });

  // Only re-render React when a displayed value actually changes. The old
  // version called setState every frame, re-rendering the component at 60fps.
  const syncHud = useCallback(() => {
    const g = gs.current;
    if (!g) return;
    const next = {
      phase: g.phase, score: g.score, health: Math.max(0, Math.round(g.health)),
      ammo: g.ammo, reserve: g.reserve, kills: g.kills,
      wave: g.wave, waveTotal: g.waveTotal,
      reloading: g.reloadTimer > 0, locked: g.locked,
    };
    setHud((prev) => {
      for (const k in next) if (prev[k] !== next[k]) return next;
      return prev;
    });
  }, []);

  const spawnWave = useCallback((g, waveIdx) => {
    const cfg = WAVES[waveIdx];
    const spots = OPEN_CELLS
      .filter((c) => Math.hypot(c.x - g.player.x, c.y - g.player.y) > 6)
      .sort(() => Math.random() - 0.5)
      .slice(0, cfg.count);

    g.enemies = spots.map((c, i) => ({
      id: `${waveIdx}-${i}`,
      x: c.x, y: c.y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      speed: cfg.speed,
      damage: cfg.damage,
      fireCooldown: cfg.fireCooldown,
      cd: 0.6 + Math.random() * cfg.fireCooldown, // stagger the first volley
      hitFlash: 0,
      lastSeen: null,
    }));
    g.wave = waveIdx + 1;
    g.waveTotal = cfg.count;
    g.banner = { text: `WAVE ${waveIdx + 1}`, timer: 1.6 };
  }, []);

  // --- Render ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const g = gs.current;

    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, SW, SH);

    if (!g || g.phase === 'idle') {
      ctx.textAlign = 'center';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = '#45f3ff';
      ctx.font = 'bold 52px "JetBrains Mono", monospace';
      ctx.fillText('CYBER.FPS', SW / 2, SH / 2 - 40);
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff2a6d';
      ctx.fillStyle = '#ff2a6d';
      ctx.font = '20px "JetBrains Mono", monospace';
      ctx.fillText('[ CLICK START TO PLAY ]', SW / 2, SH / 2 + 20);
      ctx.shadowBlur = 0;
      return;
    }

    const { player, enemies } = g;
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    // Camera plane, perpendicular to the view direction and scaled to the FOV.
    const planeLen = Math.tan(FOV / 2);
    const planeX = -dirY * planeLen;
    const planeY = dirX * planeLen;

    // Ceiling
    const cg = ctx.createLinearGradient(0, 0, 0, SH / 2);
    cg.addColorStop(0, '#050810'); cg.addColorStop(1, '#0a1020');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, SW, SH / 2);

    // Floor
    const fg = ctx.createLinearGradient(0, SH / 2, 0, SH);
    fg.addColorStop(0, '#0a1020'); fg.addColorStop(1, '#050408');
    ctx.fillStyle = fg; ctx.fillRect(0, SH / 2, SW, SH / 2);

    const zBuf = new Float32Array(SW);

    // Walls
    for (let x = 0; x < SW; x++) {
      const cameraX = (2 * x) / SW - 1;
      const rdx = dirX + planeX * cameraX;
      const rdy = dirY + planeY * cameraX;
      const { dist, side, wallType } = castRay(player.x, player.y, rdx, rdy);
      zBuf[x] = dist;

      const wh = Math.min(SH * 4, SH / dist);
      const wt = (SH - wh) / 2;
      const fog = Math.max(0.05, 1 - dist / MAX_DEPTH);
      const [r, gv, b] = (WALL_RGB[wallType] || WALL_RGB[1])[side === 0 ? 0 : 1];
      ctx.fillStyle = `rgba(${r},${gv},${b},${fog})`;
      ctx.fillRect(x, wt, 1, wh);
    }

    // Enemies, far to near
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const visible = enemies
      .map((en) => {
        const rx = en.x - player.x;
        const ry = en.y - player.y;
        const tx = invDet * (dirY * rx - dirX * ry);
        const ty = invDet * (-planeY * rx + planeX * ry); // depth, matches zBuf
        return { en, tx, ty };
      })
      .filter((s) => s.ty > 0.2 && s.ty < MAX_DEPTH)
      .sort((a, b) => b.ty - a.ty);

    visible.forEach(({ en, tx, ty }) => {
      const sx = (SW / 2) * (1 + tx / ty);
      const size = Math.abs(SH / ty);
      const top = (SH - size) / 2;
      const fog = Math.max(0.12, 1 - ty / 12);
      const half = size * 0.38;

      // Clip to only the columns where the sprite is actually in front of the
      // wall. The old code tested one centre column and drew the whole sprite
      // or none of it, so enemies popped in and out at wall edges.
      const x0 = Math.max(0, Math.floor(sx - half));
      const x1 = Math.min(SW - 1, Math.ceil(sx + half));
      if (x1 < x0) return;

      ctx.save();
      ctx.beginPath();
      let runStart = -1;
      let any = false;
      for (let x = x0; x <= x1; x++) {
        const vis = zBuf[x] > ty;
        if (vis && runStart < 0) runStart = x;
        if (!vis && runStart >= 0) {
          ctx.rect(runStart, 0, x - runStart, SH);
          any = true;
          runStart = -1;
        }
      }
      if (runStart >= 0) { ctx.rect(runStart, 0, x1 - runStart + 1, SH); any = true; }
      if (!any) { ctx.restore(); return; }
      ctx.clip();

      const midY = top + size * 0.5;
      const hurt = en.hitFlash > 0;
      const body = hurt ? '255,255,255' : '255,42,109';
      ctx.shadowBlur = 20 * fog;
      ctx.shadowColor = hurt ? '#fff' : '#ff2a6d';
      ctx.fillStyle = `rgba(${body},${fog})`;
      ctx.beginPath();
      ctx.moveTo(sx, midY - half);
      ctx.lineTo(sx + half * 0.55, midY);
      ctx.lineTo(sx, midY + half);
      ctx.lineTo(sx - half * 0.55, midY);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = `rgba(255,255,255,${fog})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.arc(sx, midY - half * 0.28, half * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Health pip for multi-hit enemies, so damage reads as progress
      if (en.maxHp > 1 && en.hp < en.maxHp) {
        const bw = half * 0.9;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - bw / 2, midY - half * 1.25, bw, 4);
        ctx.fillStyle = '#ff2a6d';
        ctx.fillRect(sx - bw / 2, midY - half * 1.25, (bw * en.hp) / en.maxHp, 4);
      }
      ctx.restore();
    });

    ctx.shadowBlur = 0;

    // Crosshair — turns red while it cannot fire, white on a confirmed hit
    const cx2 = SW / 2, cy2 = SH / 2;
    const busy = g.shootCooldown > 0 || g.reloadTimer > 0 || g.ammo <= 0;
    const chColor = g.hitMarker > 0 ? '#ffffff' : busy ? '#ff2a6d' : '#45f3ff';
    ctx.strokeStyle = chColor; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8; ctx.shadowColor = chColor;
    ctx.beginPath();
    ctx.moveTo(cx2 - 14, cy2); ctx.lineTo(cx2 - 5, cy2);
    ctx.moveTo(cx2 + 5, cy2); ctx.lineTo(cx2 + 14, cy2);
    ctx.moveTo(cx2, cy2 - 14); ctx.lineTo(cx2, cy2 - 5);
    ctx.moveTo(cx2, cy2 + 5); ctx.lineTo(cx2, cy2 + 14);
    ctx.stroke();
    if (g.hitMarker > 0) {
      ctx.beginPath();
      ctx.moveTo(cx2 - 9, cy2 - 9); ctx.lineTo(cx2 - 4, cy2 - 4);
      ctx.moveTo(cx2 + 9, cy2 - 9); ctx.lineTo(cx2 + 4, cy2 - 4);
      ctx.moveTo(cx2 - 9, cy2 + 9); ctx.lineTo(cx2 - 4, cy2 + 4);
      ctx.moveTo(cx2 + 9, cy2 + 9); ctx.lineTo(cx2 + 4, cy2 + 4);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Muzzle flash
    if (g.flashTimer > 0) {
      const alpha = Math.min(1, g.flashTimer / 0.1);
      ctx.fillStyle = `rgba(255,200,60,${alpha * 0.7})`;
      ctx.shadowBlur = 60; ctx.shadowColor = '#ffcc33';
      ctx.beginPath();
      ctx.arc(SW / 2, SH - 50, 18 + alpha * 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Damage vignette
    if (g.dmgTimer > 0) {
      const alpha = Math.min(0.75, g.dmgTimer / 0.4);
      const rg = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.2, SW / 2, SH / 2, SH * 0.8);
      rg.addColorStop(0, 'rgba(255,0,0,0)');
      rg.addColorStop(1, `rgba(255,0,0,${alpha})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, SW, SH);
    }

    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(10, SH - 50, 180, 28);
    const hpFrac = Math.max(0, g.health / CFG.maxHealth);
    ctx.fillStyle = hpFrac > 0.5 ? '#27c93f' : hpFrac > 0.25 ? '#ffbd2e' : '#ff5f56';
    ctx.fillRect(12, SH - 48, hpFrac * 176, 24);
    ctx.strokeStyle = 'rgba(69,243,255,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(10, SH - 50, 180, 28);
    ctx.fillStyle = '#fff'; ctx.font = '11px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText(`HP ${Math.max(0, Math.round(g.health))}`, 100, SH - 31);

    // Ammo
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(SW - 120, SH - 50, 110, 28);
    ctx.fillStyle = g.reloadTimer > 0 ? '#ffbd2e' : g.ammo === 0 ? '#ff5f56' : '#45f3ff';
    ctx.font = '13px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText(
      g.reloadTimer > 0 ? 'RELOADING' : `${g.ammo} / ${g.reserve}`,
      SW - 65, SH - 31
    );

    // Minimap
    const MM = 8;
    const mmX = SW - MAP_W * MM - 10;
    const mmY = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(mmX - 2, mmY - 2, MAP_W * MM + 4, MAP_H * MM + 4);
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const t = MAP[row][col];
        if (t > 0) {
          ctx.fillStyle = (WALL_COLORS[t] || WALL_COLORS[1])[0];
          ctx.globalAlpha = 0.65;
          ctx.fillRect(mmX + col * MM, mmY + row * MM, MM - 1, MM - 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    enemies.forEach((en) => {
      ctx.fillStyle = '#ff2a6d'; ctx.shadowBlur = 4; ctx.shadowColor = '#ff2a6d';
      ctx.beginPath();
      ctx.arc(mmX + en.x * MM, mmY + en.y * MM, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    const pmx = mmX + player.x * MM;
    const pmy = mmY + player.y * MM;
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 6; ctx.shadowColor = '#fff';
    ctx.beginPath(); ctx.arc(pmx, pmy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#45f3ff'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pmx, pmy);
    ctx.lineTo(pmx + dirX * 9, pmy + dirY * 9);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Wave banner
    if (g.banner && g.banner.timer > 0) {
      const a = Math.min(1, g.banner.timer / 0.5);
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20; ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = `rgba(69,243,255,${a})`;
      ctx.font = 'bold 34px "JetBrains Mono",monospace';
      ctx.fillText(g.banner.text, SW / 2, 80);
      ctx.shadowBlur = 0;
    }

    // Mouse-look hint
    if (g.phase === 'playing' && !g.locked && !g.touch) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(197,198,199,0.75)';
      ctx.font = '12px "JetBrains Mono",monospace';
      ctx.fillText('click to lock mouse look · esc to release', SW / 2, SH - 62);
    }

    // Overlays
    if (g.phase === 'gameover' || g.phase === 'won') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, SW, SH);
      ctx.textAlign = 'center';
      if (g.phase === 'gameover') {
        ctx.fillStyle = '#ff2a6d'; ctx.shadowBlur = 30; ctx.shadowColor = '#ff2a6d';
        ctx.font = 'bold 54px "JetBrains Mono",monospace';
        ctx.fillText('YOU DIED', SW / 2, SH / 2 - 30);
      } else {
        ctx.fillStyle = '#45f3ff'; ctx.shadowBlur = 30; ctx.shadowColor = '#45f3ff';
        ctx.font = 'bold 42px "JetBrains Mono",monospace';
        ctx.fillText('MISSION CLEAR', SW / 2, SH / 2 - 30);
      }
      ctx.shadowBlur = 12; ctx.shadowColor = '#45f3ff';
      ctx.fillStyle = '#45f3ff'; ctx.font = '22px "JetBrains Mono",monospace';
      ctx.fillText(`SCORE: ${g.score}`, SW / 2, SH / 2 + 20);
      ctx.fillStyle = 'rgba(197,198,199,0.8)'; ctx.font = '13px "JetBrains Mono",monospace';
      ctx.fillText(
        `wave ${g.wave}/${WAVES.length} · ${g.totalKills} eliminated`,
        SW / 2, SH / 2 + 50
      );
      ctx.shadowBlur = 0;
    }
  }, []);

  const reload = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') return;
    if (g.reloadTimer > 0 || g.ammo >= CFG.magSize || g.reserve <= 0) return;
    g.reloadTimer = CFG.reloadTime;
  }, []);

  const shoot = useCallback(() => {
    const g = gs.current;
    if (!g || g.phase !== 'playing' || g.reloadTimer > 0 || g.shootCooldown > 0) return;
    if (g.ammo <= 0) { reload(); return; } // dry fire auto-reloads instead of dead-ending

    g.ammo--;
    g.shots++;
    g.shootCooldown = CFG.fireCooldown;
    g.flashTimer = 0.1;

    const { player, enemies } = g;
    let best = null;
    let bestDist = Infinity;

    enemies.forEach((en) => {
      const dx = en.x - player.x;
      const dy = en.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 16) return;
      const ang = normAngle(Math.atan2(dy, dx) - player.angle);
      // Angular half-width of the body at this distance
      const hitCone = Math.atan2(CFG.enemyRadius, dist);
      if (Math.abs(ang) > hitCone) return;
      if (!hasLOS(player.x, player.y, en.x, en.y)) return; // no shooting through walls
      if (dist < bestDist) { bestDist = dist; best = en; }
    });

    if (best) {
      best.hp--;
      best.hitFlash = 0.12;
      g.hitMarker = 0.12;
      g.hits++;
      if (best.hp <= 0) {
        g.enemies = g.enemies.filter((e) => e !== best);
        g.kills++;
        g.totalKills++;
        g.score += Math.max(10, Math.ceil(120 / Math.max(1, bestDist)));
      }
    }
    syncHud();
  }, [syncHud, reload]);

  const step = useCallback((dt) => {
    const g = gs.current;
    const keys = keysRef.current;
    const { player } = g;

    // Timers
    if (g.shootCooldown > 0) g.shootCooldown -= dt;
    if (g.flashTimer > 0) g.flashTimer -= dt;
    if (g.dmgTimer > 0) g.dmgTimer -= dt;
    if (g.hitMarker > 0) g.hitMarker -= dt;
    if (g.banner && g.banner.timer > 0) g.banner.timer -= dt;

    if (g.reloadTimer > 0) {
      g.reloadTimer -= dt;
      if (g.reloadTimer <= 0) {
        const need = CFG.magSize - g.ammo;
        const take = Math.min(need, g.reserve);
        g.ammo += take;
        g.reserve -= take;
        g.reloadTimer = 0;
      }
    }

    // Turning
    if (keys.ArrowLeft) player.angle -= CFG.turnSpeed * dt;
    if (keys.ArrowRight) player.angle += CFG.turnSpeed * dt;
    if (g.mouseDX) { player.angle += g.mouseDX * CFG.mouseSens; g.mouseDX = 0; }

    const cosA = Math.cos(player.angle);
    const sinA = Math.sin(player.angle);

    // Build a movement vector first, then normalise: pressing W+A used to apply
    // two full-speed moves, making diagonals ~1.41x faster.
    let fwd = 0;
    let strafe = 0;
    if (keys.KeyW) fwd += 1;
    if (keys.KeyS) fwd -= 1;
    if (keys.KeyD) strafe += 1;
    if (keys.KeyA) strafe -= 1;

    if (fwd || strafe) {
      const len = Math.hypot(fwd, strafe);
      fwd /= len;
      strafe /= len;
      const dx = (cosA * fwd * CFG.moveSpeed - sinA * strafe * CFG.strafeSpeed) * dt;
      const dy = (sinA * fwd * CFG.moveSpeed + cosA * strafe * CFG.strafeSpeed) * dt;
      moveWithSlide(player, dx, dy, CFG.playerRadius);
    }

    // Refresh the pathfinding field only when the player changes cell.
    const pCell = Math.floor(player.y) * MAP_W + Math.floor(player.x);
    if (pCell !== g.flowCell) {
      g.flow = computeFlow(player.x, player.y);
      g.flowCell = pCell;
    }

    // Enemies
    g.enemies.forEach((en) => {
      if (en.hitFlash > 0) en.hitFlash -= dt;
      if (en.cd > 0) en.cd -= dt;

      const dx = player.x - en.x;
      const dy = player.y - en.y;
      const dist = Math.hypot(dx, dy);
      const los = dist < CFG.aggroRange && hasLOS(en.x, en.y, player.x, player.y);

      // With sight, walk straight at the player (smoother than grid steps).
      // Without it, follow the flow field downhill so walls are routed around.
      let tx = null, ty = null;
      if (dist > CFG.enemyStopRange) {
        if (los) {
          tx = player.x; ty = player.y;
        } else {
          const ecx = Math.floor(en.x);
          const ecy = Math.floor(en.y);
          const here = g.flow[ecy * MAP_W + ecx];
          if (here > 0) {
            let bestD = here;
            const neighbours = [[ecx + 1, ecy], [ecx - 1, ecy], [ecx, ecy + 1], [ecx, ecy - 1]];
            for (const [nx, ny] of neighbours) {
              if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
              const d = g.flow[ny * MAP_W + nx];
              if (d >= 0 && d < bestD) { bestD = d; tx = nx + 0.5; ty = ny + 0.5; }
            }
          }
        }
      }

      if (tx !== null) {
        const len = Math.hypot(tx - en.x, ty - en.y) || 1;
        moveWithSlide(
          en,
          ((tx - en.x) / len) * en.speed * dt,
          ((ty - en.y) / len) * en.speed * dt,
          CFG.enemyRadius
        );
      }

      if (los && dist < CFG.attackRange && en.cd <= 0) {
        en.cd = en.fireCooldown;
        // Closer shots land more often, so backing off is a real option.
        const hitChance = 0.75 - Math.min(0.45, (dist / CFG.attackRange) * 0.45);
        if (Math.random() < hitChance) {
          g.health -= en.damage;
          g.dmgTimer = 0.4;
          if (g.health <= 0) {
            g.health = 0;
            g.phase = 'gameover';
          }
        }
      }
    });

    // Wave progression
    if (g.phase === 'playing' && g.enemies.length === 0) {
      if (g.wave >= WAVES.length) {
        g.phase = 'won';
        g.score += Math.round(g.health * 2); // reward finishing healthy
      } else {
        // Breather between waves: patch up and restock, scaled so later waves
        // stay tense rather than turning into a stalemate.
        g.health = Math.min(CFG.maxHealth, g.health + 25);
        g.reserve = CFG.reserveStart;
        g.ammo = CFG.magSize;
        g.score += 150;
        spawnWave(g, g.wave);
      }
    }
  }, [spawnWave]);

  const loop = useCallback((now) => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') return;

    // Clamped so a backgrounded tab doesn't resume with one enormous step that
    // teleports everything through walls.
    const dt = Math.min(0.05, (now - lastRef.current) / 1000) || 0;
    lastRef.current = now;

    step(dt);
    render();
    syncHud();

    if (g.phase === 'playing') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      // Clear transient effects first, or the end screen freezes with a red
      // damage vignette and a half-faded muzzle flash burnt into it.
      g.flashTimer = 0;
      g.dmgTimer = 0;
      g.hitMarker = 0;
      g.banner = null;
      render(); // draw the end overlay on the frame we stopped
      syncHud();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [step, render, syncHud]);

  const startGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    keysRef.current = {};
    gs.current = {
      phase: 'playing',
      player: { x: 1.5, y: 1.5, angle: 0 },
      enemies: [],
      score: 0, health: CFG.maxHealth,
      ammo: CFG.magSize, reserve: CFG.reserveStart,
      kills: 0, totalKills: 0, shots: 0, hits: 0,
      wave: 0, waveTotal: 0,
      shootCooldown: 0, flashTimer: 0, dmgTimer: 0, hitMarker: 0, reloadTimer: 0,
      mouseDX: 0, locked: false, touch: false,
      flow: computeFlow(1.5, 1.5), flowCell: -1,
      banner: null,
    };
    spawnWave(gs.current, 0);
    syncHud();
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, syncHud, spawnWave]);

  // --- Keyboard ---
  useEffect(() => {
    // Keyed by e.code, not e.key: with e.key, pressing Shift+W then releasing
    // Shift first left keys['W'] stuck true and the player walked forever.
    const onDown = (e) => {
      const playing = gs.current?.phase === 'playing';
      keysRef.current[e.code] = true;
      if (!playing) return;
      if (e.code === 'Space') { e.preventDefault(); shoot(); }
      if (e.code === 'KeyR') { e.preventDefault(); reload(); }
      // Only swallow the page's arrow-key scrolling while actually playing.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    const onUp = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [shoot, reload]);

  // --- Mouse look ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const onMove = (e) => {
      const g = gs.current;
      if (g && g.locked && g.phase === 'playing') g.mouseDX += e.movementX;
    };
    const onLockChange = () => {
      const g = gs.current;
      if (g) g.locked = document.pointerLockElement === canvas;
      syncHud();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [syncHud]);

  // --- Mount / unmount ---
  useEffect(() => {
    render();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [render]);

  const onCanvasPointerDown = (e) => {
    const g = gs.current;
    if (!g || g.phase !== 'playing') { startGame(); return; }
    if (e.pointerType === 'touch') { g.touch = true; shoot(); return; }
    const canvas = canvasRef.current;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock();
      return;
    }
    shoot();
  };

  const holdKey = (code) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      if (gs.current) gs.current.touch = true;
      keysRef.current[code] = true;
    },
    onPointerUp: () => { keysRef.current[code] = false; },
    onPointerLeave: () => { keysRef.current[code] = false; },
    onPointerCancel: () => { keysRef.current[code] = false; },
  });

  const { phase, score, health, ammo, reserve, kills, wave, waveTotal, reloading } = hud;
  const phaseColor =
    phase === 'playing' ? 'var(--accent-primary)'
      : phase === 'gameover' ? 'var(--accent-secondary)'
        : phase === 'won' ? '#27c93f'
          : 'var(--text-dim)';

  return (
    <div>
      <SectionViewer title="Cyber FPS">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
          <span><span style={{ color: 'var(--text-dim)' }}>HP </span><span style={{ color: health > 50 ? '#27c93f' : health > 25 ? '#ffbd2e' : '#ff5f56' }}>{health}</span></span>
          <span>
            <span style={{ color: 'var(--text-dim)' }}>AMMO </span>
            <span style={{ color: reloading ? '#ffbd2e' : 'var(--accent-primary)' }}>
              {reloading ? '--' : ammo}
            </span>
            <span style={{ color: 'var(--text-dim)' }}> / {reserve}</span>
          </span>
          <span><span style={{ color: 'var(--text-dim)' }}>WAVE </span><span style={{ color: 'var(--accent-primary)' }}>{wave}/{WAVES.length}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>LEFT </span><span style={{ color: 'var(--accent-secondary)' }}>{Math.max(0, waveTotal - kills)}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>SCORE </span><span style={{ color: '#ffbb00' }}>{score}</span></span>
          <span><span style={{ color: 'var(--text-dim)' }}>STATUS </span><span style={{ color: phaseColor }}>{phase.toUpperCase()}</span></span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <canvas
            ref={canvasRef}
            width={SW}
            height={SH}
            onPointerDown={onCanvasPointerDown}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              maxWidth: '100%',
              display: 'block',
              margin: '0 auto',
              cursor: 'crosshair',
              touchAction: 'none',
            }}
          />
        </div>

        {phase !== 'playing' && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button onClick={startGame} className="cyber-btn" style={{ fontSize: '0.95rem', padding: '0.75rem 2rem' }}>
              {phase === 'idle' ? '[ START GAME ]' : '[ PLAY AGAIN ]'}
            </button>
          </div>
        )}

        {/* Touch controls — the game was keyboard-only, so phones could not play it */}
        {phase === 'playing' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 46px)', gridTemplateRows: 'repeat(2, 46px)', gap: '4px' }}>
              <button {...holdKey('KeyA')} style={padStyle}>◄</button>
              <button {...holdKey('KeyW')} style={padStyle}>▲</button>
              <button {...holdKey('KeyD')} style={padStyle}>►</button>
              <button {...holdKey('ArrowLeft')} style={padStyle}>↺</button>
              <button {...holdKey('KeyS')} style={padStyle}>▼</button>
              <button {...holdKey('ArrowRight')} style={padStyle}>↻</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
              <button onPointerDown={(e) => { e.preventDefault(); shoot(); }} style={{ ...padStyle, width: '92px', color: 'var(--accent-secondary)' }}>FIRE</button>
              <button onPointerDown={(e) => { e.preventDefault(); reload(); }} style={{ ...padStyle, width: '92px' }}>RELOAD</button>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginTop: '1.2rem' }}>
          [ W/A/S/D ] Move &nbsp;·&nbsp; [ Mouse / ←→ ] Look &nbsp;·&nbsp; [ Click / SPACE ] Shoot &nbsp;·&nbsp; [ R ] Reload
        </p>
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
          Survive <span style={{ color: 'var(--accent-primary)' }}>{WAVES.length}</span> waves · they shoot back, and they hunt you around corners
        </p>
      </SectionViewer>
    </div>
  );
};

const padStyle = {
  height: '46px',
  background: 'var(--accent-soft)',
  border: '1px solid var(--border-strong)',
  color: 'var(--accent-primary)',
  fontSize: '0.9rem',
  cursor: 'pointer',
  borderRadius: '4px',
  fontFamily: 'var(--font-mono)',
  transition: 'all 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'none',
  userSelect: 'none',
};

export default FPSGame;
