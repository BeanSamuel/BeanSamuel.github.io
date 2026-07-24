// Shared raycasting geometry, lifted verbatim from the original single-file
// FPSGame and parameterised by a `map` object so every mode (survival, aim,
// duel) can pick its own layout instead of the one hard-coded global.

// Screen / projection constants — shared by every mode's renderer.
export const SW = 640;
export const SH = 360;
export const FOV = Math.PI / 3;
export const MAX_DEPTH = 18;

// 0=empty, 1=cyan wall, 2=red wall, 3=yellow wall
export const WALL_COLORS = {
  1: ['#45f3ff', '#1a5f6a'],
  2: ['#ff2a6d', '#7a1535'],
  3: ['#ffbb00', '#7a5800'],
};

function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Pre-parsed once: hexToRgb ran 640x per frame in the old version.
export const WALL_RGB = Object.fromEntries(
  Object.entries(WALL_COLORS).map(([k, [light, dark]]) => [k, [rgb(light), rgb(dark)]])
);

export const normAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

/**
 * Wraps a 2D grid into a map object with cached dimensions, open-cell list and
 * bound geometry helpers, so the maths no longer reads a module-global.
 */
export function makeMap(grid) {
  const h = grid.length;
  const w = grid[0].length;

  const openCells = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === 0) openCells.push({ x: x + 0.5, y: y + 0.5 });
    }
  }

  // Out-of-bounds counts as solid, matching the original border behaviour.
  const isWall = (x, y) => {
    const mx = Math.floor(x);
    const my = Math.floor(y);
    if (mx < 0 || mx >= w || my < 0 || my >= h) return true;
    return grid[my][mx] > 0;
  };

  // Body is a box, not a point, so you cannot stand inside a wall face.
  const canStand = (x, y, r) =>
    !isWall(x - r, y - r) && !isWall(x + r, y - r) &&
    !isWall(x - r, y + r) && !isWall(x + r, y + r);

  // Axis-separated so sliding along a wall works instead of sticking.
  const moveWithSlide = (ent, dx, dy, r) => {
    if (canStand(ent.x + dx, ent.y, r)) ent.x += dx;
    if (canStand(ent.x, ent.y + dy, r)) ent.y += dy;
  };

  // Walls are a full cell thick, so a 0.15 step cannot tunnel through one.
  const hasLOS = (ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 0.15);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(ax + dx * t, ay + dy * t)) return false;
    }
    return true;
  };

  /**
   * BFS step-count field from a source cell to every reachable cell. Enemies /
   * bots walk downhill on it to route around corners. Recompute only when the
   * target crosses a cell boundary.
   */
  const computeFlow = (px, py) => {
    const field = new Int16Array(w * h).fill(-1);
    const sx = Math.floor(px);
    const sy = Math.floor(py);
    if (isWall(px, py)) return field;

    const queue = [sy * w + sx];
    field[sy * w + sx] = 0;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const cx = cur % w;
      const cy = (cur - cx) / w;
      const d = field[cur];
      const neighbours = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const idx = ny * w + nx;
        if (field[idx] !== -1 || grid[ny][nx] > 0) continue;
        field[idx] = d + 1;
        queue.push(idx);
      }
    }
    return field;
  };

  /**
   * DDA against the grid using a raw (non-normalised) ray direction, so
   * `sideDist - deltaDist` is the *perpendicular* distance (no fisheye).
   */
  const castRay = (px, py, rdx, rdy) => {
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
      if (mx < 0 || mx >= w || my < 0 || my >= h) break;
      if (grid[my][mx] > 0) { wallType = grid[my][mx]; break; }
    }

    const perp = side === 0 ? sdx - ddx : sdy - ddy;
    return { dist: Math.max(0.05, perp), side, wallType };
  };

  // Downhill neighbour on a flow field — the shared "walk toward source" step.
  const flowStep = (field, ex, ey) => {
    const ecx = Math.floor(ex);
    const ecy = Math.floor(ey);
    const here = field[ecy * w + ecx];
    if (here <= 0) return null;
    let bestD = here;
    let tx = null;
    let ty = null;
    const neighbours = [[ecx + 1, ecy], [ecx - 1, ecy], [ecx, ecy + 1], [ecx, ecy - 1]];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const d = field[ny * w + nx];
      if (d >= 0 && d < bestD) { bestD = d; tx = nx + 0.5; ty = ny + 0.5; }
    }
    return tx === null ? null : { x: tx, y: ty };
  };

  return {
    grid, w, h, openCells,
    isWall, canStand, moveWithSlide, hasLOS, computeFlow, castRay, flowStep,
  };
}
