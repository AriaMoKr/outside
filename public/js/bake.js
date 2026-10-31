// Lighting baked into vertex colours once, when the garden is built: a low late-afternoon sun with
// soft shadows (the trees' crowns let some of it through, by how much leaf it passes; trunks, the
// hedges, the walls, the bench and the bridge stop it), the sky's light, less of it under the
// trees and against walls, light thrown back off the grass, and coloured point lights as in the
// hallway (the doorway's glow). Nothing is lit per frame, so a headset pays only for textures.
// The sun is where common's sky (sky.js) paints it: SUN_DIR, low in the west, over the bench's
// right shoulder, in front of the house.
import { SUN_DIR } from 'common/sky.js';

/**
 * Something that shades, by its kind: an ellipsoid centred at c with radii r (a tree's crown), an
 * upright cylinder at x, z of radius r from y0 up to y1 (a trunk), or a box from its corner min to
 * max (a hedge, a wall, the bench, the bridge). With a density it lets light through as
 * exp(-density × the length of it crossed), as the crowns and the hedges do; without one it is
 * opaque. bc and br are its bounding sphere, which prepare gives it (Prepared).
 * @typedef {({ kind: 'ellipsoid', c: number[], r: number[] } | { kind: 'cylinder', x: number, z: number, r: number, y0: number, y1: number } | { kind: 'box', min: number[], max: number[] }) & { density?: number, bc?: number[], br?: number }} Occluder
 * @typedef {Occluder & { bc: number[], br: number }} Prepared
 */
/**
 * What the garden is lit by (scene.js's env): the sun's colour, shining from SUN_DIR; the sky's
 * light on a surface facing up and the ground's on one facing down; the point lights, as the
 * hallway's (at p, colour c, intensity i, half as bright at distance r, reaching wrap round a
 * surface's side: 0.1 unless given); and what shades, prepared. Each colour is an RGB: r, g, b,
 * linear, as three.js's Color holds them (water.js makes Colors of the sun's and the sky's).
 * @typedef {[number, number, number]} RGB
 * @typedef {{ p: number[], c: RGB, i: number, r: number, wrap?: number }} Light
 * @typedef {{ sun: { color: RGB }, sky: RGB, ground: RGB, lights: Light[], occluders: Prepared[] }} Env
 */

/** @type {(x: number, y: number, z: number) => [number, number, number]} */
const normalize = (x, y, z) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

/** Directions the sun's light is sampled from (its disc and a little penumbra), for soft shadows. */
const SUN_SAMPLES = (() => {
  const [x, y, z] = SUN_DIR;
  const u = normalize(-z, 0, x), v = [y * u[2] - z * u[1], z * u[0] - x * u[2], x * u[1] - y * u[0]];
  const k = 0.03; // about 1.7°
  const out = [SUN_DIR];
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out.push(normalize(x + (u[0] * a + v[0] * b) * k, y + (u[1] * a + v[1] * b) * k, z + (u[2] * a + v[2] * b) * k));
  return out;
})();

