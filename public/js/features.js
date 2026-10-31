// The garden's made things and stones: the foot bridge, the bench, the dry-stone wall at the far
// end, rocks along the banks, lily pads on the pond and the rustic gates where the stream goes
// through the hedges. Geometry only (untextured, coloured per vertex), into the Builder scene.js
// lights; the boxes they cast shadows with come back too.
import * as THREE from 'three';
import { BACK_WALL, BENCH, BRIDGE, GARDEN, HEDGE, deckHeight, groundAt, toWorld, waterAt, waterLevel } from './garden.js';
import { rng } from './textures.js';

/** @typedef {import('./bake.js').RGB} RGB */
/** @typedef {import('./bake.js').Occluder} Occluder */
/** @typedef {import('./builder.js').Builder} Builder */
/** @typedef {import('./garden.js').Layout} Layout */
/**
 * A run of hedge, as plants.js's hedgeRuns lays them out: its side (-1 the left, at -x; 1 the
 * right), the x of its inner face (the garden's) and of its outer, and the z it runs from and to.
 * @typedef {{ side: number, inner: number, outer: number, z0: number, z1: number }} HedgeRun
 */

/** A CSS colour ('#rrggbb') as linear RGB. @type {(hex: string) => RGB} */
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** A colour k times as bright. @type {(c: RGB, k: number) => RGB} */
const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
/** v at unit length (a zero vector as it is). @type {(v: number[]) => number[]} */
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
/** v times k. @type {(v: number[], k: number) => number[]} */
const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];

const WOOD = lin('#8b6f53'), DARK_WOOD = lin('#5c4836'), RAIL_WOOD = lin('#7a5f45');
const STONES = ['#8f897e', '#9d9486', '#7f7a72', '#a89d8b', '#8a8274', '#9a9690'].map(lin);
const MOSS = lin('#5d6e34');

/**
 * The bridge: arched deck of planks on two stringers, posts and handrails, stone abutments.
 * @param {Layout} L
 * @param {Builder} b what it is built into (scene.js's trim)
 * @returns {Occluder[]} its shadow
 */
export function buildBridge(L, b) {
  const r = rng(301);
  const { x, zA, zB, width } = BRIDGE;
  const half = width / 2;
  /** The top of the deck at z. @param {number} z */
  const top = (z) => deckHeight(L, z);
  /**
   * Along the deck toward its far end (t, which runs toward -z), and its up (n, square to it).
   * @type {(t: number[]) => number[]}
   */
  const upOf = (t) => [0, -t[2], t[1]];
  /** The deck's t and n at z. @param {number} z */
  const frame = (z) => {
    const e = 0.02, t = norm([0, top(z - e) - top(z + e), -2 * e]);
    return { t, n: upOf(t) };
  };
  // Planks across, following the arch.
  const count = Math.round((zA - zB) / 0.135);
  for (let i = 0; i < count; i++) {
    const z = zA - ((i + 0.5) / count) * (zA - zB);
    const { t, n } = frame(z);
    const c = [x + (r() - 0.5) * 0.02, top(z) - 0.022, z];
    const w = half + 0.04 + (r() - 0.5) * 0.03;
    b.cuboid(c, [w, 0, 0], mul(t, 0.06), mul(n, 0.022), { albedo: scale(WOOD, 0.82 + 0.3 * r()) });
  }
  // Stringers under the planks' ends, and the posts and rails above them.
  const segs = 12;
  for (const side of [-1, 1]) {
    const sx = x + side * (half - 0.07);
    for (let i = 0; i < segs; i++) {
      const za = zA - (i / segs) * (zA - zB), zb = zA - ((i + 1) / segs) * (zA - zB);
      const ya = top(za), yb = top(zb);
      const mid = [sx, (ya + yb) / 2 - 0.12, (za + zb) / 2];
      const t = norm([0, yb - ya, zb - za]), n = upOf(t);
      const len = Math.hypot(yb - ya, zb - za) / 2 + 0.01;
      b.cuboid(mid, [0.045, 0, 0], mul(t, len), mul(n, 0.09), { albedo: DARK_WOOD });
      // Handrail and mid rail, a little in from the edge.
      const rx = x + side * (half - 0.03);
      if (i / segs >= BRIDGE.rails - 0.01 && (i + 1) / segs <= 1 - BRIDGE.rails + 0.01 + 1 / segs) {
        for (const [h, th] of [[0.92, 0.035], [0.5, 0.025]]) {
          b.cuboid([rx, (ya + yb) / 2 + h, (za + zb) / 2], [0.03, 0, 0], mul(t, len), mul(n, th), { albedo: RAIL_WOOD });
        }
      }
    }
    for (const f of [BRIDGE.rails, 0.3, 0.5, 0.7, 1 - BRIDGE.rails]) {
      const z = zA - f * (zA - zB), y = top(z);
      b.cuboid([x + side * (half - 0.03), y + 0.47, z], [0.04, 0, 0], [0, 0.5, 0], [0, 0, 0.04], { albedo: scale(RAIL_WOOD, 0.9 + 0.2 * r()) });
    }
  }
  // Stone abutments where it rests on the banks.
  for (const [z, dir] of [[zA, 1], [zB, -1]]) {
    const y = top(z) - 0.05;
    for (let i = 0; i < 6; i++) {
      const sx = x + (i % 3 - 1) * (half * 0.75), sz = z - dir * (0.05 + Math.floor(i / 3) * 0.28);
      const sy = y - 0.18 - Math.floor(i / 3) * 0.12;
      b.cuboid([sx, sy, sz], [half * 0.38, 0, 0], [0, 0.17, 0], [0, 0, 0.15], { albedo: STONES[i % STONES.length], jitter: jitterer(r, 0.02) });
    }
  }
  // Its shadow: a box under the deck.
  return [{ kind: 'box', min: [x - half, top(zA) - 0.2, zB], max: [x + half, top((zA + zB) / 2), zA] }];
}

