// The garden outside the hallway's door: where everything is, and the questions asked of it every
// frame (how high the ground is, where the viewer may walk, the way round the water, what a ray
// points at). Pure functions with no three.js, so the tests run them in Node.
//
// Coordinates: metres, y up. The building's wall is the plane z = 0, with the door in it at x = 0,
// and the garden runs along -z. Facing out of the door, left is -x. A yaw of 0 faces -z (out into
// the garden); positive yaws turn left. The threshold, and the ground in front of the door, are at
// y = 0. Something placed with { x, z, yaw } has its own frame: r to its right, f in front of it.
//
// The water is one stream that comes in under the right-hand hedge, runs under the foot bridge,
// widens into the pond and leaves under the left-hand hedge, so it splits the garden in two: the
// near side, by the house, and the far side, with the bench. The bridge is the way between them.

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** 0 at a, 1 at b (either way round), smooth in between. @type {(a: number, b: number, v: number) => number} */
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** @type {(v: number, c: number, s: number) => number} */
const bump = (v, c, s) => Math.exp(-(((v - c) / s) ** 2));
/** @type {(v: number, k: number) => number} */
const softplus = (v, k) => (v / k > 30 ? v : k * Math.log1p(Math.exp(v / k)));

export const GARDEN = {
  x0: -9.5, // the hedges' faces
  x1: 9.5,
  z1: -17, // the face of the low wall at the far end
  margin: 0.3, // how near a hedge, the wall or the house the viewer's head comes
  eye: 1.6,
  far: 40, // how far a ray looks for the ground
};

/** The door back into the hallway, in the house's wall: the link's dw and dh, when it gives them, replace the size. */
export const DOOR = { width: 1.1, height: 2.25, reveal: 0.3, threshold: 0.06 };

/** The house's wall: how high it stands (to the top of its cornice) and its windows (centre x, width, sill, head). */
export const HOUSE = { height: 4.7, windows: [-6.9, -3.7, 3.7, 6.9], window: { width: 1.15, sill: 0.95, top: 2.75 } };

/** The plaque beside the door (its centre), and the control panel on the wall the other side. */
export const PLAQUE = { x: -1.32, y: 1.5, width: 0.6, height: 0.34 };
export const PANEL = { x: 1.6, y: 1.32, width: 0.56, height: 0.84, depth: 0.03 };

/**
 * The panel's canvas, and its buttons on it as [id, x0, y0, x1, y1] in canvas pixels (y down): the
 * hallway's VR, Move and Turn, then the accessibility settings (common/access.js: motion, the
 * vignette, seated), then the shared session.
 */
export const PANEL_PX = { width: 512, height: 768 };
/** @type {[string, number, number, number, number][]} */
export const PANEL_BUTTONS = [
  ['vr', 32, 74, 480, 136],
  ['move:teleport', 160, 160, 314, 218],
  ['move:smooth', 326, 160, 480, 218],
  ['turn:snap', 160, 236, 314, 294],
  ['turn:smooth', 326, 236, 480, 294],
  ['motion:system', 160, 352, 262, 410],
  ['motion:reduce', 270, 352, 372, 410],
  ['motion:full', 380, 352, 480, 410],
  ['vignette:on', 160, 428, 314, 486],
  ['vignette:off', 326, 428, 480, 486],
  ['seated:on', 160, 504, 314, 562],
  ['seated:off', 326, 504, 480, 562],
  ['session', 32, 652, 480, 706],
];

/**
 * The button at (u, v) on the panel (0…1 from its bottom left, as castRay reports), or null.
 * @param {number} u
 * @param {number} v
 */
export function panelButtonAt(u, v) {
  const x = u * PANEL_PX.width, y = (1 - v) * PANEL_PX.height;
  for (const b of PANEL_BUTTONS) {
    if (x >= b[1] && x <= b[3] && y >= b[2] && y <= b[4]) return b[0];
  }
  return null;
}

export const HEDGE = { height: 1.9, depth: 1.2 };
export const BACK_WALL = { height: 0.75, depth: 0.5 };

/**
 * The bench, on the far side of the pond, facing it and the house: its centre on the ground, its
 * length, seat height and depth, the top of its back. The visitor sits at SEAT (in its frame, the
 * eye that far above the seat) and the book lies beside them at BOOK.
 */
export const BENCH = { x: -3.4, z: -12.3, yaw: Math.PI, length: 1.64, seat: 0.46, depth: 0.62, back: 0.92 };
export const SEAT = { r: -0.32, f: 0.04, eye: 0.78 };
export const BOOK = { r: 0.4, f: 0.03, width: 0.15, length: 0.215, thickness: 0.035 };

/**
 * The foot bridge: along z at x, from its near end zA to its far end zB, its deck `width` wide and
 * rising `rise` in the middle, the planks `deck` thick; a head stays within `walk` of its middle
 * line between the rails, which run from `rails` to 1 − `rails` of its length.
 */
export const BRIDGE = { x: 1.8, zA: -4.75, zB: -7.75, width: 1.12, rise: 0.4, deck: 0.06, walk: 0.3, rails: 0.07 };

