// The garden's layout: the water and its banks, the bridge, walking, finding the way and rays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCH, BOOK, BRIDGE, BRIDGE_ENDS, GARDEN, HOUSE, PANEL, PANEL_BUTTONS, PANEL_PX, PLAQUE, TRAIL_LINE, TREES,
  castRay, clampWalk, clearPath, deckHeight, doorCrossed, doorSpawn, dry, groundAt, layoutGarden,
  onDeck, panelButtonAt, route, shoreAt, sideOf, standable, surfaceAt, terrain, trailDistance, waterAt, waterLevel,
} from '../public/js/garden.js';

const L = layoutGarden();
const hit = {};
/** A ray from o toward the point p (or along d, normalized here). */
function ray(o, { to, d }) {
  const v = to ? [to[0] - o[0], to[1] - o[1], to[2] - o[2]] : d;
  const n = Math.hypot(...v);
  return castRay(L, o[0], o[1], o[2], v[0] / n, v[1] / n, v[2] / n, hit);
}

/** Points over the garden, every `step` metres. */
function* garden(step = 0.25) {
  for (let x = GARDEN.x0 + GARDEN.margin; x <= GARDEN.x1 - GARDEN.margin; x += step) {
    for (let z = GARDEN.z1 + GARDEN.margin; z <= -GARDEN.margin; z += step) yield [x, z];
  }
}

test('the water lies in its bed: the ground is under its surface in it and above it on land', () => {
  for (const [x, z] of garden(0.2)) {
    const w = waterAt(x, z);
    const h = terrain(x, z);
    if (w.shore < -0.05) assert.ok(h < w.level, `bed at (${x}, ${z}) is ${h}, above the water ${w.level}`);
    if (w.shore > 0.45) assert.ok(h > w.level + 0.15, `bank at (${x}, ${z}) is ${h}, too near the water ${w.level}`);
  }
});

test('the water runs downhill: from the right-hand hedge to the pond and on out at the left', () => {
  let last = Infinity;
  for (let x = 12; x >= -12; x -= 0.5) {
    const l = waterLevel(x);
    assert.ok(l <= last + 1e-9, `level rises at x = ${x}`);
    last = l;
  }
  assert.ok(waterLevel(10) - waterLevel(-4) > 0.25);
});

test('the water splits the garden in two: the house on one side, the bench on the other', () => {
  assert.equal(sideOf(L.spawn.x, L.spawn.z), 1);
  assert.equal(sideOf(BENCH.x, BENCH.z), -1);
  // Across the garden from hedge to hedge there is water somewhere between the house and the far wall.
  for (let x = GARDEN.x0 + 0.3; x <= GARDEN.x1 - 0.3; x += 0.5) {
    let wet = false;
    for (let z = -0.5; z >= GARDEN.z1 + 0.3 && !wet; z -= 0.05) wet = !dry(L, x, z) && !onDeck(x, z);
    assert.ok(wet || Math.abs(x - BRIDGE.x) <= BRIDGE.width / 2, `no water to cross at x = ${x}`);
  }
});

test('the bridge stands on both banks and clears the water', () => {
  assert.ok(waterAt(BRIDGE.x, BRIDGE.zA).shore > 0.6, 'near end on land');
  assert.ok(waterAt(BRIDGE.x, BRIDGE.zB).shore > 0.6, 'far end on land');
  // Its ends meet the ground with no more than a plank's step.
  assert.ok(Math.abs(deckHeight(L, BRIDGE.zA) - terrain(BRIDGE.x, BRIDGE.zA)) < 0.1);
  assert.ok(Math.abs(deckHeight(L, BRIDGE.zB) - terrain(BRIDGE.x, BRIDGE.zB)) < 0.1);
  for (let z = BRIDGE.zA; z >= BRIDGE.zB; z -= 0.1) {
    // Over the water it clears it well; at its ends it rests on the banks.
    if (waterAt(BRIDGE.x, z).shore < 0.2) assert.ok(deckHeight(L, z) > waterLevel(BRIDGE.x) + 0.45, `deck at z = ${z} near the water`);
    assert.ok(deckHeight(L, z) > terrain(BRIDGE.x, z), `deck at z = ${z} under the bank`);
    assert.equal(groundAt(L, BRIDGE.x, z), deckHeight(L, z));
  }
  const mid = (BRIDGE.zA + BRIDGE.zB) / 2;
  assert.ok(deckHeight(L, mid) > deckHeight(L, BRIDGE.zA) + 0.3, 'it arches');
});

