// Builds the garden's static geometry in world coordinates: subdivided quads, boxes (along the
// axes or any three of their own), tapered cylinders, lumpy spheres and loose triangles, each
// vertex with an albedo, so bake.js can light them per vertex. One Builder becomes one mesh (one
// draw call). The hallway's Builder (quad, box) with what a garden needs added.
import * as THREE from 'three';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/** An icosphere's unit directions and triangles, by subdivision level (cached). */
const ICO = new Map();
function icosphere(detail) {
  if (ICO.has(detail)) return ICO.get(detail);
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const mid = new Map();
    const midpoint = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mid.has(key)) {
        mid.set(key, verts.length);
        verts.push(norm(add(verts[a], verts[b])));
      }
      return mid.get(key);
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const out = { verts, faces };
  ICO.set(detail, out);
  return out;
}

export class Builder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.albedo = [];
    this.indices = [];
    this.extra = {}; // further attributes by name: { size, values }
    this.colors = null; // filled by bake()
  }

  get count() {
    return this.positions.length / 3;
  }

  /** Adds a vertex; returns its index. */
  vertex(p, n, uv = [0, 0], albedo = [1, 1, 1]) {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.uvs.push(uv[0], uv[1]);
    this.albedo.push(albedo[0], albedo[1], albedo[2]);
    return this.count - 1;
  }

  /** Sets a further attribute (`name`, `size` floats each) for every vertex added since `from`. */
  tag(name, size, from, value) {
    const a = (this.extra[name] ??= { size, values: [] });
    while (a.values.length < from * size) a.values.push(...new Array(size).fill(0));
    for (let i = from; i < this.count; i++) {
      const v = typeof value === 'function' ? value(i) : value;
      if (size === 1) a.values[i] = v;
      else for (let k = 0; k < size; k++) a.values[i * size + k] = v[k];
    }
    return this;
  }

  /**
   * A rectangle from corner o along u and v, subdivided into cells of at most `seg` metres.
   * Its front faces u × v; `normal` flips it to face that way instead. Texture coordinates are
   * `uv(point)` when given (world-mapped surfaces), else 0…1 along u and v. `move(point, s, t)`
   * may displace each vertex (returning the new point); `albedo` may be a function of the point.
   */
  quad(o, u, v, { seg = 0.3, normal = null, uv = null, albedo = [1, 1, 1], move = null } = {}) {
    let n = cross(u, v);
    if (normal && dot(n, normal) < 0) {
      [u, v] = [v, u];
      n = cross(u, v);
    }
    n = norm(n);
    const nu = Math.max(1, Math.ceil(length(u) / seg));
    const nv = Math.max(1, Math.ceil(length(v) / seg));
    const base = this.count;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const s = i / nu, t = j / nv;
        let p = [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
        if (move) p = move(p, s, t);
        this.vertex(p, n, uv ? uv(p) : [s, t], typeof albedo === 'function' ? albedo(p) : albedo);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i;
        const b = a + 1, c = a + nu + 2, d = a + nu + 1;
        this.indices.push(a, b, c, a, c, d);
      }
    }
    return this;
  }

  /** An axis-aligned box from min to max; `skip` names faces left out ('+x', '-y', …). */
  box(min, max, { skip = [], seg = 0.6, albedo, uv = null } = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const o = { seg, albedo, uv };
    if (!skip.includes('+x')) this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], { ...o, normal: [1, 0, 0] });
    if (!skip.includes('-x')) this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], { ...o, normal: [-1, 0, 0] });
    if (!skip.includes('+y')) this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], { ...o, normal: [0, 1, 0] });
    if (!skip.includes('-y')) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], { ...o, normal: [0, -1, 0] });
    if (!skip.includes('+z')) this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], { ...o, normal: [0, 0, 1] });
    if (!skip.includes('-z')) this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], { ...o, normal: [0, 0, -1] });
    return this;
  }

  /**
   * A box about centre c along its own three half-extent vectors a, b, h (at right angles):
   * a plank tilted along a curve, a bench's slat. `skip` lists the faces left out, by axis
   * and sign ('+a', '-h', …). `jitter(p)` may move each corner (a rough stone).
   */
  cuboid(c, a, b, h, { albedo = [1, 1, 1], skip = [], jitter = null } = {}) {
    const corner = (sa, sb, sh) => {
      const p = [c[0] + a[0] * sa + b[0] * sb + h[0] * sh, c[1] + a[1] * sa + b[1] * sb + h[1] * sh, c[2] + a[2] * sa + b[2] * sb + h[2] * sh];
      return jitter ? jitter(p) : p;
    };
    // The eight corners, so faces share any jitter.
    const k = {};
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) for (const sh of [-1, 1]) k[`${sa}${sb}${sh}`] = corner(sa, sb, sh);
    const face = (name, n, p0, p1, p2, p3) => {
      if (skip.includes(name)) return;
      const nn = norm(cross([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]]));
      const flip = dot(nn, n) < 0;
      const base = this.count;
      const col = typeof albedo === 'function' ? albedo(n) : albedo;
      for (const p of [p0, p1, p2, p3]) this.vertex(p, flip ? [-nn[0], -nn[1], -nn[2]] : nn, [0, 0], col);
      if (flip) this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const neg = (v) => [-v[0], -v[1], -v[2]];
    face('+a', a, k['1-1-1'], k['11-1'], k['111'], k['1-11']);
    face('-a', neg(a), k['-1-1-1'], k['-1-11'], k['-111'], k['-11-1']);
    face('+b', b, k['-11-1'], k['-111'], k['111'], k['11-1']);
    face('-b', neg(b), k['-1-1-1'], k['1-1-1'], k['1-11'], k['-1-11']);
    face('+h', h, k['-1-11'], k['1-11'], k['111'], k['-111']);
    face('-h', neg(h), k['-1-1-1'], k['-11-1'], k['11-1'], k['1-1-1']);
    return this;
  }

  /**
   * A tapered cylinder from point p0 (radius r0) to p1 (radius r1), `sides` round, `rings`
   * along; without its end caps unless `caps`. `albedo` may be a function (point, along 0…1, angle).
   */
  cylinder(p0, p1, r0, r1, { sides = 8, rings = 1, albedo = [1, 1, 1], caps = false, wobble = null } = {}) {
    const axis = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const w = norm(axis);
    const up = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(up, w)), v = cross(w, u);
    const slope = (r0 - r1) / (length(axis) || 1);
    const base = this.count;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, r = r0 + (r1 - r0) * t;
      const c = add(p0, axis, t);
      for (let i = 0; i <= sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const rr = wobble ? r * wobble(t, ang) : r;
        const dir = [u[0] * ca + v[0] * sa, u[1] * ca + v[1] * sa, u[2] * ca + v[2] * sa];
        const p = add(c, dir, rr);
        const n = norm(add(dir, w, slope));
        this.vertex(p, n, [i / sides, t], typeof albedo === 'function' ? albedo(p, t, ang) : albedo);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < sides; i++) {
        // Around (a → b) then along (a → d): counter-clockwise seen from outside.
        const a = base + j * (sides + 1) + i, b = a + 1, c = a + sides + 2, d = a + sides + 1;
        this.indices.push(a, b, c, a, c, d);
      }
    }
    if (caps) {
      for (const [end, r, sign] of [[p0, r0, -1], [p1, r1, 1]]) {
        const n = [w[0] * sign, w[1] * sign, w[2] * sign];
        const col = typeof albedo === 'function' ? albedo(end, sign > 0 ? 1 : 0, 0) : albedo;
        const centre = this.vertex(end, n, [0.5, 0.5], col);
        const ring = this.count;
        for (let i = 0; i < sides; i++) {
          const ang = (i / sides) * Math.PI * 2;
          this.vertex(add(end, [u[0] * Math.cos(ang) + v[0] * Math.sin(ang), u[1] * Math.cos(ang) + v[1] * Math.sin(ang), u[2] * Math.cos(ang) + v[2] * Math.sin(ang)], r), n, [0, 0], col);
        }
        for (let i = 0; i < sides; i++) {
          const a = ring + i, b = ring + ((i + 1) % sides);
          if (sign > 0) this.indices.push(centre, a, b);
          else this.indices.push(centre, b, a);
        }
      }
    }
    return this;
  }

  /**
   * A sphere about c with half sizes r ([x, y, z]), subdivided `detail` times, each vertex moved
   * out along its direction by `lump(direction)` (a factor, 1 = none). Texture coordinates are
   * `uv(point, normal)` when given. `albedo` may be a function (point, normal).
   */
  sphere(c, r, { detail = 1, lump = null, albedo = [1, 1, 1], uv = null } = {}) {
    const { verts, faces } = icosphere(detail);
    const base = this.count;
    const pts = verts.map((d) => {
      const k = lump ? lump(d) : 1;
      return [c[0] + d[0] * r[0] * k, c[1] + d[1] * r[1] * k, c[2] + d[2] * r[2] * k];
    });
    // Normals from the moved surface: the sum of its faces' around each vertex.
    const ns = verts.map(() => [0, 0, 0]);
    for (const [a, b, cc] of faces) {
      const pa = pts[a], pb = pts[b], pc = pts[cc];
      const fn = cross([pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]]);
      for (const k of [a, b, cc]) {
        ns[k][0] += fn[0];
        ns[k][1] += fn[1];
        ns[k][2] += fn[2];
      }
    }
    pts.forEach((p, i) => {
      const n = norm(ns[i]);
      this.vertex(p, n, uv ? uv(p, n) : [0, 0], typeof albedo === 'function' ? albedo(p, n) : albedo);
    });
    for (const [a, b, cc] of faces) this.indices.push(base + a, base + b, base + cc);
    return this;
  }

  /** One triangle (a, b, c counter-clockwise from its front), with a normal of its own or given. */
  tri(a, b, c, { normal = null, albedo = [1, 1, 1], albedos = null } = {}) {
    const n = normal || norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
    const base = this.count;
    this.vertex(a, n, [0, 0], albedos ? albedos[0] : albedo);
    this.vertex(b, n, [1, 0], albedos ? albedos[1] : albedo);
    this.vertex(c, n, [0.5, 1], albedos ? albedos[2] : albedo);
    this.indices.push(base, base + 1, base + 2);
    return this;
  }

  /** Appends another builder's vertices and triangles. */
  append(other) {
    const base = this.count;
    this.positions.push(...other.positions);
    this.normals.push(...other.normals);
    this.uvs.push(...other.uvs);
    this.albedo.push(...other.albedo);
    for (const i of other.indices) this.indices.push(base + i);
    return this;
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors ?? this.albedo, 3));
    for (const [name, a] of Object.entries(this.extra)) {
      while (a.values.length < this.count * a.size) a.values.push(0);
      g.setAttribute(name, new THREE.Float32BufferAttribute(a.values, a.size));
    }
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.indices, 1) : new THREE.Uint16BufferAttribute(this.indices, 1));
    g.computeBoundingSphere();
    return g;
  }
}
