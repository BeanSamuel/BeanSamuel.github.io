import { SW, SH, FOV, MAX_DEPTH, WALL_COLORS, WALL_RGB } from './geometry';

// Camera basis for a player at a given position/angle: view direction plus the
// perpendicular camera plane scaled to the FOV. Shared by wall casting and
// sprite projection so both agree on where things land on screen.
export function makeCamera(player) {
  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const planeLen = Math.tan(FOV / 2);
  const planeX = -dirY * planeLen;
  const planeY = dirX * planeLen;
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  return { x: player.x, y: player.y, dirX, dirY, planeX, planeY, invDet };
}

export function clearScreen(ctx) {
  ctx.fillStyle = '#0b0c10';
  ctx.fillRect(0, 0, SW, SH);
}

// Ceiling + floor + walls. Returns the per-column depth buffer so callers can
// occlude sprites against it.
export function renderWorld(ctx, map, cam) {
  const cg = ctx.createLinearGradient(0, 0, 0, SH / 2);
  cg.addColorStop(0, '#050810'); cg.addColorStop(1, '#0a1020');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, SW, SH / 2);

  const fg = ctx.createLinearGradient(0, SH / 2, 0, SH);
  fg.addColorStop(0, '#0a1020'); fg.addColorStop(1, '#050408');
  ctx.fillStyle = fg; ctx.fillRect(0, SH / 2, SW, SH / 2);

  const zBuf = new Float32Array(SW);
  for (let x = 0; x < SW; x++) {
    const cameraX = (2 * x) / SW - 1;
    const rdx = cam.dirX + cam.planeX * cameraX;
    const rdy = cam.dirY + cam.planeY * cameraX;
    const { dist, side, wallType } = map.castRay(cam.x, cam.y, rdx, rdy);
    zBuf[x] = dist;

    const wh = Math.min(SH * 4, SH / dist);
    const wt = (SH - wh) / 2;
    const fog = Math.max(0.05, 1 - dist / MAX_DEPTH);
    const [r, gv, b] = (WALL_RGB[wallType] || WALL_RGB[1])[side === 0 ? 0 : 1];
    ctx.fillStyle = `rgba(${r},${gv},${b},${fog})`;
    ctx.fillRect(x, wt, 1, wh);
  }
  return zBuf;
}

// Project a world point into camera space. tx is horizontal offset, ty is depth
// (matches the zBuf). Returns null when behind the camera.
export function projectPoint(cam, wx, wy) {
  const rx = wx - cam.x;
  const ry = wy - cam.y;
  const tx = cam.invDet * (cam.dirY * rx - cam.dirX * ry);
  const ty = cam.invDet * (-cam.planeY * rx + cam.planeX * ry);
  if (ty <= 0.2 || ty >= MAX_DEPTH) return null;
  const sx = (SW / 2) * (1 + tx / ty);
  return { sx, depth: ty };
}

/**
 * Clip a billboard sprite to only the columns where it is actually in front of
 * a wall, then invoke `draw` once with the clip applied. Mirrors the original
 * run-length column test so sprites don't pop at wall edges.
 */
export function drawClipped(ctx, zBuf, sx, half, depth, draw) {
  const x0 = Math.max(0, Math.floor(sx - half));
  const x1 = Math.min(SW - 1, Math.ceil(sx + half));
  if (x1 < x0) return;

  ctx.save();
  ctx.beginPath();
  let runStart = -1;
  let any = false;
  let x = x0;
  for (; x <= x1; x++) {
    const vis = zBuf[x] > depth;
    if (vis && runStart < 0) runStart = x;
    if (!vis && runStart >= 0) { ctx.rect(runStart, 0, x - runStart, SH); any = true; runStart = -1; }
  }
  if (runStart >= 0) { ctx.rect(runStart, 0, x1 - runStart + 1, SH); any = true; }
  if (!any) { ctx.restore(); return; }
  ctx.clip();
  draw();
  ctx.restore();
}