test('a visitor\'s ring lies on top: on the lawn, on the deck, on the water where it covers the edge', () => {
  assert.equal(surfaceAt(L, -1, -3), groundAt(L, -1, -3), 'the lawn');
  const mid = (BRIDGE.zA + BRIDGE.zB) / 2;
  assert.equal(surfaceAt(L, BRIDGE.x, mid), deckHeight(L, mid), 'the deck, over the water');
  let wet = 0;
  for (let x = GARDEN.x0 + 0.5; x <= GARDEN.x1 - 0.5; x += 0.1) {
    for (let z = -1; z >= GARDEN.z1 + 0.5; z -= 0.1) {
      if (!standable(L, x, z)) continue;
      const y = surfaceAt(L, x, z), w = waterAt(x, z);
      assert.ok(y >= groundAt(L, x, z), `in the ground at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      // The water's surface runs 0.4 m on under the banks (water.js).
      if (w.shore < 0.4) assert.ok(y >= w.level, `under the water at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      if (y > groundAt(L, x, z)) wet++;
    }
  }
  assert.ok(wet > 0, 'a visitor can stand at the water\'s very edge, and the ring is on the water there');
});

test('the trail is dry all the way, but where the bridge carries it', () => {
  for (let i = 0; i + 1 < TRAIL_LINE.length; i++) {
    const [ax, az] = TRAIL_LINE[i], [bx, bz] = TRAIL_LINE[i + 1];
    for (let t = 0; t <= 1; t += 0.1) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      assert.ok(dry(L, x, z), `trail wet at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
  assert.ok(trailDistance(0, -0.5) < 0.1, 'it starts at the door');
  assert.ok(trailDistance(L.benchFront.x, L.benchFront.z) < 0.6, 'it ends at the bench');
});

test('trees, the bench and the arrival stand on dry land, clear of the trail and of each other', () => {
  for (const t of TREES) {
    assert.ok(waterAt(t.x, t.z).shore > 1, `${t.kind} at (${t.x}, ${t.z}) in or by the water`);
    assert.ok(trailDistance(t.x, t.z) > 2, `${t.kind} on the trail`);
    assert.ok(t.x > GARDEN.x0 + 0.8 && t.x < GARDEN.x1 - 0.8 && t.z < -1 && t.z > GARDEN.z1 + 0.8, `${t.kind} outside the garden`);
    assert.ok(Math.hypot(t.x - BENCH.x, t.z - BENCH.z) > 1.5, `${t.kind} on the bench`);
  }
  assert.ok(waterAt(BENCH.x, BENCH.z).shore > 1, 'bench by the water, not in it');
  assert.ok(standable(L, L.spawn.x, L.spawn.z), 'arrival');
  assert.ok(standable(L, L.benchFront.x, L.benchFront.z), 'in front of the bench');
});

test('the house wall: the door, the plaque, the panel and the windows keep clear of each other', () => {
  const door = [-L.door.width / 2 - 0.15, L.door.width / 2 + 0.15];
  const spans = [
    ['plaque', PLAQUE.x - PLAQUE.width / 2, PLAQUE.x + PLAQUE.width / 2],
    ['panel', PANEL.x - PANEL.width / 2, PANEL.x + PANEL.width / 2],
    ...HOUSE.windows.map((x) => ['window', x - HOUSE.window.width / 2 - 0.12, x + HOUSE.window.width / 2 + 0.12]),
  ];
  for (const [name, a, b] of spans) assert.ok(b < door[0] || a > door[1], `${name} overlaps the door`);
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const [na, a0, a1] = spans[i], [nb, b0, b1] = spans[j];
      assert.ok(a1 < b0 || b1 < a0, `${na} overlaps ${nb}`);
    }
  }
});

test('walking stays in the garden: hedges, the far wall, the house beside the door', () => {
  const out = {};
  clampWalk(L, 0, -5, -20, -5, out);
  assert.equal(out.x, GARDEN.x0 + GARDEN.margin);
  clampWalk(L, 5, -2, 5, 3, out);
  assert.equal(out.z, -GARDEN.margin, 'the wall beside the door');
  clampWalk(L, 0, -16, 0, -30, out);
  assert.equal(out.z, GARDEN.z1 + GARDEN.margin);
});

test('the doorway lets a head through, between its jambs, and that is going back in', () => {
  const out = {};
  let x = 0.1, z = -0.8;
  for (let i = 0; i < 40 && !doorCrossed(L, x, z); i++) {
    clampWalk(L, x, z, x, z + 0.05, out);
    x = out.x;
    z = out.z;
  }
  assert.ok(doorCrossed(L, x, z), 'walked in');
  clampWalk(L, 0.2, 0.1, 1.5, 0.1, out);
  assert.ok(Math.abs(out.x) < L.door.width / 2, 'kept between the jambs');
  assert.ok(!doorCrossed(L, 0, -0.6), 'not on arriving');
  assert.ok(!doorCrossed(L, 1.2, 0.2), 'not beside the door');
});

test('the water stops a walker, and the bridge takes them over', () => {
  const out = {};
  // Straight at the stream away from the bridge: stopped at its edge, still dry.
  let x = 6, z = -5;
  for (let i = 0; i < 200; i++) {
    clampWalk(L, x, z, x, z - 0.05, out);
    x = out.x;
    z = out.z;
  }
  assert.ok(dry(L, x, z));
  assert.equal(sideOf(x, z), 1, 'still on the house side');
  // Over the bridge.
  x = BRIDGE_ENDS.near[0];
  z = BRIDGE_ENDS.near[1];
  for (let i = 0; i < 200; i++) {
    clampWalk(L, x, z, x, z - 0.05, out);
    x = out.x;
    z = out.z;
  }
  assert.equal(sideOf(x, z), -1, 'across');
  // Off the side of the deck: kept between the rails.
  const mid = (BRIDGE.zA + BRIDGE.zB) / 2;
  clampWalk(L, BRIDGE.x, mid, BRIDGE.x + 1, mid, out);
  assert.ok(Math.abs(out.x - BRIDGE.x) <= BRIDGE.walk + 1e-9);
});

test('trunks and the bench stand in the way', () => {
  const out = {};
  for (const t of TREES) {
    clampWalk(L, t.x + 1, t.z, t.x, t.z, out);
    assert.ok(Math.hypot(out.x - t.x, out.z - t.z) >= t.trunk + 0.2, `walked into the ${t.kind}`);
  }
  clampWalk(L, L.benchFront.x, L.benchFront.z, BENCH.x, BENCH.z, out);
  assert.ok(Math.hypot(out.x - BENCH.x, out.z - BENCH.z) > 0.3, 'walked into the bench');
});

/** Whether walking the points from (x, z) goes over the bridge's deck, between its rails. */
function overBridge(x, z, pts) {
  let deck = false;
  for (const [px, pz] of pts) {
    for (let t = 0; t <= 1; t += 0.02) {
      const sx = x + (px - x) * t, sz = z + (pz - z) * t;
      if (onDeck(sx, sz) && Math.abs(sx - BRIDGE.x) <= BRIDGE.walk + 1e-9) deck = true;
    }
    x = px;
    z = pz;
  }
  return deck;
}

test('the way to the bench goes over the bridge, and back again', () => {
  const pts = route(L, L.spawn.x, L.spawn.z, L.benchFront.x, L.benchFront.z);
  assert.deepEqual(pts.at(-1), [L.benchFront.x, L.benchFront.z]);
  assert.ok(overBridge(L.spawn.x, L.spawn.z, pts), JSON.stringify(pts));
  assert.ok(pts.length <= 6, `${pts.length} turns`);
  const back = route(L, L.benchFront.x, L.benchFront.z, L.spawn.x, L.spawn.z);
  assert.ok(overBridge(L.benchFront.x, L.benchFront.z, back));
  // On the same side, with nothing between: straight there.
  assert.deepEqual(route(L, 0, -1, 4, -2), [[4, -2]]);
  // Somewhere one cannot stand (the water): as near it as one can.
  const wet = route(L, L.spawn.x, L.spawn.z, -4, -8.4);
  assert.ok(wet.length && standable(L, ...wet.at(-1)));
  assert.ok(Math.hypot(wet.at(-1)[0] + 4, wet.at(-1)[1] + 8.4) > 1.5);
});

test('every way found keeps out of the water', () => {
  // Seeded points, all of them somewhere to stand.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const points = [];
  while (points.length < 60) {
    const x = GARDEN.x0 + 0.4 + rand() * (GARDEN.x1 - GARDEN.x0 - 0.8);
    const z = GARDEN.z1 + 0.4 + rand() * (-GARDEN.z1 - 0.8);
    if (standable(L, x, z)) points.push([x, z]);
  }
  points.push([BRIDGE.x, (BRIDGE.zA + BRIDGE.zB) / 2]); // on the deck
  for (const a of points) {
    for (const b of points.slice(0, 12)) {
      const pts = route(L, a[0], a[1], b[0], b[1]);
      let from = a;
      for (const p of pts) {
        assert.ok(clearPath(L, from[0], from[1], p[0], p[1]), `(${a}) → (${b}): wet between (${from}) and (${p})`);
        from = p;
      }
      assert.deepEqual(pts.at(-1), b);
    }
  }
});

test('rays: the ground, the door, the panel, the bench, the book, the water, the hedge, the sky', () => {
  const eye = [0, GARDEN.eye, -0.6];
  assert.equal(ray(eye, { d: [0, -1, -1] }).kind, 'ground');
  assert.ok(hit.walkable);
  assert.equal(ray([0, 1.6, -3], { to: [0.1, 1.2, 0] }).kind, 'door');
  assert.equal(ray([0, 1.6, -3], { to: [3, 1.2, 0] }).kind, 'wall');
  const p = ray([PANEL.x, PANEL.y, -2], { d: [0, 0, 1] });
  assert.equal(p.kind, 'panel');
  assert.ok(Math.abs(p.u - 0.5) < 1e-6 && Math.abs(p.v - 0.5) < 1e-6);
  // The panel reads left to right for someone facing it: their left (+x) is u = 0.
  ray([PANEL.x, PANEL.y, -2], { to: [PANEL.x + 0.2, PANEL.y + 0.2, 0] });
  assert.ok(hit.kind === 'panel' && hit.u < 0.5 && hit.v > 0.5);
  assert.equal(ray([BENCH.x, 1.6, -10], { to: [BENCH.x, L.bench.y + 0.3, BENCH.z] }).kind, 'bench');
  assert.equal(ray([L.book.x, 1.6, L.book.z + 0.8], { to: [L.book.x, L.book.y + BOOK.thickness, L.book.z] }).kind, 'book');
  assert.equal(ray([-4, 1.6, -4.5], { to: [-4, 0, -8.4] }).kind, 'water');
  assert.ok(!hit.walkable);
  assert.equal(ray([0, 1.2, -5], { d: [-1, 0, 0] }).kind, 'hedge');
  assert.equal(ray([0, 1.0, -12], { d: [0, -0.05, -1] }).kind, 'wall');
  assert.equal(ray(eye, { d: [0, 1, -1] }), null);
  // The deck is ground, and somewhere to stand.
  const mid = (BRIDGE.zA + BRIDGE.zB) / 2;
  assert.equal(ray([BRIDGE.x, 2.2, mid + 1.5], { to: [BRIDGE.x, deckHeight(L, mid), mid] }).kind, 'ground');
  assert.ok(hit.walkable);
});

test('the panel buttons: the hallway\'s, then the accessibility settings, then the session', () => {
  const at = (x, y) => panelButtonAt(x / PANEL_PX.width, 1 - y / PANEL_PX.height);
  assert.equal(at(256, 100), 'vr');
  assert.equal(at(230, 190), 'move:teleport');
  assert.equal(at(410, 265), 'turn:smooth');
  assert.equal(at(210, 380), 'motion:system');
  assert.equal(at(320, 380), 'motion:reduce');
  assert.equal(at(430, 380), 'motion:full');
  assert.equal(at(230, 457), 'vignette:on');
  assert.equal(at(410, 533), 'seated:off');
  assert.equal(at(256, 660), 'session');
  assert.equal(panelButtonAt(0.02, 0.02), null);
  // Each inside the canvas, none overlapping another, and as tall and as wide as a finger needs.
  for (const [id, x0, y0, x1, y1] of PANEL_BUTTONS) {
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= PANEL_PX.width && y1 <= PANEL_PX.height, id);
    assert.ok(x1 - x0 >= 100 && y1 - y0 >= 54, id);
    for (const [other, a0, b0, a1, b1] of PANEL_BUTTONS) {
      if (other !== id) assert.ok(x1 <= a0 || a1 <= x0 || y1 <= b0 || b1 <= y0, `${id} overlaps ${other}`);
    }
  }
  // The canvas's pixels are square on the panel.
  assert.ok(Math.abs(PANEL.width / PANEL.height - PANEL_PX.width / PANEL_PX.height) < 1e-9);
});

test('arriving: the doorway position within the jambs, the turn within ±90°, on dry ground', () => {
  assert.deepEqual(doorSpawn(L), L.spawn);
  const s = doorSpawn(L, 5, 3);
  assert.ok(Math.abs(s.x) < L.door.width / 2);
  assert.equal(s.yaw, Math.PI / 2);
  assert.ok(dry(L, s.x, s.z) && standable(L, s.x, s.z));
  // A wider doorway from the link: a wider place to come out.
  const wide = layoutGarden({ doorWidth: 1.6 });
  assert.ok(doorSpawn(wide, 0.5).x === 0.5);
  assert.ok(Math.abs(groundAt(L, 0, -0.6)) < 0.05, 'level with the threshold');
  assert.ok(shoreAt(L, 0, -0.6) > 4);
});
