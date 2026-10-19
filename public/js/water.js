// The water: one ribbon along the stream, from the right-hand hedge through the pond and out at the
// left, lying at the water's level and reaching a little under the banks (the ground hides its
// edges). Its shader ripples it, flowing downstream in the stream and stirred by the wind on the
// pond, reflects the sky (the same picture as the dome, sky.js), catches the sun where the baked
// shadows let it, and is brown over the shallows and dark green-blue over the deep.
import * as THREE from 'three';
import { STREAM_X, farWidth, nearWidth, streamAt, waterDepth, waterLevel } from './garden.js';
import { SUN_DIR, sunlit } from './bake.js';
import { Builder } from './builder.js';
import { SKY_UV } from './sky.js';

const vertexShader = /* glsl */ `
attribute vec3 flow;   // travel (s, from where it comes in), across (m, + toward the house), calm (1 on the pond)
attribute vec2 tangent; // which way it flows, in x and z
attribute vec2 water;  // deep (0 at the edge … 1 in the pond's middle), sun (how much reaches it)
varying vec3 vWorld;
varying vec3 vFlow;
varying vec2 vTangent;
varying vec2 vWater;
#include <fog_pars_vertex>
void main() {
  vFlow = flow;
  vTangent = tangent;
  vWater = water;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uSky;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
varying vec3 vWorld;
varying vec3 vFlow;
varying vec2 vTangent;
varying vec2 vWater;
#include <fog_pars_fragment>
${SKY_UV}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// The stream's ripples, in metres along (carried down at its own speed) and across it.
float stream(vec2 p) {
  return noise(p * vec2(2.2, 4.0)) * 0.6 + noise(p * vec2(5.1, 7.3) + 3.1) * 0.3 + noise(p * 11.0 + 7.7) * 0.1;
}
// The pond's: small wind ripples drifting across it.
float pond(vec2 p, float t) {
  return noise(p * 3.1 + vec2(t * 0.35, t * 0.12)) * 0.55 + noise(p * 6.7 - vec2(t * 0.2, -t * 0.31)) * 0.3 + noise(p * 14.0 + vec2(t * 0.5, 0.0)) * 0.15;
}

void main() {
  float calm = vFlow.z;
  // The surface's slope, from either pattern, blended between stream and pond.
  vec2 along = vec2((vFlow.x - uTime) * 0.4, vFlow.y);
  float e = 0.04;
  float hs = stream(along);
  vec2 gs = vec2(stream(along + vec2(e, 0.0)) - hs, stream(along + vec2(0.0, e)) - hs) / e;
  vec2 across = vec2(vTangent.y, -vTangent.x);
  vec2 slopeStream = (gs.x * vTangent + gs.y * across) * 0.035;
  float hp = pond(vWorld.xz, uTime);
  vec2 gp = vec2(pond(vWorld.xz + vec2(e, 0.0), uTime) - hp, pond(vWorld.xz + vec2(0.0, e), uTime) - hp) / e;
  vec2 slope = mix(slopeStream, gp * 0.012, calm);
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

  float deep = vWater.x, sun = vWater.y;
  vec3 toEye = normalize(cameraPosition - vWorld);
  vec3 r = reflect(-toEye, n);
  r.y = abs(r.y);
  // What it reflects: the banks, hedges and trees round it (dark green, and they stand high round
  // a small pond); only looking steeply down does it show the open sky overhead.
  vec3 sky = texture2D(uSky, skyUv(r)).rgb;
  vec3 round = vec3(0.03, 0.05, 0.025) * (0.6 + 0.6 * sun);
  vec3 seen = mix(round, sky, smoothstep(0.35, 0.8, r.y));
  float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(n, toEye), 0.0), 5.0);

  vec3 shallow = vec3(0.05, 0.055, 0.03);
  vec3 depths = vec3(0.008, 0.026, 0.026);
  vec3 body = mix(shallow, depths, smoothstep(0.0, 0.8, deep)) * (uAmbient + uSunColor * sun * 0.6);
  // Where the stream runs fast and shallow, a little white water on the ripples' crests.
  float white = (1.0 - calm) * smoothstep(0.72, 0.9, hs) * (1.0 - smoothstep(0.0, 0.5, deep)) * 0.12;
  body += vec3(white);
  vec3 col = mix(body, seen, clamp(fresnel * 0.85 + 0.06, 0.0, 1.0));
  // The sun on it: glints, and a broader sheen.
  float s = max(dot(r, uSun), 0.0);
  col += uSunColor * sun * (pow(s, 900.0) * 6.0 + pow(s, 90.0) * 0.35);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/**
 * The water's mesh and material. `env` is the baked lighting's (for its shadows on the water).
 * @returns {{ mesh: THREE.Mesh, update(time: number): void }}
 */
export function buildWater(env, skyMap) {
  const b = new Builder();
  const STEP = 0.2, ACROSS = 22, UNDER = 0.4; // under the banks
  const xs = [];
  for (let x = STEP_X(STREAM_X[1]); x >= STREAM_X[0] - 1e-6; x -= STEP) xs.push(x);
  const s = { z: 0, dz: 0 };
  let travel = 0, lastX = null, lastZ = null;
  const flow = [], tangent = [], water = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    streamAt(x, s);
    const k = 1 / Math.sqrt(1 + s.dz * s.dz);
    const near = nearWidth(x), far = farWidth(x), width = near + far;
    // Narrow runs fast, the pond hardly at all.
    const speed = Math.min(0.5, 0.62 / width);
    if (lastX !== null) travel += Math.hypot(x - lastX, s.z - lastZ) / speed;
    lastX = x;
    lastZ = s.z;
    const calm = Math.min(1, Math.max(0, (width - 1.6) / 1.6));
    const level = waterLevel(x), depth = waterDepth(x);
    // Downstream is toward -x: (-1, -dz), normalized.
    const tx = -k, tz = -s.dz * k;
    for (let j = 0; j <= ACROSS; j++) {
      const a = -(far + UNDER) + ((width + 2 * UNDER) * j) / ACROSS; // + toward the house
      const p = [x - s.dz * k * a, level, s.z + k * a];
      b.vertex(p, [0, 1, 0]);
      const reach = a >= 0 ? near : far;
      const u = Math.min(1, Math.abs(a) / reach);
      flow.push(travel, a, calm);
      tangent.push(tx, tz);
      water.push(Math.max(0, 1 - u * u) * (depth / 0.76), 0);
    }
  }
  const cols = ACROSS + 1;
  // Columns run toward -x, rows toward +z: (a, c, c + 1) is counter-clockwise seen from above.
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j < ACROSS; j++) {
      const a = i * cols + j, c = a + cols;
      b.indices.push(a, c, c + 1, a, c + 1, a + 1);
    }
  }
  // The baked shadows on it: how much sun reaches each vertex.
  const lit = sunlit(b, env);
  for (let i = 0; i < lit.length; i++) water[i * 2 + 1] = lit[i];
  const g = b.toGeometry();
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 3));
  g.setAttribute('tangent', new THREE.Float32BufferAttribute(tangent, 2));
  g.setAttribute('water', new THREE.Float32BufferAttribute(water, 2));
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uSky: { value: null },
        uTime: { value: 0 },
        uSun: { value: new THREE.Vector3(...SUN_DIR) },
        uSunColor: { value: new THREE.Color(...env.sun.color) },
        uAmbient: { value: new THREE.Color(...env.sky) },
      },
    ]),
    vertexShader,
    fragmentShader,
    fog: true,
  });
  material.uniforms.uSky.value = skyMap;
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'water';
  return {
    mesh,
    update(time) {
      material.uniforms.uTime.value = time;
    },
  };
}

/** The first column at or under x on the 0.2 m grid. */
function STEP_X(x) {
  return Math.floor(x / 0.2) * 0.2;
}