// A red diamond figure — the survival enemy and the duel opponent share it.
export function drawFighter(ctx, sx, size, depth, { hurt = false, color = '255,42,109', glow = '#ff2a6d', hp = 1, maxHp = 1 } = {}) {
  const top = (SH - size) / 2;
  const half = size * 0.38;
  const fog = Math.max(0.12, 1 - depth / 12);
  const midY = top + size * 0.5;
  const body = hurt ? '255,255,255' : color;

  ctx.shadowBlur = 20 * fog;
  ctx.shadowColor = hurt ? '#fff' : glow;
  ctx.fillStyle = `rgba(${body},${fog})`;
  ctx.beginPath();
  ctx.moveTo(sx, midY - half);
  ctx.lineTo(sx + half * 0.55, midY);
  ctx.lineTo(sx, midY + half);
  ctx.lineTo(sx - half * 0.55, midY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(255,255,255,${fog})`;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#fff';
  ctx.beginPath();
  ctx.arc(sx, midY - half * 0.28, half * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (maxHp > 1 && hp < maxHp) {
    const bw = half * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(sx - bw / 2, midY - half * 1.25, bw, 4);
    ctx.fillStyle = glow;
    ctx.fillRect(sx - bw / 2, midY - half * 1.25, (bw * hp) / maxHp, 4);
  }
}

// A glowing orb — aim-trainer target.
export function drawOrb(ctx, sx, size, depth, color = '#45f3ff') {
  const r = Math.max(3, size * 0.22);
  const fog = Math.max(0.2, 1 - depth / 14);
  ctx.globalAlpha = fog;
  ctx.shadowBlur = 24;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, SH / 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(sx, SH / 2, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export function drawCrosshair(ctx, color, hitMarker = 0) {
  const cx = SW / 2, cy = SH / 2;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.shadowBlur = 8; ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy);
  ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 14);
  ctx.stroke();
  if (hitMarker > 0) {
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx - 4, cy - 4);
    ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx + 4, cy - 4);
    ctx.moveTo(cx - 9, cy + 9); ctx.lineTo(cx - 4, cy + 4);
    ctx.moveTo(cx + 9, cy + 9); ctx.lineTo(cx + 4, cy + 4);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

export function drawMuzzle(ctx, flashTimer) {
  if (flashTimer <= 0) return;
  const alpha = Math.min(1, flashTimer / 0.1);
  ctx.fillStyle = `rgba(255,200,60,${alpha * 0.7})`;
  ctx.shadowBlur = 60; ctx.shadowColor = '#ffcc33';
  ctx.beginPath();
  ctx.arc(SW / 2, SH - 50, 18 + alpha * 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

export function drawVignette(ctx, dmgTimer) {
  if (dmgTimer <= 0) return;
  const alpha = Math.min(0.75, dmgTimer / 0.4);
  const rg = ctx.createRadialGradient(SW / 2, SH / 2, SH * 0.2, SW / 2, SH / 2, SH * 0.8);
  rg.addColorStop(0, 'rgba(255,0,0,0)');
  rg.addColorStop(1, `rgba(255,0,0,${alpha})`);
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, SW, SH);
}

export function drawMinimap(ctx, map, player, marks = []) {
  const MM = 8;
  const mmX = SW - map.w * MM - 10;
  const mmY = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(mmX - 2, mmY - 2, map.w * MM + 4, map.h * MM + 4);
  for (let row = 0; row < map.h; row++) {
    for (let col = 0; col < map.w; col++) {
      const t = map.grid[row][col];
      if (t > 0) {
        ctx.fillStyle = (WALL_COLORS[t] || WALL_COLORS[1])[0];
        ctx.globalAlpha = 0.65;
        ctx.fillRect(mmX + col * MM, mmY + row * MM, MM - 1, MM - 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  marks.forEach((m) => {
    ctx.fillStyle = m.color; ctx.shadowBlur = 4; ctx.shadowColor = m.color;
    ctx.beginPath();
    ctx.arc(mmX + m.x * MM, mmY + m.y * MM, 2.5, 0, Math.PI * 2);
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
  ctx.lineTo(pmx + Math.cos(player.angle) * 9, pmy + Math.sin(player.angle) * 9);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function drawHpBar(ctx, health, maxHealth) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(10, SH - 50, 180, 28);
  const hpFrac = Math.max(0, health / maxHealth);
  ctx.fillStyle = hpFrac > 0.5 ? '#27c93f' : hpFrac > 0.25 ? '#ffbd2e' : '#ff5f56';
  ctx.fillRect(12, SH - 48, hpFrac * 176, 24);
  ctx.strokeStyle = 'rgba(69,243,255,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(10, SH - 50, 180, 28);
  ctx.fillStyle = '#fff'; ctx.font = '11px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
  ctx.fillText(`HP ${Math.max(0, Math.round(health))}`, 100, SH - 31);
}

export function drawAmmo(ctx, ammo, reserve, reloading, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(SW - 150, SH - 50, 140, 28);
  ctx.fillStyle = reloading ? '#ffbd2e' : ammo === 0 ? '#ff5f56' : '#45f3ff';
  ctx.font = '12px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
  const text = reloading ? 'RELOADING' : `${label} ${ammo}/${reserve}`;
  ctx.fillText(text, SW - 80, SH - 31);
}

export function drawBanner(ctx, banner) {
  if (!banner || banner.timer <= 0) return;
  const a = Math.min(1, banner.timer / 0.5);
  ctx.textAlign = 'center';
  ctx.shadowBlur = 20; ctx.shadowColor = banner.color || '#45f3ff';
  ctx.fillStyle = `rgba(${banner.rgb || '69,243,255'},${a})`;
  ctx.font = 'bold 34px "JetBrains Mono",monospace';
  ctx.fillText(banner.text, SW / 2, 80);
  ctx.shadowBlur = 0;
}

export function drawTitle(ctx, title, subtitle) {
  clearScreen(ctx);
  ctx.textAlign = 'center';
  ctx.shadowBlur = 30;
  ctx.shadowColor = '#45f3ff';
  ctx.fillStyle = '#45f3ff';
  ctx.font = 'bold 52px "JetBrains Mono", monospace';
  ctx.fillText(title, SW / 2, SH / 2 - 40);
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff2a6d';
  ctx.fillStyle = '#ff2a6d';
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, SW / 2, SH / 2 + 20);
  ctx.shadowBlur = 0;
}

export function drawEndOverlay(ctx, { title, titleColor, lines = [] }) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, SW, SH);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor; ctx.shadowBlur = 30; ctx.shadowColor = titleColor;
  ctx.font = 'bold 48px "JetBrains Mono",monospace';
  ctx.fillText(title, SW / 2, SH / 2 - 30);
  ctx.shadowBlur = 12; ctx.shadowColor = '#45f3ff';
  ctx.fillStyle = '#45f3ff'; ctx.font = '20px "JetBrains Mono",monospace';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#45f3ff' : 'rgba(197,198,199,0.85)';
    ctx.font = i === 0 ? '22px "JetBrains Mono",monospace' : '13px "JetBrains Mono",monospace';
    ctx.fillText(line, SW / 2, SH / 2 + 20 + i * 28);
  });
  ctx.shadowBlur = 0;
}

export { SW, SH };
