// The house: the hallway's building seen from the garden. Its wall is the plane z = 0, of red brick
// with a stone plinth, string course and cornice, four sash windows warm with the hall's lamps
// behind them, a slate roof and chimneys; in it, the door back, in a stone doorcase, under the
// hallway's enamel sign, its plaque beside it and the control panel the other side. The doorway
// glows like the hallway's own doorways and shows the hall through it: the view the hallway
// publishes out of its door to here (common's README, "The view from your door"), or a picture of
// our own when that can't be read.
import * as THREE from 'three';
import { HOUSE, PANEL, PLAQUE } from './garden.js';
import { Builder } from './builder.js';
import { BRICK_TILE, brickTexture, plaqueTexture, previewFallback, signTexture, windowTexture } from './textures.js';
import { ControlPanel } from './panel.js';
import { viewParams } from 'common/door.js';
import { openingGeometry, placePortal, portalMaterial, setView } from 'common/portal.js';

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const STONE = lin('#cdbf9f'), PLASTER = lin('#d6cab0'), PAINT = lin('#ece7dc'), WOOD = lin('#6a4329'), DARK_WOOD = lin('#3e2617');
const SLATE = ['#4b525b', '#434951', '#535a62', '#3f454c'].map(lin), CHIMNEY = lin('#8a4430');

/** The wall reaches past the hedges either side, and down under the ground. */
const X0 = -13.5, X1 = 13.5, BOTTOM = -0.8, PLINTH = 0.28;
const CORNICE = HOUSE.height - 0.36;

/**
 * @param {object} L the garden's layout
 * @param {object} o
 * @param {{ title: string, subtitle: string, sign: string }} o.names what the door's plaque and sign say
 * @param {string} o.glow the doorway's colour, '#rrggbb'
 * @param {Builder} o.trim the untextured, vertex-coloured builder (stone, paint, wood)
 * @param {(b: Builder, o?: object) => THREE.BufferGeometry} o.lit bakes a builder's light, returns its geometry
 * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the light at a point
 * @param {number} [o.anisotropy] its textures' anisotropic filtering
 */
