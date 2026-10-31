// What grows in the garden: the trees (oaks, birches, a willow over the pond, a crab apple in
// blossom), the hedges round it, and the long grass, reeds and wild flowers along its edges, its
// banks and its walls; the lawn itself is short (its texture). Geometry only, into the Builders
// scene.js lights and merges: bark into the untextured mesh, crowns and hedges into the leaves',
// and grass, flowers, reeds and the willow's strands into the swaying one.
import { BENCH, BRIDGE, GARDEN, HEDGE, TREES, groundAt, onDeck, shoreAt, trailWeight, waterAt } from './garden.js';
import { rng } from './textures.js';
import * as THREE from 'three';

/** @typedef {import('./bake.js').RGB} RGB */
/** @typedef {import('./builder.js').Builder} Builder */
/** @typedef {import('./garden.js').Layout} Layout */
/** @typedef {import('./garden.js').Tree} Tree */

/** A CSS colour ('#rrggbb') as linear RGB. @type {(hex: string) => RGB} */
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** A colour k times as bright. @type {(c: RGB, k: number) => RGB} */
const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
/** The colour t of the way from a to b. @type {(a: RGB, b: RGB, t: number) => RGB} */
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The leaf picture is grey, about this dark on average: crowns' colours are brightened to match. */
const LEAF = 1.9;
/**
 * Texture coordinates for leaves: the picture laid on from whichever side a surface faces.
 * @type {(p: number[], n: number[]) => number[]}
 */
const leafUv = (p, n) => {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0], p[2]];
  return ax > az ? [p[2], p[1]] : [p[0], p[1]];
};

/**
 * A lumpy surface for a crown's puff: 1 ± a little, by direction.
 * @type {(seed: number, k?: number) => (d: number[]) => number}
 */
const lumpy = (seed, k = 0.13) => (d) =>
  1 + k * Math.sin(3.1 * d[0] + 1.7 * d[1] + seed) * Math.sin(2.3 * d[2] - 1.1 * d[0] + seed * 1.7) + k * 0.5 * Math.sin(7 * d[1] + 5 * d[2] + seed * 2.3);

/**
 * How each kind of tree looks: its bark's colour, its leaves' (the crown's puffs take them in
 * turn), how many puffs its crown has and how big they are (a radius from puff[0] to puff[1]).
 * @type {Record<Tree['kind'], { bark: string, leaves: string[], puffs: number, puff: number[] }>}
 */
const KINDS = {
  oak: { bark: '#5b4c3e', leaves: ['#4f6f2a', '#5e7d31', '#46652a'], puffs: 13, puff: [1.0, 1.6] },
  birch: { bark: '#e6e1d6', leaves: ['#7c9a3e', '#8aa646', '#6d8c37'], puffs: 9, puff: [0.55, 0.95] },
  willow: { bark: '#6a5a47', leaves: ['#7d9a4c', '#8ca85a', '#6f8c43'], puffs: 8, puff: [0.9, 1.3] },
  blossom: { bark: '#5b4636', leaves: ['#f0c8d2', '#e8b4c4', '#f5dde2', '#9db466'], puffs: 9, puff: [0.65, 1.0] },
};

/**
 * The trees: trunks and limbs into `bark`, crowns into `leaves` (leaf-textured), the willow's
 * strands into `sway`, lit as they hang by `light(point, normal, out)` (their colours pushed to
 * sway.lit, vertex by vertex).
 * @param {Layout} L
 * @param {object} o
 * @param {Builder} o.bark scene.js's trim
 * @param {Builder} o.leaves
 * @param {Builder} o.sway
 * @param {(p: number[], n: number[], out: number[]) => void} o.light
 */
