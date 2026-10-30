// Builds the garden: the ground, the water, the house and its door back, the trees and hedges,
// the grass, the bridge, the bench, the wall and the sky, as a few merged meshes (one per
// material) with the late afternoon's light baked into their vertices (bake.js). Unlit materials
// and no real-time lights or shadows, as in the hallway, so a headset pays only for textures.
import * as THREE from 'three';
import { GRID, TREES, groundAt, terrain, trailWeight } from './garden.js';
import { Builder } from './builder.js';
import { bake, lightAt, prepare } from './bake.js';
import { buildGrass, buildHedges, buildTrees, hedgeRuns } from './plants.js';
import { buildBench, buildBridge, buildLilies, buildRocks, buildWall, buildWaterGates, hedgeShadows } from './features.js';
import { buildHouse } from './house.js';
import { buildWater } from './water.js';
import { grassTexture, leafTexture, mudTexture, pathTexture, rng } from './textures.js';
import { skyDome, skyTexture } from 'common/sky.js';

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The light of a late afternoon: a warm low sun, a clear sky, and the grass's green bounce. */
export const LIGHT = {
  sun: { color: scale([1.0, 0.8, 0.56], 1.9) },
  sky: scale(lin('#a9c2e2'), 0.72),
  ground: scale(lin('#7c8a4a'), 0.5),
};
/** The haze far off, which the fog fades to. */
export const HAZE = '#d6d3bf';