/** The foot trail: from the door, over the bridge, to the bench. Its control points; it is smoothed. */
export const TRAIL = [
  [0, 0.1], [0.1, -1.3], [0.55, -2.7], [1.35, -3.85], [1.8, -4.75],
  [1.8, -7.75], [1.5, -8.8], [0.6, -10.0], [-0.7, -11.05], [-1.9, -11.6], [-3.05, -11.75],
];
export const TRAIL_WIDTH = 1.0;

/**
 * The trees: trunk radius, height, the crown's middle and half sizes (an ellipsoid), and kind.
 * An oak stands behind the bench with its crown over it; the low sun comes in under it.
 */
export const TREES = [
  { kind: 'oak', x: -4.5, z: -14.4, trunk: 0.26, height: 7.8, crownY: 5.1, crown: [3.1, 2.6, 2.9] },
  { kind: 'oak', x: 7.3, z: -13.6, trunk: 0.3, height: 8.6, crownY: 5.7, crown: [3.3, 2.9, 3.2] },
  { kind: 'willow', x: -7.7, z: -12.4, trunk: 0.24, height: 6.4, crownY: 4.4, crown: [2.8, 2.3, 2.8] },
  { kind: 'birch', x: -8.2, z: -3.0, trunk: 0.13, height: 7.4, crownY: 5.2, crown: [1.5, 2.5, 1.5] },
  { kind: 'birch', x: -7.0, z: -1.8, trunk: 0.11, height: 6.2, crownY: 4.5, crown: [1.2, 2.0, 1.2] },
  { kind: 'blossom', x: 6.3, z: -3.3, trunk: 0.13, height: 4.2, crownY: 3.0, crown: [1.8, 1.4, 1.8] },
];

// ── The water ────────────────────────────────────────────────────────────────

/** The stream's middle line, (x, z) from left to right; between them it is a smooth curve. */
const STREAM = [
  [-13, -11.6], [-10.2, -10.6], [-7.6, -9.8], [-5.6, -8.9], [-4.0, -8.4], [-2.6, -7.8], [-0.6, -6.8],
  [1.8, -6.2], [3.8, -6.6], [6.5, -7.6], [10.2, -8.2], [13, -8.4],
];
const SLOPES = STREAM.map((_, i) => {
  const a = STREAM[Math.max(0, i - 1)], b = STREAM[Math.min(STREAM.length - 1, i + 1)];
  return (b[1] - a[1]) / (b[0] - a[0]);
});
export const STREAM_X = [STREAM[0][0], STREAM[STREAM.length - 1][0]];
/** The pond's water level; the stream comes down to it and goes on down from it. */
export const POND_LEVEL = -0.62;

/**
 * The stream's middle line at x: writes { z, dz } (dz its slope, dz/dx) into out.
 * @param {number} x
 */
export function streamAt(x, out = { z: 0, dz: 0 }) {
  const P = STREAM, n = P.length;
  x = clamp(x, P[0][0], P[n - 1][0]);
  let i = 0;
  while (i < n - 2 && P[i + 1][0] < x) i++;
  const h = P[i + 1][0] - P[i][0], t = (x - P[i][0]) / h;
  const za = P[i][1], zb = P[i + 1][1], ma = SLOPES[i] * h, mb = SLOPES[i + 1] * h;
  const t2 = t * t, t3 = t2 * t;
  out.z = (2 * t3 - 3 * t2 + 1) * za + (t3 - 2 * t2 + t) * ma + (-2 * t3 + 3 * t2) * zb + (t3 - t2) * mb;
  out.dz = ((6 * t2 - 6 * t) * za + (3 * t2 - 4 * t + 1) * ma + (-6 * t2 + 6 * t) * zb + (3 * t2 - 2 * t) * mb) / h;
  return out;
}

/**
 * How far the water reaches from the middle line toward the house (near) and away from it (far), at x.
 * @param {number} x
 */
export function nearWidth(x) {
  const pond = bump(x, -4.0, 1.9);
  return 0.56 + 0.06 * Math.sin(x * 2.3 + 1) + pond * (1.75 + 0.18 * Math.sin(x * 1.9 + 0.4));
}
/** @param {number} x */
export function farWidth(x) {
  const pond = bump(x, -4.3, 2.1);
  return 0.6 + 0.05 * Math.sin(x * 1.7 + 2) + pond * (2.0 + 0.2 * Math.sin(x * 2.6 + 1.3));
}
/**
 * The water's surface at x: level in the pond, rising upstream (+x), falling where it leaves (-x).
 * @param {number} x
 */
export function waterLevel(x) {
  return POND_LEVEL + 0.03 * softplus(x + 1.4, 0.6) - 0.03 * softplus(-6.6 - x, 0.6);
}
/**
 * How deep it is in the middle at x: a stream, and the pond deeper.
 * @param {number} x
 */
export function waterDepth(x) {
  return 0.26 + 0.5 * bump(x, -4.1, 1.8);
}

/** How far the water's surface runs on under the banks, past its edge (water.js). */
export const WATER_UNDER = 0.4;

const _s = { z: 0, dz: 0 };
/**
 * The water near (x, z): `across`, the distance from the stream's middle line (+ toward the house),
 * `width` its reach on that side, `shore` how far (x, z) is beyond the water's edge (- in the
 * water), its `level` and middle `depth` there. Writes into out.
 * @param {number} x
 * @param {number} z
 */
