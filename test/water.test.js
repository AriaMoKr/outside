// A TV's water (public/js/water.js): the ripples' picture repeats, and the slope kept in it is its
// value's, as the shader reads them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RIPPLE, rippleData } from '../public/js/water.js';

const N = RIPPLE.cells * RIPPLE.perCell;
const data = rippleData();
/** @param {number} x @param {number} y */
const px = (x, y) => (((y + N) % N) * N + ((x + N) % N)) * 4;
// As the shader reads them: the value, and the slope per cell.
/** @param {number} x @param {number} y */
const value = (x, y) => data[px(x, y)] / 255;
/** @param {number} x @param {number} y @param {1 | 2} ch green, across x, or blue, across y */
const slope = (x, y, ch) => (data[px(x, y) + ch] / 255 - 0.5) * 2 * RIPPLE.slope;

test('the picture: square, opaque, the same every time, and not flat', () => {
  assert.equal(data.length, N * N * 4);
  assert.deepEqual(rippleData(), data);
  assert.notDeepEqual(rippleData(7), data);
  let lo = 1, hi = 0;
  for (let i = 0; i < N * N; i++) {
    assert.equal(data[i * 4 + 3], 255);
    lo = Math.min(lo, data[i * 4] / 255);
    hi = Math.max(hi, data[i * 4] / 255);
  }
  assert.ok(lo < 0.15 && hi > 0.85, `the values run from ${lo} to ${hi}`);
});

test('its slope is its value’s, across the edges too, so it repeats without a seam', () => {
  // The value's step to the next pixel against the slopes either side of it, per cell. Eight bits
  // keep a value to 1/255, which is 8/255 of slope over a pixel an eighth of a cell wide; and the
  // noise bends most sharply at its cells' edges. The picture's own edges are cells' edges like the
  // rest: no worse there.
  const worst = { inside: 0, cellEdge: 0, wrap: 0 };
  /** @param {number} a @param {number} b @param {number} s */
  const off = (a, b, s) => Math.abs((b - a) * RIPPLE.perCell - s);
  /** @param {number} i */
  const where = (i) => (i === N - 1 ? 'wrap' : i % RIPPLE.perCell === RIPPLE.perCell - 1 ? 'cellEdge' : 'inside');
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ex = off(value(x, y), value(x + 1, y), (slope(x, y, 1) + slope(x + 1, y, 1)) / 2);
      const ey = off(value(x, y), value(x, y + 1), (slope(x, y, 2) + slope(x, y + 1, 2)) / 2);
      worst[where(x)] = Math.max(worst[where(x)], ex);
      worst[where(y)] = Math.max(worst[where(y)], ey);
    }
  }
  assert.ok(worst.inside < 0.06, `inside a cell the slope is off by ${worst.inside}`);
  assert.ok(worst.cellEdge < 0.15, `at a cell's edge the slope is off by ${worst.cellEdge}`);
  assert.ok(worst.wrap <= worst.cellEdge, `across the picture's edge the slope is off by ${worst.wrap}, more than at the other cells' edges`);
});

test('the shader reads the picture as it is made: its size and its slope', () => {
  const src = readFileSync(new URL('../public/js/water.js', import.meta.url), 'utf8');
  assert.match(src, /texture2D\(uRipples, p \* \(1\.0 \/ \$\{RIPPLE\.cells\.toFixed\(1\)\}\)\)/);
  assert.match(src, /\(t\.gb - 0\.5\) \* \$\{\(2 \* RIPPLE\.slope\)\.toFixed\(1\)\}/);
  // The slope is a smooth step's: never steeper than RIPPLE.slope, so nothing is clipped.
  for (let i = 0; i < N * N; i++) {
    for (const ch of [1, 2]) assert.ok(data[i * 4 + ch] > 0 && data[i * 4 + ch] < 255);
  }
});