// The ground's shaders. GROUND_LITE (lite.js 'ground', a TV's) reads less per pixel: the grass's
// large-scale variation once a vertex (it changes over metres; the grid's step is 0.2 m, the
// meadow's 2), and the trail's gravel and the banks' mud only where they are.
const terrainVertex = /* glsl */ `
attribute vec2 splat; // trail, mud
varying vec3 vColor;
varying vec2 vSplat;
varying vec2 vGround;
#ifdef GROUND_LITE
uniform sampler2D uGrass;
varying float vMacro;
#endif
#include <fog_pars_vertex>
void main() {
  vColor = color;
  vSplat = splat;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vGround = w.xz;
#ifdef GROUND_LITE
  // A mipmap level about as coarse as the grid (21 texels to its step), so it doesn't alias.
  vMacro = 0.82 + 0.36 * textureLod(uGrass, vGround / 9.7 + 0.37, 4.5).g;
#endif
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const terrainFragment = /* glsl */ `
uniform sampler2D uGrass;
uniform sampler2D uPath;
uniform sampler2D uMud;
varying vec3 vColor;
varying vec2 vSplat;
varying vec2 vGround;
#ifdef GROUND_LITE
varying float vMacro;
#endif
#include <fog_pars_fragment>
void main() {
  // Grass at two scales, so its repeat doesn't show; then the trail's gravel and the banks' mud over it.
#ifdef GROUND_LITE
  vec3 c = texture2D(uGrass, vGround / 2.2).rgb * vMacro;
  // Where there is none (most of the lawn), neither is read. A branch some pixels of a 2 x 2 block
  // may not take: the mipmap's derivatives are taken before it.
  vec2 gx = dFdx(vGround), gy = dFdy(vGround);
  if (vSplat.x > 0.0) c = mix(c, textureGrad(uPath, vGround / 1.6, gx / 1.6, gy / 1.6).rgb, vSplat.x);
  if (vSplat.y > 0.0) c = mix(c, textureGrad(uMud, vGround / 1.4, gx / 1.4, gy / 1.4).rgb, vSplat.y);
#else
  vec3 grass = texture2D(uGrass, vGround / 2.2).rgb * (0.82 + 0.36 * texture2D(uGrass, vGround / 9.7 + 0.37).g);
  vec3 c = mix(grass, texture2D(uPath, vGround / 1.6).rgb, vSplat.x);
  c = mix(c, texture2D(uMud, vGround / 1.4).rgb, vSplat.y);
#endif
  gl_FragColor = vec4(c * vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/**
 * @param {object} L the garden's layout (garden.js layoutGarden)
 * @param {object} o
 * @param {{ title: string, subtitle: string, sign: string }} o.names what the door back's plaque and sign say
 * @param {string} o.glow its colour
 * @param {number} [o.anisotropy] its textures' anisotropic filtering (main.js's)
 * @param {Set<string>} [o.lite] the lighter versions drawn (lite.js): 'water', 'ground'
 */
export function buildGarden(L, { names, glow, anisotropy = 1, lite = new Set() }) {
  const started = performance.now();
  const group = new THREE.Group();
  group.name = 'garden';
  const add = (geometry, material, name) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };

  // What casts shadows, first: everything is lit knowing about all of it.
  const trim = new Builder(), leaves = new Builder(), sway = new Builder();
  const shadows = [];
  shadows.push(...buildBridge(L, trim), ...buildBench(L, trim), ...buildWall(L, trim));
  const runs = hedgeRuns();
  buildHedges(L, leaves);
  shadows.push(...hedgeShadows(L, runs));
  for (const t of TREES) {
    const gy = groundAt(L, t.x, t.z);
    shadows.push({ kind: 'ellipsoid', c: [t.x, gy + t.crownY, t.z], r: t.crown, density: 0.8 });
    shadows.push({ kind: 'cylinder', x: t.x, z: t.z, r: t.trunk, y0: gy - 0.2, y1: gy + t.crownY - 1 });
  }
  const env = {
    ...LIGHT,
    // The doorway's glow, on the step and the wall and ground round it.
    lights: [{ p: [0, 1.1, -0.35], c: lin(glow), i: 0.9, r: 0.75, wrap: 0.3 }],
    occluders: prepare(shadows),
  };
  const light = (p, n, out) => lightAt(p, n, env, {}, out);
  const lit = (b, o = {}) => bake(b, env, o).toGeometry();
  const lightColor = (p, n) => {
    const c = lightAt(p, n, env, {});
    return new THREE.Color(c[0], c[1], c[2]);
  };
  buildTrees(L, { bark: trim, leaves, sway, light: (p, n, out) => lightAt(p, n, env, { wrap: 0.5 }, out) });
  buildRocks(L, trim);
  buildLilies(L, trim);
  buildWaterGates(L, trim, runs);

  // The ground: the sampled grid, its light baked, grass and gravel and mud blended by vertex.
  const G = L.grid;
  const ground = new Builder();
  const groundLight = new Float32Array(G.nx * G.nz * 3);
  const splat = [];
  {
    const n = [0, 0, 0], l = [0, 0, 0];
    for (let j = 0; j < G.nz; j++) {
      for (let i = 0; i < G.nx; i++) {
        const k = j * G.nx + i, x = G.x0 + i * G.step, z = G.z0 - j * G.step;
        const h = G.h[k];
        const hx = G.h[j * G.nx + Math.min(G.nx - 1, i + 1)] - G.h[j * G.nx + Math.max(0, i - 1)];
        const hz = G.h[Math.max(0, j - 1) * G.nx + i] - G.h[Math.min(G.nz - 1, j + 1) * G.nx + i];
        const ln = Math.hypot(hx, 4 * G.step, hz);
        n[0] = -hx / ln;
        n[1] = (4 * G.step) / ln;
        n[2] = -hz / ln;
        ground.vertex([x, h, z], n);
        lightAt([x, h, z], n, env, {}, l);
        groundLight[k * 3] = l[0];
        groundLight[k * 3 + 1] = l[1];
        groundLight[k * 3 + 2] = l[2];
        splat.push(trailWeight(x, z), 1 - smooth(0.1, 0.45, G.shore[k]));
      }
    }
    for (let j = 0; j + 1 < G.nz; j++) {
      for (let i = 0; i + 1 < G.nx; i++) {
        const a = j * G.nx + i, b = a + 1, c = a + G.nx, d = c + 1;
        // Rows run toward -z, columns toward +x: (a, b, c) is counter-clockwise seen from above.
        ground.indices.push(a, b, c, b, d, c);
      }
    }
  }
  // Beyond it, the meadow round the garden, coarser, with no shadows; a skirt under the seam.
  const meadowFrom = ground.count;
  {
    const S = 2, X = 61, Z0 = 1, Z1 = -61;
    const cols = Math.round((2 * X) / S) + 1, rows = Math.round((Z0 - Z1) / S) + 1;
    const n = [0, 1, 0];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -X + i * S, z = Z0 - j * S;
        ground.vertex([x, terrain(x, z) - 0.02, z], n);
        splat.push(0, 0);
      }
    }
    for (let j = 0; j + 1 < rows; j++) {
      for (let i = 0; i + 1 < cols; i++) {
        const x = -X + i * S, z = Z0 - j * S;
        if (x >= GRID.x0 - 1e-6 && x + S <= GRID.x1 + 1e-6 && z <= GRID.z0 + 1e-6 && z - S >= GRID.z1 - 1e-6) continue;
        const a = meadowFrom + j * cols + i, b = a + 1, c = a + cols, d = c + 1;
        ground.indices.push(a, b, c, b, d, c);
      }
    }
  }
  {
    const e = ground.count;
    const meadowLight = [];
    for (let v = meadowFrom; v < e; v++) {
      const l = lightAt([ground.positions[v * 3], ground.positions[v * 3 + 1], ground.positions[v * 3 + 2]], [0, 1, 0], env, { shadows: false });
      meadowLight.push(l[0], l[1], l[2]);
    }
    const all = new Float32Array(e * 3);
    all.set(groundLight, 0);
    all.set(meadowLight, meadowFrom * 3);
    ground.colors = all;
  }
  const groundGeometry = ground.toGeometry();
  groundGeometry.setAttribute('splat', new THREE.Float32BufferAttribute(splat, 2));
  const terrainMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uGrass: { value: null }, uPath: { value: null }, uMud: { value: null } }]),
    vertexShader: terrainVertex,
    fragmentShader: terrainFragment,
    vertexColors: true,
    fog: true,
  });
  if (lite.has('ground')) terrainMaterial.defines = { GROUND_LITE: '' };
  terrainMaterial.uniforms.uGrass.value = grassTexture();
  terrainMaterial.uniforms.uPath.value = pathTexture();
  terrainMaterial.uniforms.uMud.value = mudTexture();
  const groundMesh = add(groundGeometry, terrainMaterial, 'ground');

  /** The ground's baked light at (x, z) (bilinear on the grid), for what grows from it. */
  const groundLightAt = (x, z, out) => {
    const fx = Math.min(G.nx - 1.001, Math.max(0, (x - G.x0) / G.step)), fz = Math.min(G.nz - 1.001, Math.max(0, (G.z0 - z) / G.step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    for (let c = 0; c < 3; c++) {
      const a = groundLight[(j * G.nx + i) * 3 + c], b = groundLight[(j * G.nx + i + 1) * 3 + c];
      const d = groundLight[((j + 1) * G.nx + i) * 3 + c], e = groundLight[((j + 1) * G.nx + i + 1) * 3 + c];
      out[c] = (a * (1 - u) + b * u) * (1 - v) + (d * (1 - u) + e * u) * v;
    }
    return out;
  };
  buildGrass(L, sway, groundLightAt);
  distantTrees(leaves, trim);

  // The house, and the door back in it.
  const house = buildHouse(L, { names, glow, trim, lit, lightColor, anisotropy });
  group.add(house.group);

  // Merged and lit: the untextured things, the leaves, the swaying grass.
  add(lit(trim), new THREE.MeshBasicMaterial({ vertexColors: true }), 'trim');
  // Leaves take the sun a little round their sides: light comes through them.
  add(lit(leaves, { wrap: 0.5 }), new THREE.MeshBasicMaterial({ map: leafTexture(), vertexColors: true }), 'leaves');
  sway.colors = Float32Array.from(sway.lit);
  // Blades and strands are single sheets, seen from either side.
  const swayMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const time = { value: 0 };
  swayMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        float phase = position.x * 0.9 + position.z * 0.7;
        float gust = 0.6 + 0.4 * sin(uTime * 0.37 + position.x * 0.08);
        transformed.x += sway * gust * (0.03 * sin(uTime * 1.6 + phase) + 0.012 * sin(uTime * 3.7 + phase * 2.3));
        transformed.z += sway * gust * 0.022 * sin(uTime * 1.3 + phase * 1.4);`);
  };
  add(sway.toGeometry(), swayMaterial, 'grass');

  // The water, and the sky over it all.
  const sky = skyTexture();
  const water = buildWater(env, sky, { rippleMap: lite.has('water') });
  group.add(water.mesh);
  const dome = skyDome(sky);
  group.add(dome);
  // What costs most a pixel is drawn after what stands in front of it, so the depth test passes
  // over what is hidden: the water (over the stream's bed), then the ground (under the hedges, the
  // trees, the house and the grass), then the sky, which common's sky.js draws first, but which
  // tests depth and is farther than everything (the dome's 90 m against the meadow's 83 m at most,
  // from anywhere one can stand), so only what shows of it is drawn. The same picture, a quarter
  // less work for the GPU (README, "The TV app").
  water.mesh.renderOrder = 1;
  groundMesh.renderOrder = 2;
  dome.renderOrder = 3;

  console.info(`outside: the garden built in ${Math.round(performance.now() - started)} ms`);
  return {
    group, layout: L, house, panel: house.panel, water, sky: dome, env, lightColor,
    /** Per frame: the water flows, the grass sways, the doorway's veil drifts. */
    update(t, dt, head, hoverDoor) {
      time.value = t;
      water.update(t);
      house.update(t, dt, head, hoverDoor);
    },
  };
}

/** Trees beyond the hedges and the far wall: crowns over the hedge tops, a wood behind the meadow. */
function distantTrees(leaves, trim) {
  const r = rng(401);
  const spots = [];
  for (let k = 0; k < 120 && spots.length < 40; k++) {
    const a = r();
    let x, z;
    // The edge of a wood across the meadow behind the far wall, and trees beyond the hedges.
    if (a < 0.55) [x, z] = [(r() - 0.5) * 90, -34 - r() * 18];
    else if (a < 0.78) [x, z] = [-14 - r() * 14, -2 - r() * 26];
    else [x, z] = [14 + r() * 14, -2 - r() * 26];
    if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 4.5)) continue;
    spots.push([x, z]);
    const h = 6 + r() * 6, gy = terrain(x, z);
    const tone = lin(['#4d6b2c', '#5a7633', '#44602a', '#62803a'][Math.floor(r() * 4)]);
    trim.cylinder([x, gy - 0.2, z], [x, gy + h * 0.55, z], 0.25 + 0.1 * r(), 0.15, { sides: 6, albedo: lin('#4f4337') });
    // A broad crown, low on its trunk, the next one's running into it.
    for (let i = 0; i < 4; i++) {
      const pr = 2.4 + r() * 1.8;
      leaves.sphere([x + (r() - 0.5) * 4, gy + h * 0.72 + (r() - 0.3) * 2.2, z + (r() - 0.5) * 4], [pr, pr * 0.8, pr], {
        detail: 1,
        lump: (d) => 1 + 0.12 * Math.sin(d[0] * 3 + i) * Math.sin(d[2] * 2.6 + x),
        uv: (p) => [p[0] * 0.5, p[1] * 0.5],
        albedo: scale(tone, 1.9 * (0.9 + 0.2 * r())),
      });
    }
  }
}