export function buildTrees(L, { bark, leaves, sway, light }) {
  TREES.forEach((t, index) => {
    const r = rng(101 + index * 17);
    const k = KINDS[t.kind];
    const gy = groundAt(L, t.x, t.z);
    const top = [t.x + (r() - 0.5) * 0.3, gy + t.crownY - t.crown[1] * 0.3, t.z + (r() - 0.5) * 0.3];
    const barkColor = lin(k.bark);
    const birch = t.kind === 'birch';
    /**
     * The bark's colour at p, `along` its piece (0…1, foot to top) and `ang` round it.
     * @type {(p: number[], along: number, ang: number) => RGB}
     */
    const barkAlbedo = birch
      ? (p, along, ang) => (Math.sin(p[1] * 9.3 + Math.sin(ang * 3 + index) * 1.6) > 0.72 ? lin('#2e2a26') : along < 0.08 ? lin('#6a6458') : barkColor)
      : (p) => scale(barkColor, 0.85 + 0.3 * Math.sin(p[1] * 4.1 + p[0] * 2.3));
    // The trunk, a little bent, tapering into the crown.
    const lean = [(r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25];
    const mid = [t.x + lean[0] * 0.5, gy + t.crownY * 0.45, t.z + lean[2] * 0.5];
    bark.cylinder([t.x, gy - 0.15, t.z], mid, t.trunk * 1.15, t.trunk * 0.85, { sides: 9, rings: birch ? 10 : 3, albedo: barkAlbedo });
    bark.cylinder(mid, top, t.trunk * 0.85, t.trunk * 0.45, { sides: 8, rings: birch ? 10 : 2, albedo: barkAlbedo });
    // Roots flaring at the foot of the bigger trees.
    if (t.trunk > 0.2) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + r();
        bark.cylinder([t.x, gy + 0.35, t.z], [t.x + Math.cos(a) * t.trunk * 2.6, gy - 0.05, t.z + Math.sin(a) * t.trunk * 2.6], t.trunk * 0.45, 0.03, { sides: 6, albedo: barkAlbedo });
      }
    }
    // The crown: puffs over the upper part of its ellipsoid, and limbs out to the bigger ones.
    const [cx, cy, cz] = [t.x + lean[0], gy + t.crownY, t.z + lean[2]];
    const [rx, ry, rz] = t.crown;
    for (let i = 0; i < k.puffs; i++) {
      // Spread over the ellipsoid, more of them up and out than low and in.
      const a = (i / k.puffs) * Math.PI * 2 * 1.618 + r() * 0.8;
      const up = i === 0 ? 1 : -0.35 + r() * 1.25;
      const out = i === 0 ? 0 : Math.sqrt(Math.max(0, 1 - up * up * 0.6)) * (0.55 + 0.35 * r());
      const pc = [cx + Math.cos(a) * rx * out, cy + up * ry * 0.55, cz + Math.sin(a) * rz * out];
      const size = k.puff[0] + (k.puff[1] - k.puff[0]) * r();
      const pr = [size * (1 + 0.15 * r()), size * (0.8 + 0.15 * r()), size * (1 + 0.15 * r())];
      if (birch) pr[1] *= 1.25;
      const colors = k.leaves.map(lin);
      const base = colors[i % colors.length];
      const depth = 1 - out * 0.5; // puffs deep in the crown are darker
      leaves.sphere(pc, pr, {
        detail: 2,
        lump: lumpy(index * 13 + i * 3.7, birch ? 0.18 : 0.13),
        uv: leafUv,
        albedo: (p, n) => {
          // Blossom: mostly pink, a little green showing through.
          const v = 0.9 + 0.2 * Math.sin(p[0] * 3.3 + p[1] * 2.9 + p[2] * 3.7);
          return scale(base, LEAF * v * (0.8 + 0.2 * depth));
        },
      });
      if (out > 0.3 && size > k.puff[0] + (k.puff[1] - k.puff[0]) * 0.3) {
        const from = [top[0], top[1] - 0.4 * r(), top[2]];
        bark.cylinder(from, [pc[0] * 0.7 + from[0] * 0.3, pc[1] - pr[1] * 0.35, pc[2] * 0.7 + from[2] * 0.3], t.trunk * 0.38, t.trunk * 0.12, { sides: 6, albedo: barkAlbedo });
      }
    }
    if (t.kind === 'willow') willowStrands(L, t, [cx, cy, cz], sway, r, light);
  });
}

/**
 * The willow's hanging strands: ribbons from round its crown falling toward the water, swaying.
 * @param {Layout} L
 * @param {Tree} t the willow
 * @param {number[]} c its crown's middle
 * @param {Builder} sway
 * @param {() => number} r random numbers (textures.js's rng), the tree's
 * @param {(p: number[], n: number[], out: number[]) => void} light as buildTrees's
 */