export function waterAt(x, z, out = { across: 0, width: 0, shore: 0, level: 0, depth: 0 }) {
  streamAt(x, _s);
  const across = (z - _s.z) / Math.sqrt(1 + _s.dz * _s.dz);
  out.across = across;
  out.width = across >= 0 ? nearWidth(x) : farWidth(x);
  out.shore = Math.abs(across) - out.width;
  out.level = waterLevel(x);
  out.depth = waterDepth(x);
  return out;
}

/**
 * Which side of the water (x, z) is on: 1 the house's, -1 the bench's.
 * @param {number} x
 * @param {number} z
 */
export function sideOf(x, z) {
  return waterAt(x, z, _w).across >= 0 ? 1 : -1;
}

// ── The ground ───────────────────────────────────────────────────────────────

/**
 * The lawn before the water is cut into it: falling from the house to the stream, rising to the far wall, a little rolling.
 * @param {number} x
 * @param {number} z
 */
function lawn(x, z) {
  const fall = -0.3 * smooth(-1.2, -5.6, z);
  const rise = 0.52 * smooth(-9, -17.5, z);
  const tilt = 0.024 * x;
  const roll = (0.07 * Math.sin(0.55 * x + 0.3) * Math.sin(0.47 * z + 1.1) + 0.04 * Math.sin(1.1 * x - 0.7 * z + 0.5)) * smooth(-1.0, -3.2, z);
  const away = -0.06 * softplus(-19.5 - z, 1.5); // the meadow beyond the far wall falls away
  return fall + rise + tilt + roll + away;
}

const _w = { across: 0, width: 0, shore: 0, level: 0, depth: 0 };
const BENCH_GROUND = lawn(BENCH.x, BENCH.z);

/**
 * The ground's height at (x, z), the stream's bed and banks cut into the lawn (the bridge not included).
 * @param {number} x
 * @param {number} z
 */
export function terrain(x, z) {
  const w = waterAt(x, z, _w);
  let h;
  if (w.shore < 0) {
    // The bed: just under the surface at the edge, deepest in the middle.
    const u = Math.min(1, -w.shore / w.width);
    h = w.level - 0.04 - (w.depth - 0.04) * (1 - (1 - u) * (1 - u));
  } else {
    // A bank rising out of the water, then the lawn.
    const bank = w.level - 0.04 + 0.26 * smooth(0, 0.5, w.shore);
    h = bank + (lawn(x, z) - bank) * smooth(0.5, 3.0, w.shore);
    h = Math.max(h, w.level + 0.2 * smooth(0, 0.5, w.shore));
  }
  // A level landing at the door, and a level patch for the bench to stand on (on dry land only).
  h *= smooth(1.1, 2.6, Math.hypot(x, z));
  const b = Math.hypot(x - BENCH.x, z - BENCH.z);
  h += (BENCH_GROUND - h) * (1 - smooth(1.0, 1.8, b)) * smooth(0.4, 1.0, w.shore);
  return h - 0.02 * trailWeight(x, z);
}

/** The trail, smoothed: a few rounds of corner cutting, the ends and the bridge's straight run kept. */
export const TRAIL_LINE = (() => {
  let pts = TRAIL.map((p) => p.slice());
  for (let round = 0; round < 3; round++) {
    const next = [pts[0]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const onBridge = ax === BRIDGE.x && bx === BRIDGE.x;
      if (onBridge) {
        next.push([ax, az], [bx, bz]);
        continue;
      }
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
})();

/**
 * Distance from (x, z) to the trail's middle line.
 * @param {number} x
 * @param {number} z
 */
export function trailDistance(x, z) {
  let best = Infinity;
  const P = TRAIL_LINE;
  for (let i = 0; i + 1 < P.length; i++) {
    const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1];
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1) : 0;
    const dx = x - (ax + ex * t), dz = z - (az + ez * t);
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/**
 * How much of the ground at (x, z) is trail (1) rather than grass (0): the trail and the bench's gravel.
 * @param {number} x
 * @param {number} z
 */
export function trailWeight(x, z) {
  const wobble = 0.05 * Math.sin(x * 3.1 + z * 1.7) + 0.035 * Math.sin(x * 7.3 - z * 5.9);
  const t = 1 - smooth(TRAIL_WIDTH / 2 - 0.12, TRAIL_WIDTH / 2 + 0.12, trailDistance(x, z) + wobble);
  const pad = 1 - smooth(1.05, 1.35, Math.hypot(x - BENCH.x, (z - BENCH.z) * 1.3 - 0.35) + wobble);
  return Math.max(t, pad);
}

// ── The layout: the ground sampled once, and where everything is ──────────────

/** The ground sampled on a grid: the scene's mesh is made from it, and walking and rays read it. */
export const GRID = { x0: -13, x1: 13, z0: 1, z1: -19, step: 0.2 };

function sampleGrid() {
  const nx = Math.round((GRID.x1 - GRID.x0) / GRID.step) + 1;
  const nz = Math.round((GRID.z0 - GRID.z1) / GRID.step) + 1;
  const h = new Float32Array(nx * nz), shore = new Float32Array(nx * nz);
  let maxH = -Infinity;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = GRID.x0 + i * GRID.step, z = GRID.z0 - j * GRID.step;
      const k = j * nx + i;
      h[k] = terrain(x, z);
      shore[k] = waterAt(x, z, _w).shore;
      if (h[k] > maxH) maxH = h[k];
    }
  }
  return { ...GRID, nx, nz, h, shore, maxH };
}