/** Directions the sky's light is gathered from: overhead, and a ring at 40°. */
const SKY_SAMPLES = (() => {
  const out = [[0, 1, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    out.push(normalize(Math.cos(a) * 0.77, 0.64, Math.sin(a) * 0.77));
  }
  return out;
})();

/**
 * Bounding spheres, so a ray far from an occluder skips it.
 * @param {Occluder[]} occluders
 * @returns {Prepared[]}
 */
export function prepare(occluders) {
  for (const o of occluders) {
    if (o.kind === 'ellipsoid') {
      o.bc = o.c;
      o.br = Math.max(...o.r);
    } else if (o.kind === 'cylinder') {
      o.bc = [o.x, (o.y0 + o.y1) / 2, o.z];
      o.br = Math.hypot(o.r, (o.y1 - o.y0) / 2);
    } else {
      o.bc = [(o.min[0] + o.max[0]) / 2, (o.min[1] + o.max[1]) / 2, (o.min[2] + o.max[2]) / 2];
      o.br = Math.hypot(o.max[0] - o.min[0], o.max[1] - o.min[1], o.max[2] - o.min[2]) / 2;
    }
  }
  return /** @type {Prepared[]} */ (occluders); // each has its sphere now
}

/**
 * How much of the ray from p along d (a unit vector) passes through o: the length inside it (0 when it misses).
 * @param {Prepared} o
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 */
function chord(o, px, py, pz, dx, dy, dz) {
  // Skip it when the ray passes far from its bounding sphere, or it is behind.
  const cx = o.bc[0] - px, cy = o.bc[1] - py, cz = o.bc[2] - pz;
  const along = cx * dx + cy * dy + cz * dz;
  if (along < -o.br) return 0;
  const miss2 = cx * cx + cy * cy + cz * cz - along * along;
  if (miss2 > o.br * o.br) return 0;
  let t0 = 0, t1 = Infinity;
  if (o.kind === 'ellipsoid') {
    const rx = o.r[0], ry = o.r[1], rz = o.r[2];
    const qx = (px - o.c[0]) / rx, qy = (py - o.c[1]) / ry, qz = (pz - o.c[2]) / rz;
    const ex = dx / rx, ey = dy / ry, ez = dz / rz;
    const a = ex * ex + ey * ey + ez * ez, b = qx * ex + qy * ey + qz * ez, c = qx * qx + qy * qy + qz * qz - 1;
    const disc = b * b - a * c;
    if (disc <= 0) return 0;
    const s = Math.sqrt(disc);
    t0 = Math.max(0, (-b - s) / a);
    t1 = (-b + s) / a;
  } else if (o.kind === 'cylinder') {
    const qx = px - o.x, qz = pz - o.z;
    const a = dx * dx + dz * dz, b = qx * dx + qz * dz, c = qx * qx + qz * qz - o.r * o.r;
    if (a < 1e-9) {
      if (c > 0) return 0;
    } else {
      const disc = b * b - a * c;
      if (disc <= 0) return 0;
      const s = Math.sqrt(disc);
      t0 = Math.max(0, (-b - s) / a);
      t1 = (-b + s) / a;
    }
    // Within its height.
    if (Math.abs(dy) < 1e-9) {
      if (py < o.y0 || py > o.y1) return 0;
    } else {
      const ya = (o.y0 - py) / dy, yb = (o.y1 - py) / dy;
      t0 = Math.max(t0, Math.min(ya, yb));
      t1 = Math.min(t1, Math.max(ya, yb));
    }
  } else {
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? px : k === 1 ? py : pz, d = k === 0 ? dx : k === 1 ? dy : dz;
      const lo = o.min[k], hi = o.max[k];
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) return 0;
        continue;
      }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) {
        const s = a;
        a = b;
        b = s;
      }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
    }
  }
  return t1 > t0 ? t1 - t0 : 0;
}

/**
 * How much light gets from p along d past all the occluders (1 all of it, 0 none).
 * @param {Prepared[]} occluders
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 */
export function transmittance(occluders, px, py, pz, dx, dy, dz) {
  let t = 1;
  for (const o of occluders) {
    const l = chord(o, px, py, pz, dx, dy, dz);
    if (l <= 0) continue;
    if (o.density === undefined) {
      if (l > 0.002) return 0;
    } else {
      t *= Math.exp(-o.density * l);
      if (t < 0.01) return 0;
    }
  }
  return t;
}

/**
 * Light (linear RGB) arriving at point p with normal n: the sky's (less where occluders hide it),
 * the ground's bounce, the sun's (as much of it as gets through) and the point lights'.
 * Writes into out.
 * @param {number[]} p
 * @param {number[]} n
 * @param {Env} env
 * @param {{ wrap?: number, shadows?: boolean }} [o] wrap: how far round its side a surface takes the sun (leaves: some); shadows: false skips them
 * @param {number[]} [out]
 */