function willowStrands(L, t, c, sway, r, light) {
  sway.lit ??= [];
  const lit = [0, 0, 0];
  const [rx, ry, rz] = t.crown;
  const pale = lin('#86a457'), deep = lin('#4e6d2f');
  for (let i = 0; i < 420; i++) {
    const a = r() * Math.PI * 2;
    const h = -0.25 + r() * 0.8; // where on the crown it hangs from: round its sides, a little under
    const ring = Math.sqrt(1 - h * h);
    const sx = c[0] + Math.cos(a) * rx * ring * (0.8 + 0.25 * r()), sy = c[1] + h * ry, sz = c[2] + Math.sin(a) * rz * ring * (0.8 + 0.25 * r());
    const ground = groundAt(L, sx, sz);
    const water = waterAt(sx, sz).shore < 0 ? waterAt(sx, sz).level : -Infinity;
    const end = Math.max(ground, water) + 0.45 + r() ** 0.7 * 2.2;
    const length = sy - end;
    if (length < 0.6) continue;
    const segs = 6;
    const out = [Math.cos(a), Math.sin(a)];
    const tone = mixc(deep, pale, r());
    const from = sway.count;
    let prev = null;
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      // Out a little, then straight down.
      const bow = 0.35 * Math.sin(f * Math.PI * 0.5);
      const x = sx + out[0] * bow, y = sy - length * f, z = sz + out[1] * bow;
      const w = 0.035 * (1 - f * 0.6);
      const side = [-out[1] * w, out[0] * w];
      const left = [x - side[0], y, z - side[1]], right = [x + side[0], y, z + side[1]];
      if (prev) {
        // One face: the swaying material shows both sides.
        const base = sway.count;
        for (const p of [prev[0], prev[1], right, left]) sway.vertex(p, [out[0], 0, out[1]], [0, 0], tone);
        sway.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      prev = [left, right];
    }
    // Sways more toward its tip. Lit once, half way down, facing out; a little brighter at the top.
    sway.tag('sway', 1, from, (vi) => Math.min(1, (sy - sway.positions[vi * 3 + 1]) / length) * 1.6);
    const n = Math.hypot(out[0], 0.4, out[1]);
    light([sx + out[0] * 0.3, sy - length / 2, sz + out[1] * 0.3], [out[0] / n, 0.4 / n, out[1] / n], lit);
    for (let vi = from; vi < sway.count; vi++) {
      const lift = 1.15 - 0.3 * Math.min(1, (sy - sway.positions[vi * 3 + 1]) / length);
      sway.lit.push(sway.albedo[vi * 3] * lit[0] * lift, sway.albedo[vi * 3 + 1] * lit[1] * lift, sway.albedo[vi * 3 + 2] * lit[2] * lift);
    }
  }
}

/**
 * A run of hedge, as hedgeRuns lays them out: its side (-1 the left, at -x; 1 the right), the x of
 * its inner face (the garden's) and of its outer, and the z it runs from and to.
 * @typedef {{ side: number, inner: number, outer: number, z0: number, z1: number }} HedgeRun
 */

/** The hedges' runs, each side cut where the stream passes. @returns {HedgeRun[]} */
export function hedgeRuns() {
  const runs = [];
  for (const side of [-1, 1]) {
    const inner = side < 0 ? GARDEN.x0 : GARDEN.x1, outer = inner + side * HEDGE.depth;
    // Where the water is at the hedge, keep a gap a little wider than it.
    let gap = null;
    for (let z = -0.2; z > GARDEN.z1 - 0.5; z -= 0.05) {
      if (waterAt(inner + side * 0.6, z).shore < 0.25) gap = gap ? [gap[0], z] : [z, z];
    }
    const spans = gap ? [[0, gap[0] + 0.25], [gap[1] - 0.25, GARDEN.z1 - 0.5]] : [[0, GARDEN.z1 - 0.5]];
    for (const [z0, z1] of spans) runs.push({ side, inner, outer, z0, z1 });
  }
  return runs;
}

/**
 * The hedges: lumpy, leaf-textured boxes along the sides, into `leaves`.
 * @param {Layout} L
 * @param {Builder} leaves
 * @returns {HedgeRun[]} their runs, hedgeRuns's
 */