/**
 * Bilinear sample of one of the grid's arrays at (x, z), or NaN off it.
 * @param {Layout['grid']} G
 * @param {Float32Array} a
 * @param {number} x
 * @param {number} z
 */
function sample(G, a, x, z) {
  const fx = (x - G.x0) / G.step, fz = (G.z0 - z) / G.step;
  if (fx < 0 || fz < 0 || fx > G.nx - 1 || fz > G.nz - 1) return NaN;
  const i = Math.min(G.nx - 2, Math.floor(fx)), j = Math.min(G.nz - 2, Math.floor(fz));
  const u = fx - i, v = fz - j, k = j * G.nx + i;
  return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + G.nx] * (1 - u) + a[k + G.nx + 1] * u) * v;
}

/** @typedef {{ x: number, z: number, yaw: number }} Place something placed, with a frame of its own: r to its right, f in front of it */

/**
 * A point of a placed thing's frame ({ x, z, yaw }) in the world: writes { x, z } into out.
 * @param {Place} place
 * @param {number} r
 * @param {number} f
 */
export function toWorld(place, r, f, out = { x: 0, z: 0 }) {
  const s = Math.sin(place.yaw), c = Math.cos(place.yaw);
  out.x = place.x + r * c - f * s;
  out.z = place.z - r * s - f * c;
  return out;
}

/**
 * (x, z) in a placed thing's frame: writes { r, f } into out.
 * @param {Place} place
 * @param {number} x
 * @param {number} z
 */
export function toLocal(place, x, z, out = { r: 0, f: 0 }) {
  const s = Math.sin(place.yaw), c = Math.cos(place.yaw);
  const dx = x - place.x, dz = z - place.z;
  out.r = dx * c - dz * s;
  out.f = -dx * s - dz * c;
  return out;
}

/**
 * Everything about the garden the frame loop asks: the ground grid, the door (its size from the
 * link, else DOOR), the bridge's ends, the bench, the seat and the book, where to arrive.
 * @param {{ doorWidth?: number, doorHeight?: number }} [o]
 */
export function layoutGarden({ doorWidth = DOOR.width, doorHeight = DOOR.height } = {}) {
  const grid = sampleGrid();
  const bench = { x: BENCH.x, z: BENCH.z, yaw: BENCH.yaw, y: terrain(BENCH.x, BENCH.z) };
  const seat = toWorld(bench, SEAT.r, SEAT.f);
  const book = toWorld(bench, BOOK.r, BOOK.f);
  const front = toWorld(bench, SEAT.r, 0.95);
  const L = {
    grid,
    door: { width: doorWidth, height: doorHeight, reveal: DOOR.reveal, threshold: DOOR.threshold },
    deck: { hA: terrain(BRIDGE.x, BRIDGE.zA), hB: terrain(BRIDGE.x, BRIDGE.zB) },
    bench,
    seat: { x: seat.x, z: seat.z, y: bench.y + BENCH.seat, yaw: BENCH.yaw },
    book: { x: book.x, z: book.z, y: bench.y + BENCH.seat, yaw: BENCH.yaw },
    /** Where to stand to sit down: in front of the seat. */
    benchFront: { x: front.x, z: front.z },
    trees: TREES,
    spawn: { x: 0, z: -0.6, yaw: 0 },
    /** Which of the grid's points a head may walk over (1), for finding the way: walkGrid's, below. */
    walk: new Uint8Array(grid.nx * grid.nz),
  };
  walkGrid(L);
  return L;
}

/** @typedef {ReturnType<typeof layoutGarden>} Layout the garden's layout (layoutGarden) */

/**
 * Where someone coming out of the door stands: dx to the right of its middle (within its jambs), turned by yaw.
 * @param {Layout} L
 */
export function doorSpawn(L, dx = 0, yaw = 0) {
  const jamb = L.door.width / 2 - 0.25;
  return { x: clamp(dx, -jamb, jamb), z: L.spawn.z, yaw: clamp(yaw, -Math.PI / 2, Math.PI / 2) };
}

/**
 * Whether (x, z) is on the bridge's deck (between its ends, across its whole width).
 * @param {number} x
 * @param {number} z
 */
export function onDeck(x, z) {
  return Math.abs(x - BRIDGE.x) <= BRIDGE.width / 2 && z <= BRIDGE.zA && z >= BRIDGE.zB;
}

/** How far along the bridge z is, 0 at its near end, 1 at its far end. @type {(z: number) => number} */
const along = (z) => (BRIDGE.zA - z) / (BRIDGE.zA - BRIDGE.zB);

/**
 * The top of the deck at z (on it).
 * @param {Layout} L
 * @param {number} z
 */
export function deckHeight(L, z) {
  const t = clamp(along(z), 0, 1);
  return L.deck.hA + (L.deck.hB - L.deck.hA) * t + BRIDGE.rise * Math.sin(Math.PI * t) + BRIDGE.deck;
}