export function lightAt(p, n, env, { wrap = 0, shadows = true } = {}, out = [0, 0, 0]) {
  const lift = 0.03; // off the surface, so it doesn't shade itself
  const px = p[0] + n[0] * lift, py = p[1] + n[1] * lift, pz = p[2] + n[2] * lift;
  // The sky, gathered over the directions that face the surface.
  let seen = 0, weight = 0;
  for (const d of SKY_SAMPLES) {
    const w = n[0] * d[0] + n[1] * d[1] + n[2] * d[2] + 0.25;
    if (w <= 0) continue;
    weight += w;
    seen += w * (shadows ? transmittance(env.occluders, px, py, pz, d[0], d[1], d[2]) : 1);
  }
  const open = weight > 0 ? seen / weight : 1;
  const h = 0.5 + 0.5 * n[1];
  let r = (env.ground[0] + (env.sky[0] - env.ground[0]) * h) * (0.35 + 0.65 * open);
  let g = (env.ground[1] + (env.sky[1] - env.ground[1]) * h) * (0.35 + 0.65 * open);
  let b = (env.ground[2] + (env.sky[2] - env.ground[2]) * h) * (0.35 + 0.65 * open);
  // The sun.
  const facing = (n[0] * SUN_DIR[0] + n[1] * SUN_DIR[1] + n[2] * SUN_DIR[2] + wrap) / (1 + wrap);
  if (facing > 0) {
    let lit = 0;
    if (shadows) {
      for (const d of SUN_SAMPLES) lit += transmittance(env.occluders, px, py, pz, d[0], d[1], d[2]);
      lit /= SUN_SAMPLES.length;
    } else lit = 1;
    const k = facing * lit;
    r += env.sun.color[0] * k;
    g += env.sun.color[1] * k;
    b += env.sun.color[2] * k;
  }
  for (const L of env.lights) {
    const dx = L.p[0] - p[0], dy = L.p[1] - p[1], dz = L.p[2] - p[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    const d = Math.sqrt(d2) || 1e-6;
    const w = L.wrap ?? 0.1;
    const f = ((n[0] * dx + n[1] * dy + n[2] * dz) / d + w) / (1 + w);
    if (f <= 0) continue;
    const k = (L.i * f) / (1 + d2 / (L.r * L.r));
    r += L.c[0] * k;
    g += L.c[1] * k;
    b += L.c[2] * k;
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return out;
}

/**
 * Fills builder.colors with albedo × light. `normal` lights every vertex as if it faced that way
 * (grass blades: as the ground they grow from); `wrap` as lightAt; `scale` brightens or darkens.
 * Returns the builder: a Builder (builder.js), or anything with its positions, normals, albedo
 * and colors.
 * @template {{ positions: number[], normals: number[], albedo: number[], colors: Float32Array | null }} B
 * @param {B} builder
 * @param {Env} env
 * @param {{ normal?: number[] | null, wrap?: number, scale?: number, shadows?: boolean }} [o]
 * @returns {B}
 */
export function bake(builder, env, { normal = null, wrap = 0, scale = 1, shadows = true } = {}) {
  const { positions: P, normals: N, albedo: A } = builder;
  const colors = new Float32Array(P.length);
  const p = [0, 0, 0], n = [0, 0, 0], light = [0, 0, 0];
  const o = { wrap, shadows };
  for (let i = 0; i < P.length; i += 3) {
    p[0] = P[i]; p[1] = P[i + 1]; p[2] = P[i + 2];
    if (normal) {
      n[0] = normal[0]; n[1] = normal[1]; n[2] = normal[2];
    } else {
      n[0] = N[i]; n[1] = N[i + 1]; n[2] = N[i + 2];
    }
    lightAt(p, n, env, o, light);
    colors[i] = A[i] * light[0] * scale;
    colors[i + 1] = A[i + 1] * light[1] * scale;
    colors[i + 2] = A[i + 2] * light[2] * scale;
  }
  builder.colors = colors;
  return builder;
}

/**
 * How much sun reaches each of a builder's vertices (0…1), for a material that lights itself (the water).
 * @param {{ positions: number[] }} builder
 * @param {Env} env
 */
export function sunlit(builder, env) {
  const P = builder.positions, out = new Float32Array(P.length / 3);
  for (let i = 0, k = 0; i < P.length; i += 3, k++) {
    let lit = 0;
    for (const d of SUN_SAMPLES) lit += transmittance(env.occluders, P[i], P[i + 1] + 0.03, P[i + 2], d[0], d[1], d[2]);
    out[k] = lit / SUN_SAMPLES.length;
  }
  return out;
}