export function buildHedges(L, leaves) {
  const runs = hedgeRuns();
  const color = lin('#3c5f26'), dark = lin('#2f4c1f');
  /** How far a face bulges out at p (in, where it's below 0). @type {(p: number[]) => number} */
  const bulge = (p) => 0.07 * Math.sin(p[2] * 2.1 + p[1] * 1.3) + 0.05 * Math.sin(p[2] * 5.3 - p[1] * 3.7 + p[0]) + 0.03 * Math.sin(p[2] * 11 + p[1] * 9);
  /** The hedge's top at (x, z), a little uneven. @type {(x: number, z: number) => number} */
  const topAt = (x, z) => groundAt(L, x, z) + HEDGE.height + 0.08 * Math.sin(z * 0.9 + x) + 0.05 * Math.sin(z * 2.3);
  for (const run of runs) {
    const { side, inner, outer, z0, z1 } = run;
    /** The leaves' colour at p, lighter and darker in patches. @type {(p: number[]) => RGB} */
    const albedo = (p) => scale(mixc(dark, color, 0.5 + 0.5 * Math.sin(p[2] * 1.7 + p[1] * 2.2)), LEAF);
    // Each face is laid out from 0 to 1 up (y) and across (x), then moved: how far up and across a point is comes from it.
    /**
     * The height t of the way up a face at (x, z), from a little under the ground to the top.
     * @type {(L: Layout, x: number, z: number, t: number) => number}
     */
    const up = (L, x, z, t) => groundAt(L, x, z) - 0.2 + (topAt(x, z) - groundAt(L, x, z) + 0.2) * t;
    /** x across the run: 0 at its inner face, 1 at its outer. @type {(x: number) => number} */
    const across = (x) => (x - inner) / (outer - inner);
    // The garden side: from below the ground to the top, pushed in and out a little.
    leaves.quad([inner, 0, z0], [0, 0, z1 - z0], [0, 1, 0], {
      seg: 0.22, normal: [-side, 0, 0], uv: (p) => [p[2], p[1]], albedo,
      move: (p) => {
        const z = p[2], t = p[1], y = up(L, inner, z, t);
        return [inner - side * bulge([inner, y, z]) * Math.sin(Math.PI * Math.min(1, t * 1.15)), y, z];
      },
    });
    // The top, rounded over at its edges.
    leaves.quad([inner, 0, z0], [outer - inner, 0, 0], [0, 0, z1 - z0], {
      seg: 0.22, normal: [0, 1, 0], uv: (p) => [p[0], p[2]], albedo,
      move: (p) => [p[0], topAt(p[0], p[2]) + 0.12 * Math.sin(Math.PI * across(p[0])) + 0.04 * Math.sin(p[2] * 4.1 + p[0] * 3), p[2]],
    });
    // Its ends, where it stops by the stream or the wall.
    for (const z of [z0, z1]) {
      if (z === 0) continue; // against the house
      const facing = z === z0 ? 1 : -1;
      leaves.quad([inner, 0, z], [outer - inner, 0, 0], [0, 1, 0], {
        seg: 0.22, normal: [0, 0, facing], uv: (p) => [p[0], p[1]], albedo,
        move: (p) => {
          const t = p[1], y = up(L, p[0], z, t);
          return [p[0], y, z + facing * (0.06 + bulge([p[0], y, z]) * 0.8) * Math.sin(Math.PI * Math.min(1, t * 1.1))];
        },
      });
    }
  }
  return runs;
}

/**
 * Long grass, reeds and wild flowers where a garden leaves them: along the hedges, the far wall and
 * the house, round the trees, on the banks and in the pond's shallows; a few short tufts across
 * the lawn. Into `sway` (each vertex's sway: 0 at its root; its colour pushed to sway.lit).
 * `light(x, z, out)` is the ground's baked light there, which they share.
 * @param {Layout} L
 * @param {Builder} sway
 * @param {(x: number, z: number, out: number[]) => void} light
 */