/**
 * What the viewer stands on at (x, z): the deck, or the ground.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
export function groundAt(L, x, z) {
  if (onDeck(x, z)) return deckHeight(L, z);
  const h = sample(L.grid, L.grid.h, x, z);
  return Number.isNaN(h) ? terrain(x, z) : h;
}

/**
 * What is on top at (x, z), for a visitor's ring: the ground, or the water where its surface covers
 * the ground (dry() lets a visitor stand a little into the water's edge, and the surface runs on
 * under the banks).
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
export function surfaceAt(L, x, z) {
  const y = groundAt(L, x, z);
  const w = waterAt(x, z, _w);
  return w.shore < WATER_UNDER && w.level > y ? w.level : y;
}

/**
 * How far (x, z) is beyond the water's edge (- in the water), from the grid where it reaches.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
export function shoreAt(L, x, z) {
  const s = sample(L.grid, L.grid.shore, x, z);
  return Number.isNaN(s) ? waterAt(x, z, _w).shore : s;
}

/**
 * Whether a head may be over (x, z) as far as the water goes: dry ground (or its very edge), or the deck.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
export function dry(L, x, z) {
  return onDeck(x, z) || shoreAt(L, x, z) > -0.1;
}

const _l = { r: 0, f: 0 };
/**
 * The bench's footprint, grown by `grow`, in its frame.
 * @param {number} x
 * @param {number} z
 * @param {number} grow
 */
function inBench(x, z, grow) {
  const p = toLocal(BENCH, x, z, _l);
  return Math.abs(p.r) < BENCH.length / 2 + grow && p.f > -BENCH.depth / 2 - 0.05 - grow && p.f < BENCH.depth / 2 + grow;
}

/**
 * The nearest place to (x, z) a head coming from (fx, fz) may be: inside the hedges, the far wall
 * and the house (the doorway apart, between its jambs), clear of the tree trunks, the bench and
 * the bridge's rails, and out of the water. Writes { x, z } into out.
 * @param {Layout} L
 * @param {number} fx
 * @param {number} fz
 * @param {number} x
 * @param {number} z
 */
export function clampWalk(L, fx, fz, x, z, out = { x: 0, z: 0 }) {
  const m = GARDEN.margin;
  x = clamp(x, GARDEN.x0 + m, GARDEN.x1 - m);
  z = Math.max(z, GARDEN.z1 + m);
  const jamb = L.door.width / 2 - 0.2;
  if (z > -m) {
    // The house: only the doorway goes in, between its jambs, which the shoulders keep clear of.
    if (Math.abs(x) < jamb || (fz > -m && Math.abs(fx) <= jamb + 1e-6)) {
      x = clamp(x, -jamb, jamb);
      z = Math.min(z, L.door.reveal + 0.1);
    } else {
      z = -m;
    }
  }
  for (const t of L.trees) {
    let dx = x - t.x, dz = z - t.z;
    const r = t.trunk + 0.28;
    if (dx * dx + dz * dz < r * r) {
      // Out the way it came in (from its middle, the way from where it was).
      if (dx * dx + dz * dz < 1e-8) {
        dx = fx - t.x;
        dz = fz - t.z;
      }
      const d = Math.hypot(dx, dz) || 1;
      x = t.x + (dx / d) * r;
      z = t.z + (dz / d) * r;
    }
  }
  const grow = 0.26;
  if (inBench(x, z, grow)) {
    // Out by the nearest side.
    const p = toLocal(BENCH, x, z, _l);
    const er = BENCH.length / 2 + grow - Math.abs(p.r);
    const ef = p.f >= 0 ? BENCH.depth / 2 + grow - p.f : p.f + BENCH.depth / 2 + 0.05 + grow;
    let r = p.r, f = p.f;
    if (er < ef) r = Math.sign(p.r || 1) * (BENCH.length / 2 + grow);
    else f = p.f >= 0 ? BENCH.depth / 2 + grow : -BENCH.depth / 2 - 0.05 - grow;
    const w = toWorld(BENCH, r, f, out);
    x = w.x;
    z = w.z;
  }
  // The rails: on the deck a head stays between them; beside the bridge, outside them.
  const t = along(z);
  if (t > BRIDGE.rails && t < 1 - BRIDGE.rails) {
    const a = x - BRIDGE.x, rail = BRIDGE.width / 2 - 0.03, outside = rail + 0.23;
    if (Math.abs(a) > BRIDGE.walk && Math.abs(a) < outside) {
      const wasOn = Math.abs(fx - BRIDGE.x) < rail;
      x = BRIDGE.x + Math.sign(a) * (wasOn ? BRIDGE.walk : outside);
    }
  }
  // The water: slide along its edge, or stay.
  if (!dry(L, x, z)) {
    if (dry(L, x, fz)) z = fz;
    else if (dry(L, fx, z)) x = fx;
    else {
      x = fx;
      z = fz;
    }
  }
  out.x = x;
  out.z = z;
  return out;
}

/**
 * Whether a head at (x, z) has gone through the door, back into the hallway.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
export function doorCrossed(L, x, z) {
  return Math.abs(x) < L.door.width / 2 && z > L.door.threshold;
}

/**
 * Whether (x, z) is somewhere to stand: in the garden, dry, clear of trunks and the bench; on the deck, between its rails.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
export function standable(L, x, z) {
  const m = GARDEN.margin;
  if (x < GARDEN.x0 + m || x > GARDEN.x1 - m || z < GARDEN.z1 + m || z > -m) return false;
  if (onDeck(x, z)) return Math.abs(x - BRIDGE.x) <= BRIDGE.walk;
  if (!dry(L, x, z) || inBench(x, z, 0.15)) return false;
  for (const t of L.trees) if (Math.hypot(x - t.x, z - t.z) < t.trunk + 0.2) return false;
  return true;
}

// ── Finding the way ──────────────────────────────────────────────────────────

/** The bridge's ends, a step out onto the land: [x, z]. */
export const BRIDGE_ENDS = { near: [BRIDGE.x, BRIDGE.zA + 0.35], far: [BRIDGE.x, BRIDGE.zB - 0.35] };