/**
 * Moves a corner by up to `k` metres, the same corner always the same way.
 * @param {() => number} r random numbers (textures.js's rng)
 * @param {number} k
 * @returns {(p: number[]) => number[]}
 */
function jitterer(r, k) {
  /** Where each corner went, by where it was. @type {Map<string, number[]>} */
  const seen = new Map();
  return (p) => {
    const key = `${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [p[0] + (r() - 0.5) * 2 * k, p[1] + (r() - 0.5) * 2 * k, p[2] + (r() - 0.5) * 2 * k]);
    return /** @type {number[]} */ (seen.get(key)); // set above if it was not
  };
}

/**
 * The bench: wooden slats on cast-iron ends, facing the pond and the house.
 * @param {Layout} L
 * @param {Builder} b what it is built into (scene.js's trim)
 * @returns {Occluder[]} its shadow
 */
export function buildBench(L, b) {
  const r = rng(311);
  const place = L.bench;
  const y0 = place.y;
  const s = Math.sin(place.yaw), c = Math.cos(place.yaw);
  const R = [c, 0, -s], F = [-s, 0, -c], U = [0, 1, 0];
  /**
   * A point of the bench: rr to its right, f in front of it and y above its foot.
   * @param {number} rr
   * @param {number} f
   * @param {number} y
   */
  const at = (rr, f, y) => {
    const w = toWorld(place, rr, f);
    return [w.x, y0 + y, w.z];
  };
  /**
   * v1 turned by a radians toward v2 (at right angles to it).
   * @param {number} a
   * @param {number[]} v1
   * @param {number[]} v2
   */
  const tilt = (a, v1, v2) => [v1[0] * Math.cos(a) + v2[0] * Math.sin(a), v1[1] * Math.cos(a) + v2[1] * Math.sin(a), v1[2] * Math.cos(a) + v2[2] * Math.sin(a)];
  const half = BENCH.length / 2;
  const wood = lin('#9a7652'), iron = lin('#262b26');
  // The seat's slats, and the back's, leaning back.
  for (const f of [-0.205, -0.085, 0.035, 0.155]) {
    b.cuboid(at(0, f, BENCH.seat - 0.017), mul(R, half), mul(F, 0.05), mul(U, 0.017), { albedo: scale(wood, 0.88 + 0.22 * r()) });
  }
  // The back leans back by `back`: going up it goes back (-F), and its face looks forward and a little up.
  const back = 0.2; // radians
  const backUp = tilt(back, U, mul(F, -1)), backFace = tilt(back, F, U);
  for (const y of [0.6, 0.72, 0.84]) {
    const f = -0.27 - (y - 0.5) * Math.tan(back);
    b.cuboid(at(0, f, y), mul(R, half), mul(backUp, 0.05), mul(backFace, 0.015), { albedo: scale(wood, 0.88 + 0.22 * r()) });
  }
  // The iron ends: front leg, back leg up into the back, rail under the seat, the arm.
  for (const rr of [-half + 0.06, half - 0.06, 0]) {
    const end = rr !== 0;
    b.cuboid(at(rr, -0.04, BENCH.seat - 0.05), mul(R, 0.022), mul(F, 0.26), mul(U, 0.02), { albedo: iron });
    if (!end) continue;
    b.cuboid(at(rr, 0.2, (BENCH.seat + 0.2) / 2), mul(R, 0.025), mul(F, 0.025), mul(U, (BENCH.seat + 0.2) / 2), { albedo: iron });
    // The back leg: from the ground behind, up and back to the top of the back.
    const a = at(rr, -0.2, 0), t = at(rr, -0.27 - 0.42 * Math.tan(back), BENCH.back);
    const mid = [(a[0] + t[0]) / 2, (a[1] + t[1]) / 2, (a[2] + t[2]) / 2];
    const along = [t[0] - a[0], t[1] - a[1], t[2] - a[2]], len = Math.hypot(...along) / 2;
    const up = norm(along);
    // Its thickness forward: F with the part along the leg taken off.
    const k = F[0] * up[0] + F[1] * up[1] + F[2] * up[2];
    const fwd = norm([F[0] - up[0] * k, F[1] - up[1] * k, F[2] - up[2] * k]);
    b.cuboid(mid, mul(R, 0.025), mul(fwd, 0.025), mul(up, len), { albedo: iron });
    // The arm, with a curl at its front.
    b.cuboid(at(rr, -0.02, BENCH.seat + 0.2), mul(R, 0.028), mul(F, 0.27), mul(U, 0.02), { albedo: iron });
    b.cuboid(at(rr, 0.25, BENCH.seat + 0.17), mul(R, 0.028), mul(F, 0.035), mul(U, 0.045), { albedo: iron });
  }
  // Its shadow: the seat and the back.
  const corners = [at(-half, -0.31, 0), at(half, 0.31, BENCH.back)];
  return [{
    kind: 'box',
    min: [Math.min(corners[0][0], corners[1][0]), y0 + BENCH.seat - 0.04, Math.min(corners[0][2], corners[1][2])],
    max: [Math.max(corners[0][0], corners[1][0]), y0 + BENCH.seat, Math.max(corners[0][2], corners[1][2])],
  }];
}

/**
 * The dry-stone wall across the far end: courses of rough stones, a coping of stones on edge.
 * @param {Layout} L
 * @param {Builder} b what it is built into (scene.js's trim)
 * @returns {Occluder[]} its shadow
 */
export function buildWall(L, b) {
  const r = rng(321);
  const z0 = GARDEN.z1, depth = BACK_WALL.depth, x0 = GARDEN.x0 - HEDGE.depth, x1 = GARDEN.x1 + HEDGE.depth;
  /**
   * A rough stone about (cx, cy, cz), hx, hy and hz from its middle to its sides, mossy on top.
   * @param {number} cx
   * @param {number} cy
   * @param {number} cz
   * @param {number} hx
   * @param {number} hy
   * @param {number} hz
   * @param {RGB} tone
   */
  const stone = (cx, cy, cz, hx, hy, hz, tone) => {
    b.cuboid([cx, cy, cz], [hx, 0, 0], [0, hy, 0], [0, 0, hz], {
      skip: ['-h'],
      jitter: jitterer(r, 0.012),
      albedo: (n) => (n[1] > 0.5 ? scale(mix(tone, MOSS, 0.35), 0.95) : tone),
    });
  };
  const courses = 4;
  for (let row = 0; row < courses; row++) {
    let x = x0 - r() * 0.3;
    while (x < x1) {
      const len = 0.22 + r() * 0.3;
      const cx = x + len / 2;
      const ground = groundAt(L, Math.min(Math.max(cx, -12.9), 12.9), z0 - depth / 2) - 0.08;
      const h = (BACK_WALL.height - 0.16) / courses;
      const cy = ground + h * (row + 0.5);
      const out = (r() - 0.5) * 0.03;
      stone(cx, cy, z0 - depth / 2 + out, len / 2 - 0.008, h / 2 - 0.006, depth / 2, STONES[Math.floor(r() * STONES.length)]);
      x += len;
    }
  }
  // The coping: stones stood on edge across its top.
  let x = x0;
  while (x < x1) {
    const t = 0.06 + r() * 0.05, h = 0.14 + r() * 0.08;
    const ground = groundAt(L, Math.min(Math.max(x, -12.9), 12.9), z0 - depth / 2) - 0.08;
    stone(x + t / 2, ground + BACK_WALL.height - 0.16 + h / 2, z0 - depth / 2, t / 2 - 0.005, h / 2, depth / 2 * (0.85 + 0.15 * r()), STONES[Math.floor(r() * STONES.length)]);
    x += t;
  }
  return [{ kind: 'box', min: [x0, -1, z0 - depth], max: [x1, groundAt(L, 0, z0 - 0.25) + BACK_WALL.height - 0.05, z0] }];
}

/** The colour t of the way from a to b. @type {(a: RGB, b: RGB, t: number) => RGB} */
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Rocks along the banks, a few out in the shallow, fast water upstream, and round the pond.
 * @param {Layout} L
 * @param {Builder} b what they are built into (scene.js's trim)
 */
export function buildRocks(L, b) {
  const r = rng(331);
  let placed = 0;
  for (let k = 0; k < 4000 && placed < 70; k++) {
    const x = GARDEN.x0 + r() * (GARDEN.x1 - GARDEN.x0), z = GARDEN.z1 + r() * -GARDEN.z1;
    const w = waterAt(x, z);
    if (Math.abs(x - BRIDGE.x) < 0.9) continue;
    const upstream = x > 2.8;
    const want = upstream ? w.shore > -0.35 && w.shore < 0.25 : w.shore > -0.12 && w.shore < 0.18 && r() < 0.35;
    if (!want) continue;
    const size = (upstream ? 0.1 + 0.22 * r() : 0.08 + 0.16 * r());
    const ground = groundAt(L, x, z);
    const level = waterLevel(x);
    const y = Math.max(ground, level - size * 0.5) + size * 0.15;
    const tone = STONES[Math.floor(r() * STONES.length)];
    const seed = r() * 10;
    b.sphere([x, y, z], [size * (1 + 0.3 * r()), size * (0.55 + 0.25 * r()), size * (1 + 0.3 * r())], {
      detail: 1,
      lump: (d) => 1 + 0.18 * Math.sin(d[0] * 3.3 + seed) * Math.sin(d[2] * 2.7 - seed) + 0.1 * Math.sin(d[1] * 5 + seed),
      albedo: (p, n) => (n[1] > 0.55 && p[1] > level + 0.03 ? mix(tone, MOSS, 0.45) : scale(tone, p[1] < level + 0.02 ? 0.6 : 1)),
    });
    placed++;
  }
}

/**
 * Lily pads on the pond's still water, and a few of their flowers.
 * @param {Layout} L
 * @param {Builder} b what they are built into (scene.js's trim)
 */
export function buildLilies(L, b) {
  const r = rng(341);
  const pads = ['#3f6a2a', '#4d7a31', '#5d8a36', '#466f2c'].map(lin);
  let placed = 0;
  /** The pads so far: x, z and radius each. @type {[number, number, number][]} */
  const spots = [];
  for (let k = 0; k < 3000 && placed < 26; k++) {
    const x = -7 + r() * 6, z = -11.5 + r() * 6;
    const w = waterAt(x, z);
    if (w.width < 2.0 || w.shore > -0.45 || spots.some(([sx, sz, sr]) => Math.hypot(sx - x, sz - z) < sr + 0.2)) continue;
    const rad = 0.11 + r() * 0.11, y = w.level + 0.006 + r() * 0.003, turn = r() * Math.PI * 2;
    spots.push([x, z, rad]);
    const tone = pads[Math.floor(r() * pads.length)], rim = scale(tone, 1.25);
    const n = 14, notch = 1;
    for (let i = notch; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2, c = turn + ((i + 1) / n) * Math.PI * 2;
      b.tri([x, y, z], [x + Math.cos(c) * rad, y, z + Math.sin(c) * rad], [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad], { normal: [0, 1, 0], albedos: [tone, rim, rim] });
    }
    if (r() < 0.2) {
      // A water lily: two rings of petals, opening upward.
      const white = lin(r() < 0.6 ? '#f6f1e8' : '#f2c6d6'), gold = lin('#e6be3c');
      for (const [ring, lift, len] of [[0, 0.02, 0.07], [0.3, 0.035, 0.05]]) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + ring;
          const tip = [x + Math.cos(a) * len, y + lift + 0.02, z + Math.sin(a) * len];
          const s1 = [x + Math.cos(a - 0.3) * 0.015, y + 0.01, z + Math.sin(a - 0.3) * 0.015];
          const s2 = [x + Math.cos(a + 0.3) * 0.015, y + 0.01, z + Math.sin(a + 0.3) * 0.015];
          b.tri(s1, tip, s2, { normal: [0, 1, 0], albedos: [gold, white, gold] });
          b.tri(s2, tip, s1, { normal: [0, 1, 0], albedos: [gold, white, gold] });
        }
      }
    }
    placed++;
  }
}

/**
 * Where the stream goes through a hedge: a rough gate of posts, rails and pales over the water.
 * @param {Layout} L
 * @param {Builder} b what they are built into (scene.js's trim)
 * @param {HedgeRun[]} runs the hedges': a gate goes in the gap between a side's first two
 */
export function buildWaterGates(L, b, runs) {
  const r = rng(351);
  for (const side of [-1, 1]) {
    const mine = runs.filter((run) => run.side === side);
    if (mine.length < 2) continue;
    const zTop = mine[0].z1, zBottom = mine[1].z0; // the gap between the two runs
    const gx = (side < 0 ? GARDEN.x0 : GARDEN.x1) + side * 0.35;
    const g0 = groundAt(L, gx, zTop), g1 = groundAt(L, gx, zBottom);
    for (const [z, g] of [[zTop - 0.05, g0], [zBottom + 0.05, g1]]) b.cuboid([gx, g + 0.45, z], [0.05, 0, 0], [0, 0.6, 0], [0, 0, 0.05], { albedo: DARK_WOOD });
    const yTop = Math.max(g0, g1) + 0.85, zMid = (zTop + zBottom) / 2, half = (zTop - zBottom) / 2;
    b.cuboid([gx, yTop, zMid], [0.03, 0, 0], [0, 0.035, 0], [0, 0, half], { albedo: RAIL_WOOD });
    b.cuboid([gx, yTop - 0.4, zMid], [0.03, 0, 0], [0, 0.03, 0], [0, 0, half], { albedo: RAIL_WOOD });
    for (let z = zBottom + 0.16; z < zTop - 0.1; z += 0.14) {
      const bed = groundAt(L, gx, z);
      const len = yTop + 0.05 - bed;
      b.cuboid([gx + 0.04, bed + len / 2, z], [0.012, 0, 0], [0, len / 2, 0], [0, 0, 0.022], { albedo: scale(RAIL_WOOD, 0.8 + 0.3 * r()) });
    }
  }
}

/**
 * The hedges' shadows: a box each run, which lets a little through.
 * @param {Layout} L
 * @param {HedgeRun[]} runs
 * @returns {Occluder[]}
 */
export function hedgeShadows(L, runs) {
  return runs.map(({ inner, outer, z0, z1 }) => ({
    kind: 'box',
    min: [Math.min(inner, outer), -1, Math.min(z0, z1)],
    max: [Math.max(inner, outer), groundAt(L, inner, (z0 + z1) / 2) + HEDGE.height, Math.max(z0, z1)],
    density: 2.2,
  }));
}