export function buildHouse(L, { names, glow, trim, lit, lightColor, anisotropy = 1 }) {
  const group = new THREE.Group();
  group.name = 'house';
  const dw = L.door.width, dh = L.door.height, R = L.door.reveal;
  const W = HOUSE.window;
  const box = (min, max, albedo, skip) => trim.box(min, max, { albedo, skip });

  // The brick face, round the door and the windows.
  const openings = [{ x0: -dw / 2, x1: dw / 2, y0: BOTTOM, y1: dh }, ...HOUSE.windows.map((x) => ({ x0: x - W.width / 2, x1: x + W.width / 2, y0: W.sill, y1: W.top }))];
  const bricks = new Builder();
  const brickUv = (p) => [p[0] / BRICK_TILE, p[1] / BRICK_TILE];
  const xs = [...new Set([X0, X1, ...openings.flatMap((o) => [o.x0, o.x1])])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    const xa = xs[i], xb = xs[i + 1];
    const cut = openings.filter((o) => o.x0 <= xa + 1e-6 && o.x1 >= xb - 1e-6).sort((a, b) => a.y0 - b.y0);
    let y = PLINTH;
    for (const o of [...cut, { y0: CORNICE, y1: CORNICE }]) {
      const y0 = Math.max(y, PLINTH);
      if (o.y0 > y0 + 1e-6) bricks.quad([xa, y0, 0], [xb - xa, 0, 0], [0, o.y0 - y0, 0], { normal: [0, 0, -1], uv: brickUv, seg: 0.45 });
      y = Math.max(y, o.y1);
    }
  }
  // The plinth (with a gap for the doorstep), the string course and the cornice, in stone.
  box([X0, BOTTOM, -0.05], [-dw / 2 - 0.16, PLINTH, 0], STONE);
  box([dw / 2 + 0.16, BOTTOM, -0.05], [X1, PLINTH, 0], STONE);
  box([X0, 3.22, -0.05], [X1, 3.36, 0], STONE);
  box([X0, CORNICE, -0.07], [X1, CORNICE + 0.12, 0], STONE);
  box([X0, CORNICE + 0.12, -0.15], [X1, CORNICE + 0.24, 0], STONE);
  box([X0, CORNICE + 0.24, -0.24], [X1, HOUSE.height, 0], STONE);
  // The roof, sloping back from the cornice, in rows of slates; two chimneys on it.
  const roofTop = 7.7, roofBack = 4.6;
  trim.quad([X0, HOUSE.height, -0.24], [X1 - X0, 0, 0], [0, roofTop - HOUSE.height, roofBack + 0.24], {
    seg: 0.3, normal: [0, 0.8, -0.6],
    albedo: (p) => SLATE[Math.abs(Math.floor((p[1] - HOUSE.height) / 0.12) * 7 + Math.floor(p[0] / 0.3 + (Math.floor((p[1] - HOUSE.height) / 0.12) % 2) * 0.5)) % SLATE.length],
  });
  for (const cx of [-5.6, 6.1]) {
    const z0 = 2.6, y0 = HOUSE.height + ((z0 + 0.24) / (roofBack + 0.24)) * (roofTop - HOUSE.height) - 0.4;
    box([cx - 0.45, y0, z0], [cx + 0.45, roofTop + 1.1, z0 + 0.7], CHIMNEY, ['-y']);
    box([cx - 0.52, roofTop + 1.1, z0 - 0.07], [cx + 0.52, roofTop + 1.22, z0 + 0.77], STONE);
    for (const px of [cx - 0.22, cx + 0.22]) trim.cylinder([px, roofTop + 1.22, z0 + 0.35], [px, roofTop + 1.6, z0 + 0.35], 0.11, 0.09, { sides: 8, albedo: lin('#a65a3a'), caps: true });
  }

  // The windows: reveals, stone sills and lintels, white sashes, the glass.
  const glass = new Builder();
  for (const wx of HOUSE.windows) {
    const x0 = wx - W.width / 2, x1 = wx + W.width / 2, deep = 0.22;
    trim.quad([x0, W.sill, 0], [0, 0, deep], [0, W.top - W.sill, 0], { normal: [1, 0, 0], albedo: PLASTER });
    trim.quad([x1, W.sill, 0], [0, 0, deep], [0, W.top - W.sill, 0], { normal: [-1, 0, 0], albedo: PLASTER });
    trim.quad([x0, W.top, 0], [W.width, 0, 0], [0, 0, deep], { normal: [0, -1, 0], albedo: PLASTER });
    trim.quad([x0, W.sill, 0], [W.width, 0, 0], [0, 0, deep], { normal: [0, 1, 0], albedo: PLASTER });
    box([x0 - 0.08, W.sill - 0.08, -0.07], [x1 + 0.08, W.sill, 0.02], STONE);
    box([x0 - 0.1, W.top, -0.03], [x1 + 0.1, W.top + 0.2, 0], STONE);
    box([wx - 0.08, W.top - 0.03, -0.05], [wx + 0.08, W.top + 0.26, 0], STONE);
    glass.quad([x0, W.sill, deep - 0.02], [W.width, 0, 0], [0, W.top - W.sill, 0], { normal: [0, 0, -1], seg: 2 });
    const z0 = deep - 0.08, z1 = deep - 0.02, f = 0.055, bar = 0.014, midY = (W.sill + W.top) / 2;
    box([x0, W.sill, z0], [x0 + f, W.top, z1], PAINT);
    box([x1 - f, W.sill, z0], [x1, W.top, z1], PAINT);
    box([x0, W.top - f, z0], [x1, W.top, z1], PAINT);
    box([x0, W.sill, z0], [x1, W.sill + f * 1.4, z1], PAINT);
    box([x0, midY - 0.03, z0 - 0.03], [x1, midY + 0.03, z1], PAINT); // the meeting rail
    box([wx - bar, W.sill, z0], [wx + bar, W.top, z1], PAINT);
    for (const y of [(W.sill + midY) / 2, (midY + W.top) / 2]) box([x0, y - bar, z0], [x1, y + bar, z1], PAINT);
  }
  const glassMesh = new THREE.Mesh(lit(glass, { scale: 1.25 }), new THREE.MeshBasicMaterial({ map: windowTexture(), vertexColors: true }));
  glassMesh.name = 'windows';
  group.add(glassMesh);
  const brickMesh = new THREE.Mesh(lit(bricks), new THREE.MeshBasicMaterial({ map: brickTexture(), vertexColors: true }));
  brickMesh.name = 'brick';
  group.add(brickMesh);

  // The doorway: its lining, the step, the doorcase round it and the hood over it.
  trim.quad([-dw / 2, 0, 0], [0, 0, R], [0, dh, 0], { normal: [1, 0, 0], albedo: WOOD });
  trim.quad([dw / 2, 0, 0], [0, 0, R], [0, dh, 0], { normal: [-1, 0, 0], albedo: WOOD });
  trim.quad([-dw / 2, dh, 0], [dw, 0, 0], [0, 0, R], { normal: [0, -1, 0], albedo: WOOD });
  box([-dw / 2 - 0.14, -0.16, -0.32], [dw / 2 + 0.14, 0.0, R + 0.05], STONE);
  for (const s of [-1, 1]) {
    box([s < 0 ? -dw / 2 - 0.17 : dw / 2, 0, -0.06], [s < 0 ? -dw / 2 : dw / 2 + 0.17, dh + 0.12, 0], STONE);
    box([s * (dw / 2 + 0.2) - 0.06, dh - 0.02, -0.16], [s * (dw / 2 + 0.2) + 0.06, dh + 0.12, 0], STONE);
  }
  box([-dw / 2 - 0.32, dh + 0.12, -0.2], [dw / 2 + 0.32, dh + 0.3, 0], STONE);
  box([-dw / 2 - 0.36, dh + 0.3, -0.24], [dw / 2 + 0.36, dh + 0.36, 0], STONE);

  // The sign over it and the plaque beside it, in the hallway's enamel; backed with dark wood.
  const signs = [];
  const sign = (map, w, h, x, y, name) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, color: lightColor([x, y, -0.02], [0, 0, -1]) }));
    mesh.position.set(x, y, -0.016);
    mesh.rotation.y = Math.PI;
    mesh.name = name;
    group.add(mesh);
    signs.push(mesh);
    return mesh;
  };
  const signY = dh + 0.36 + 0.2;
  box([-0.44, signY - 0.155, -0.014], [0.44, signY + 0.155, 0], DARK_WOOD);
  sign(signTexture(names.sign), 0.84, 0.27, 0, signY, 'sign');
  box([PLAQUE.x - PLAQUE.width / 2 - 0.02, PLAQUE.y - PLAQUE.height / 2 - 0.02, -0.012], [PLAQUE.x + PLAQUE.width / 2 + 0.02, PLAQUE.y + PLAQUE.height / 2 + 0.02, 0], DARK_WOOD);
  sign(plaqueTexture(names.title, names.subtitle), PLAQUE.width - 0.04, PLAQUE.height - 0.04, PLAQUE.x, PLAQUE.y, 'plaque');

  // The control panel, in a wooden frame.
  box([PANEL.x - PANEL.width / 2 - 0.025, PANEL.y - PANEL.height / 2 - 0.025, -(PANEL.depth - 0.004)], [PANEL.x + PANEL.width / 2 + 0.025, PANEL.y + PANEL.height / 2 + 0.025, 0], DARK_WOOD);
  const panel = new ControlPanel({ anisotropy, color: lightColor([PANEL.x, PANEL.y, -0.05], [0, 0, -1]) });
  group.add(panel.mesh);

  // The portal in the doorway, at the back of its lining, facing the garden.
  const fallback = previewFallback(names.sign, glow);
  const material = portalMaterial({ map: fallback, width: dw, height: dh, depth: 2.4, pictureHeight: 3, eye: 1.6, horizon: 0.56, color: glow });
  const portal = new THREE.Mesh(openingGeometry(dw, dh), material);
  portal.name = 'portal';
  portal.position.set(0, 0, R);
  portal.rotation.y = Math.PI;
  group.add(portal);
  placePortal(portal);
  let glowing = 0;

  /**
   * Shows a view through the doorway: the first of `sources` ({ views: views.json's address, id })
   * that can be read and checked, in place of the glow and the name. Resolves to which, or null.
   */
  async function loadView(sources) {
    for (const source of sources) {
      try {
        const res = await fetch(source.views, { cache: 'no-cache' });
        const v = res.ok ? viewParams((await res.json())?.views?.[source.id]) : null;
        if (!v) continue;
        const map = await new THREE.TextureLoader().loadAsync(new URL(v.image, res.url).href);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = anisotropy;
        setView(material, map, v);
        fallback.dispose();
        return source;
      } catch (err) {
        console.info(`outside: no view through the door from ${source.views} (${err.message})`);
      }
    }
    return null;
  }

  return {
    group, portal, panel, signs, loadView,
    /** Per frame: the veil drifts, and the doorway brightens when pointed at or stood near. */
    update(time, dt, head, hover) {
      const near = head.z > -1.8 && Math.abs(head.x) < 1.6;
      const target = hover ? 1 : near ? 0.45 : 0;
      glowing += (target - glowing) * (1 - Math.exp(-dt * 7));
      material.uniforms.uGlow.value = glowing;
      material.uniforms.uTime.value = time;
    },
  };
}