/**
 * Whether a walk straight from a to b keeps out of the water (the deck counts as dry).
 * @param {Layout} L
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 */
export function clearPath(L, ax, az, bx, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (!dry(L, x, z)) return false;
  }
  return true;
}

/** Whether a head may walk over (x, z) (standable: the deck between its rails counts). @type {(L: Layout, x: number, z: number) => boolean} */
export const walkable = (L, x, z) => standable(L, x, z);

/**
 * Whether a walk straight from a to b is all walkable (its first stretch apart: one may start at an edge).
 * @param {Layout} L
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 */
function clearWalk(L, ax, az, bx, bz) {
  const length = Math.hypot(bx - ax, bz - az), n = Math.ceil(length / 0.1);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (t * length < 0.25) continue;
    if (!walkable(L, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/**
 * Marks which of the grid's points a head may walk over (1) in L.walk, for finding the way
 * (walkable reads no L.walk).
 * @param {Layout} L
 */
function walkGrid(L) {
  const G = L.grid, walk = L.walk;
  for (let j = 0; j < G.nz; j++) {
    for (let i = 0; i < G.nx; i++) walk[j * G.nx + i] = walkable(L, G.x0 + i * G.step, G.z0 - j * G.step) ? 1 : 0;
  }
}

/**
 * The walkable grid point nearest (x, z), as its index, or -1 when none is within 3 m.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
function nearestCell(L, x, z) {
  const G = L.grid;
  const ci = Math.round((x - G.x0) / G.step), cj = Math.round((G.z0 - z) / G.step);
  let best = -1, bestD = Infinity;
  for (let r = 0; r <= 15 && best < 0; r++) {
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue;
        const k = j * G.nx + i;
        if (!L.walk[k]) continue;
        const d = Math.hypot(G.x0 + i * G.step - x, G.z0 - j * G.step - z);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
    }
  }
  return best;
}

/**
 * The shortest way over the walkable grid from cell a to cell b (A*, eight ways, no corners cut): indices, or null.
 * @param {Layout} L
 * @param {number} a
 * @param {number} b
 */
function gridPath(L, a, b) {
  const G = L.grid, nx = G.nx, N = nx * G.nz, W = L.walk;
  const cost = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  /** A binary heap of [priority, index]. @type {[number, number][]} */
  const heap = [];
  /** @type {(p: number, k: number) => void} */
  const push = (p, k) => {
    heap.push([p, k]);
    for (let i = heap.length - 1; i > 0;) {
      const up = (i - 1) >> 1;
      if (heap[up][0] <= heap[i][0]) break;
      [heap[up], heap[i]] = [heap[i], heap[up]];
      i = up;
    }
  };
  const pop = () => {
    const top = heap[0], last = /** @type {[number, number]} */ (heap.pop()); // called only while there is one
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top[1];
  };
  const bi = b % nx, bj = (b - bi) / nx;
  /** @type {(k: number) => number} */
  const guess = (k) => {
    const i = k % nx, j = (k - i) / nx, di = Math.abs(i - bi), dj = Math.abs(j - bj);
    return Math.max(di, dj) + (Math.SQRT2 - 1) * Math.min(di, dj);
  };
  cost[a] = 0;
  push(guess(a), a);
  while (heap.length) {
    const k = pop();
    if (k === b) break;
    if (done[k]) continue;
    done[k] = 1;
    const i = k % nx, j = (k - i) / nx;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= G.nz) continue;
        const n = nj * nx + ni;
        if (!W[n] || done[n]) continue;
        if (di && dj && (!W[j * nx + ni] || !W[nj * nx + i])) continue;
        const c = cost[k] + (di && dj ? Math.SQRT2 : 1);
        if (c < cost[n]) {
          cost[n] = c;
          from[n] = k;
          push(c + guess(n), n);
        }
      }
    }
  }
  if (a !== b && from[b] < 0) return null;
  const path = [b];
  while (path[path.length - 1] !== a) path.push(from[path[path.length - 1]]);
  return path.reverse();
}

/**
 * The points to walk through from (fx, fz) to (tx, tz), or as near it as one may stand: straight
 * there when nothing is in the way, else round the water (over the bridge when it is between
 * them), the trunks and the bench, the corners of the way cut wherever a straight walk is clear.
 * [[x, z], …], ending at the target; empty when there is no way.
 * @param {Layout} L
 * @param {number} fx
 * @param {number} fz
 * @param {number} tx
 * @param {number} tz
 * @returns {[number, number][]}
 */