export function buildGrass(L, sway, light) {
  const r = rng(211);
  const start = sway.count;
  sway.lit ??= [];
  const greens = ['#4f7a2a', '#5c8a31', '#6b9636', '#7aa03f', '#86a84a', '#a3a85b'].map(lin);
  /**
   * A blade rooted at (x, z), h tall and 2w wide at the root, leaning a random way, coloured base
   * there and tip at its tip.
   * @type {(x: number, z: number, h: number, w: number, base: RGB, tip: RGB) => void}
   */
  const blade = (x, z, h, w, base, tip) => {
    const g = groundAt(L, x, z) - 0.02;
    const a = r() * Math.PI * 2, lean = h * (0.15 + 0.3 * r());
    const lx = Math.cos(a), lz = Math.sin(a);
    const px = -lz * w, pz = lx * w;
    const from = sway.count;
    const tipP = [x + lx * lean, g + h, z + lz * lean];
    sway.tri([x - px, g, z - pz], [x + px, g, z + pz], tipP, { normal: [0, 1, 0], albedos: [base, base, tip] });
    sway.tag('sway', 1, from, (vi) => (sway.positions[vi * 3 + 1] > g + h * 0.5 ? 1 : 0) * Math.min(1, h / 0.4));
  };
  /**
   * A tuft of n blades about (x, z), about h tall.
   * @type {(x: number, z: number, h: number, n?: number) => void}
   */
  const tuft = (x, z, h, n = 3) => {
    for (let i = 0; i < n; i++) {
      const base = greens[Math.floor(r() * 3)], tip = greens[2 + Math.floor(r() * 4)];
      blade(x + (r() - 0.5) * 0.08, z + (r() - 0.5) * 0.08, h * (0.6 + 0.5 * r()), 0.012 + 0.01 * r(), scale(base, 0.75), tip);
    }
  };
  /**
   * A flower on a stem h tall at (x, z): `petals` petals `size` long, of `color` (a CSS colour),
   * round a yellow eye.
   * @type {(x: number, z: number, h: number, color: string, size?: number, petals?: number) => void}
   */
  const flower = (x, z, h, color, size = 0.03, petals = 5) => {
    const g = groundAt(L, x, z) + h;
    const stem = lin('#4f7a2a');
    blade(x, z, h, 0.006, stem, stem);
    const from = sway.count;
    const c = lin(color), eye = lin('#e8c43a');
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 + r();
      const b = a + Math.PI / petals;
      sway.tri([x, g, z], [x + Math.cos(a) * size, g + 0.005, z + Math.sin(a) * size], [x + Math.cos(b) * size, g + 0.005, z + Math.sin(b) * size], { normal: [0, 1, 0], albedos: [eye, c, c] });
    }
    sway.tag('sway', 1, from, 1);
  };
  /**
   * A foxglove h tall at (x, z): ten pink bells up the top half of its stem.
   * @type {(x: number, z: number, h: number) => void}
   */
  const foxglove = (x, z, h) => {
    const g = groundAt(L, x, z);
    const stem = lin('#4a7028'), bell = lin(r() < 0.5 ? '#c86aa8' : '#d98bc0');
    blade(x, z, h, 0.01, stem, stem);
    for (let i = 0; i < 10; i++) {
      const y = g + h * (0.45 + 0.5 * (i / 10)), a = i * 2.4, s = 0.035 * (1 - i / 14);
      const from = sway.count;
      sway.tri([x, y + s, z], [x + Math.cos(a) * s, y - s, z + Math.sin(a) * s], [x + Math.cos(a + 1.2) * s, y - s, z + Math.sin(a + 1.2) * s], { normal: [0, 1, 0], albedo: bell });
      sway.tag('sway', 1, from, (y - g) / h);
    }
  };
  /**
   * A reed h tall at (x, z), about a third of them with a bulrush's head.
   * @type {(x: number, z: number, h: number) => void}
   */
  const reed = (x, z, h) => {
    const base = lin('#5f7d3a'), tip = lin('#a9b26a');
    blade(x, z, h, 0.012, base, tip);
    if (r() < 0.35) {
      // A bulrush's brown head.
      const g = groundAt(L, x, z), y = Math.max(g, -0.65) + h * 0.85;
      const from = sway.count;
      sway.cylinder([x, y, z], [x, y + 0.14, z], 0.016, 0.016, { sides: 5, albedo: lin('#5a3b22') });
      sway.tag('sway', 1, from, 0.9);
    }
  };
  /** Whether (x, z) is in the garden or just past it. @type {(x: number, z: number) => boolean} */
  const garden = (x, z) => x > GARDEN.x0 - 0.3 && x < GARDEN.x1 + 0.3 && z < 0.2 && z > GARDEN.z1 - 0.3;
  /**
   * Whether something may grow at (x, z): off the trail and the deck, not by the bench or the
   * door, and out of the water.
   * @type {(x: number, z: number) => boolean}
   */
  const clear = (x, z) => trailWeight(x, z) < 0.35 && !onDeck(x, z) && !nearBench(x, z) && !nearDoor(x, z) && shoreAt(L, x, z) > 0;

  // Along the hedges and the far wall: long grass, daisies, buttercups; foxgloves under the left-hand hedge.
  for (let k = 0; k < 2600; k++) {
    const edge = r();
    let x, z;
    if (edge < 0.38) [x, z] = [GARDEN.x0 + r() ** 1.6 * 0.9, -r() * -GARDEN.z1];
    else if (edge < 0.76) [x, z] = [GARDEN.x1 - r() ** 1.6 * 0.9, -r() * -GARDEN.z1];
    else [x, z] = [GARDEN.x0 + r() * (GARDEN.x1 - GARDEN.x0), GARDEN.z1 + r() ** 1.6 * 0.8];
    if (!clear(x, z)) continue;
    const roll = r();
    if (roll < 0.06) flower(x, z, 0.18 + 0.12 * r(), '#f4f1e6', 0.026, 9); // daisy
    else if (roll < 0.1) flower(x, z, 0.25 + 0.15 * r(), '#f2cf2e', 0.022, 5); // buttercup
    else if (roll < 0.125 && x < 0) foxglove(x, z, 0.8 + 0.45 * r());
    else tuft(x, z, 0.28 + 0.25 * r());
  }
  // At the foot of the house's wall (not across the door's landing).
  for (let k = 0; k < 420; k++) {
    const x = GARDEN.x0 + r() * (GARDEN.x1 - GARDEN.x0), z = -0.05 - r() ** 2 * 0.45;
    if (Math.abs(x) < 1.5 || !clear(x, z)) continue;
    if (r() < 0.08) flower(x, z, 0.2, '#f4f1e6', 0.024, 9);
    else tuft(x, z, 0.16 + 0.16 * r());
  }
  // Round the trees.
  for (const t of TREES) {
    for (let k = 0; k < 120; k++) {
      const a = r() * Math.PI * 2, d = t.trunk + 0.1 + r() ** 1.5 * 1.1;
      const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!garden(x, z) || !clear(x, z)) continue;
      if (t.kind === 'blossom' && r() < 0.3) flower(x, z, 0.012, '#f3d3dc', 0.018, 4); // fallen petals
      else tuft(x, z, 0.14 + 0.16 * r());
    }
  }
  // The banks: long grass and forget-me-nots by the stream; reeds in the pond's shallows.
  for (let k = 0; k < 5200; k++) {
    const x = GARDEN.x0 + r() * (GARDEN.x1 - GARDEN.x0), z = GARDEN.z1 + r() * -GARDEN.z1;
    const w = waterAt(x, z);
    if (w.shore > 1.0 || w.shore < -0.45) continue;
    if (onDeck(x, z) || Math.abs(x - BRIDGE.x) < 0.75 || trailWeight(x, z) > 0.35 || nearBench(x, z)) continue;
    const pond = w.width > 1.4;
    if (w.shore < 0.05) {
      if (pond && w.shore > -0.4 && r() < 0.55) reed(x, z, 0.8 + 0.7 * r());
      continue;
    }
    const roll = r();
    if (roll < 0.07 && !pond) flower(x, z, 0.14 + 0.08 * r(), '#7ea6e0', 0.014, 5); // forget-me-not
    else if (roll < 0.1) flower(x, z, 0.2, '#f2cf2e', 0.02, 5);
    else if (roll < 0.62) tuft(x, z, 0.22 + 0.3 * r() * (1 - w.shore));
  }
  // The trail's edges, and a few short tufts all over the lawn.
  for (let k = 0; k < 1800; k++) {
    const x = GARDEN.x0 + r() * (GARDEN.x1 - GARDEN.x0), z = GARDEN.z1 + r() * -GARDEN.z1;
    const tw = trailWeight(x, z);
    if (tw > 0.25 || shoreAt(L, x, z) < 0.3 || onDeck(x, z) || nearBench(x, z) || nearDoor(x, z)) continue;
    if (tw > 0.04) tuft(x, z, 0.1 + 0.08 * r(), 2);
    else if (r() < 0.45) tuft(x, z, 0.05 + 0.05 * r(), 2);
    else if (r() < 0.04) flower(x, z, 0.05, '#f4f1e6', 0.016, 8);
  }
  // Their light: the ground's under each (their roots), a little brighter up the blades.
  const P = sway.positions, S = sway.extra.sway?.values ?? [];
  const l = [0, 0, 0];
  for (let v = start; v < sway.count; v++) {
    const i = v * 3;
    light(P[i], P[i + 2], l);
    const lift = 1 + 0.25 * Math.min(1, S[v] || 0);
    sway.lit.push(sway.albedo[i] * l[0] * lift, sway.albedo[i + 1] * l[1] * lift, sway.albedo[i + 2] * l[2] * lift);
  }
}

/** Whether (x, z) is by the bench. @param {number} x @param {number} z */
function nearBench(x, z) {
  return Math.hypot(x - BENCH.x, z - BENCH.z) < 1.15;
}
/** Whether (x, z) is by the door. @param {number} x @param {number} z */
function nearDoor(x, z) {
  return Math.hypot(x, z) < 1.3;
}