export function route(L, fx, fz, tx, tz) {
  if (!walkable(L, tx, tz)) {
    const k = nearestCell(L, tx, tz);
    if (k < 0) return [];
    const i = k % L.grid.nx;
    tx = L.grid.x0 + i * L.grid.step;
    tz = L.grid.z0 - ((k - i) / L.grid.nx) * L.grid.step;
  }
  if (clearWalk(L, fx, fz, tx, tz)) return [[tx, tz]];
  const a = nearestCell(L, fx, fz), b = nearestCell(L, tx, tz);
  const cells = a >= 0 && b >= 0 ? gridPath(L, a, b) : null;
  if (!cells) return [];
  const G = L.grid;
  /** @type {[number, number][]} */
  const pts = cells.map((k) => {
    const i = k % G.nx;
    return [G.x0 + i * G.step, G.z0 - ((k - i) / G.nx) * G.step];
  });
  pts[pts.length - 1] = [tx, tz];
  // From where one is, on to the farthest point a straight walk reaches, and again from there.
  /** @type {[number, number][]} */
  const out = [];
  let at = [fx, fz], i = -1;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearWalk(L, at[0], at[1], pts[j][0], pts[j][1])) j--;
    out.push(pts[j]);
    at = pts[j];
    i = j;
  }
  return out;
}

// ── Rays ─────────────────────────────────────────────────────────────────────

let _tn = 0, _tf = 0;
/**
 * Narrows [_tn, _tf] to where o + t·d is between lo and hi on one axis; false when it never is.
 * @param {number} o
 * @param {number} d
 * @param {number} lo
 * @param {number} hi
 */
function slab(o, d, lo, hi) {
  if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / d, b = (hi - o) / d;
  if (a > b) {
    const s = a;
    a = b;
    b = s;
  }
  if (a > _tn) _tn = a;
  if (b < _tf) _tf = b;
  return _tn <= _tf;
}

/**
 * Where a ray (o + t·d, t > 0) meets the box lo…hi (in whatever frame both are in): the t, or Infinity.
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} x0
 * @param {number} y0
 * @param {number} z0
 * @param {number} x1
 * @param {number} y1
 * @param {number} z1
 */
function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  _tn = -Infinity;
  _tf = Infinity;
  if (!slab(ox, dx, x0, x1) || !slab(oy, dy, y0, y1) || !slab(oz, dz, z0, z1) || _tf < 0) return Infinity;
  return _tn > 0 ? _tn : Infinity; // starting inside: no hit
}

/**
 * The ray's t at the ellipsoid (centre c, half sizes r), or Infinity.
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} cx
 * @param {number} cy
 * @param {number} cz
 * @param {number} rx
 * @param {number} ry
 * @param {number} rz
 */
function rayEllipsoid(ox, oy, oz, dx, dy, dz, cx, cy, cz, rx, ry, rz) {
  const px = (ox - cx) / rx, py = (oy - cy) / ry, pz = (oz - cz) / rz;
  const qx = dx / rx, qy = dy / ry, qz = dz / rz;
  const a = qx * qx + qy * qy + qz * qz, b = px * qx + py * qy + pz * qz, c = px * px + py * py + pz * pz - 1;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  return t > 0 ? t : Infinity;
}

/**
 * The ray's t at a vertical cylinder (axis at x, z; radius r; from y0 to y1), or Infinity.
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} x
 * @param {number} z
 * @param {number} r
 * @param {number} y0
 * @param {number} y1
 */
function rayCylinder(ox, oy, oz, dx, dy, dz, x, z, r, y0, y1) {
  const px = ox - x, pz = oz - z;
  const a = dx * dx + dz * dz, b = px * dx + pz * dz, c = px * px + pz * pz - r * r;
  if (a < 1e-12) return Infinity;
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t <= 0) return Infinity;
  const y = oy + dy * t;
  return y >= y0 && y <= y1 ? t : Infinity;
}

/**
 * What a ray meets on the ground's surface: the ground, or the water over it.
 * @param {Layout} L
 * @param {number} x
 * @param {number} z
 */
function surface(L, x, z) {
  const g = groundAt(L, x, z);
  if (onDeck(x, z)) return g;
  const level = waterLevel(x);
  return g < level && shoreAt(L, x, z) < 0 ? level : g;
}

/**
 * What castRay writes into: common's Hit (common/controls.js) and where on the panel (controls.js's
 * GardenHit is one).
 * @typedef {{ t: number, kind: string, x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, walkable: boolean }} RayHit
 */

const _ray = { r: 0, f: 0 };
/**
 * What a ray reaches first: the door, the control panel, the house's wall, the book, the bench, a
 * tree, a hedge, the far wall, the water or the ground; null for the sky. Writes into out
 * { t, kind, x, y, z, nx, ny, nz, u, v, walkable } (n: the surface's normal, toward the ray; u, v:
 * where on the panel, 0…1 from its bottom left; walkable: for the ground, whether it is somewhere
 * to stand) and returns it.
 * @template {RayHit} H
 * @param {Layout} L
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {H} out
 * @returns {H | null}
 */
export function castRay(L, ox, oy, oz, dx, dy, dz, out) {
  let best = Infinity;
  let kind = '';
  let nx = 0, ny = 0, nz = 0, u = 0, v = 0;
  // The house's wall, the door and the panel in it.
  if (dz > 1e-6 && oz < 0) {
    const s = (-PANEL.depth - oz) / dz;
    const px = ox + dx * s, py = oy + dy * s;
    const pu = 0.5 - (px - PANEL.x) / PANEL.width, pv = 0.5 + (py - PANEL.y) / PANEL.height;
    if (s > 0 && pu >= 0 && pu <= 1 && pv >= 0 && pv <= 1) {
      best = s;
      kind = 'panel';
      u = pu;
      v = pv;
      nz = -1;
    } else {
      const t = -oz / dz, y = oy + dy * t, x = ox + dx * t;
      if (t > 0 && y < HOUSE.height) {
        best = t;
        kind = Math.abs(x) < L.door.width / 2 && y < L.door.height && y > -0.1 ? 'door' : 'wall';
        nz = -1;
      }
    }
  }
  // The book, then the bench (in the bench's frame).
  {
    const s = Math.sin(BENCH.yaw), c = Math.cos(BENCH.yaw);
    const lo = toLocal(BENCH, ox, oz, _ray);
    const lr = lo.r, lf = lo.f, ly = oy - L.bench.y;
    const dr = dx * c - dz * s, df = -dx * s - dz * c;
    const seat = BENCH.seat;
    const tb = rayBox(lr, ly, lf, dr, dy, df, BOOK.r - BOOK.width / 2 - 0.04, seat - 0.02, BOOK.f - BOOK.length / 2 - 0.04, BOOK.r + BOOK.width / 2 + 0.04, seat + BOOK.thickness + 0.05, BOOK.f + BOOK.length / 2 + 0.04);
    if (tb < best) {
      best = tb;
      kind = 'book';
      ny = 1;
    }
    const half = BENCH.length / 2;
    const tc = Math.min(
      rayBox(lr, ly, lf, dr, dy, df, -half, 0, -BENCH.depth / 2, half, seat + 0.03, BENCH.depth / 2),
      rayBox(lr, ly, lf, dr, dy, df, -half, 0, -BENCH.depth / 2 - 0.05, half, BENCH.back, -BENCH.depth / 2 + 0.12),
    );
    if (tc < best) {
      best = tc;
      kind = 'bench';
      ny = 1;
    }
  }
  // Trees: trunks and crowns.
  for (const t of L.trees) {
    const gy = groundAt(L, t.x, t.z);
    const tt = Math.min(
      rayCylinder(ox, oy, oz, dx, dy, dz, t.x, t.z, t.trunk, gy - 0.2, gy + t.crownY),
      rayEllipsoid(ox, oy, oz, dx, dy, dz, t.x, gy + t.crownY, t.z, t.crown[0], t.crown[1], t.crown[2]),
    );
    if (tt < best) {
      best = tt;
      kind = 'tree';
      ny = 1;
    }
  }
  // The hedges (left, right) and the far wall: their faces, as high as they stand above the ground there.
  for (let k = 0; k < 3; k++) {
    if (k === 0 ? !(dx < 0) : k === 1 ? !(dx > 0) : !(dz < 0)) continue;
    const t = k === 0 ? (GARDEN.x0 - ox) / dx : k === 1 ? (GARDEN.x1 - ox) / dx : (GARDEN.z1 - oz) / dz;
    if (!(t > 0) || t >= best) continue;
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    if (y < groundAt(L, x, z) + (k < 2 ? HEDGE.height : BACK_WALL.height)) {
      best = t;
      kind = k < 2 ? 'hedge' : 'wall';
      nx = k === 0 ? 1 : k === 1 ? -1 : 0;
      ny = 0;
      nz = k === 2 ? 1 : 0;
    }
  }
  // The ground (or the water): march along the ray until it goes under, then home in.
  const limit = Math.min(best, GARDEN.far);
  let t0 = 0, t = 0.02;
  if (oy - surface(L, ox, oz) > 0) {
    while (t < limit) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (dy > 0 && y > L.grid.maxH + 1) break;
      if (y - surface(L, x, z) <= 0) {
        let a = t0, b = t;
        for (let i = 0; i < 10; i++) {
          const m = (a + b) / 2;
          if (oy + dy * m - surface(L, ox + dx * m, oz + dz * m) > 0) a = m;
          else b = m;
        }
        best = b;
        const hx = ox + dx * b, hz = oz + dz * b;
        const wet = !onDeck(hx, hz) && shoreAt(L, hx, hz) < 0 && groundAt(L, hx, hz) < waterLevel(hx);
        kind = wet ? 'water' : 'ground';
        if (wet || onDeck(hx, hz)) {
          nx = 0;
          ny = 1;
          nz = 0;
        } else {
          const e = 0.15;
          const gx = groundAt(L, hx + e, hz) - groundAt(L, hx - e, hz);
          const gz = groundAt(L, hx, hz + e) - groundAt(L, hx, hz - e);
          const n = Math.hypot(gx, 2 * e, gz);
          nx = -gx / n;
          ny = (2 * e) / n;
          nz = -gz / n;
        }
        break;
      }
      t0 = t;
      t += 0.06 + 0.02 * t;
    }
  }
  if (best === Infinity) return null;
  out.t = best;
  out.kind = kind;
  out.x = ox + dx * best;
  out.y = oy + dy * best;
  out.z = oz + dz * best;
  out.nx = nx;
  out.ny = ny;
  out.nz = nz;
  out.u = u;
  out.v = v;
  out.walkable = kind === 'ground' && standable(L, out.x, out.z);
  return out;
}
