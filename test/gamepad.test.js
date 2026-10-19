import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, DEADZONE, firstPad, readPad } from '../public/js/gamepad.js';

const pad = (axes, pressed = [], extra = {}) => ({
  connected: true, mapping: 'standard', axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  ...extra,
});
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

test('sticks at rest, or resting a little off centre, ask for nothing', () => {
  const s = readPad(pad([0.1, -0.12, DEADZONE * 0.9, 0]));
  for (const k of ['moveX', 'moveY', 'lookX', 'lookY']) assert.equal(Math.abs(s[k]), 0, k);
  assert.equal(s.use || s.back || s.run, false);
});

test('full tilt reaches 1, diagonally too, and no further; past the dead zone it is linear, as in vrlbry', () => {
  let s = readPad(pad([0, -1, 1, 0]));
  near(s.moveY, -1, 'forward');
  near(s.lookX, 1, 'look right');
  s = readPad(pad([Math.SQRT1_2, Math.SQRT1_2, 0, 0]));
  near(Math.hypot(s.moveX, s.moveY), 1, 'diagonal');
  s = readPad(pad([1, 1, 0, 0])); // some pads report a square
  near(Math.hypot(s.moveX, s.moveY), 1, 'square corner');
  s = readPad(pad([0.5, 0, 0.5, 0]));
  near(s.moveX, (0.5 - DEADZONE) / (1 - DEADZONE), 'walking');
  near(s.lookX, (0.5 - DEADZONE) / (1 - DEADZONE), 'looking');
});

test('A uses, B and Back both go back, the left stick clicked in hurries; analogue buttons count past half way', () => {
  let s = readPad(pad([0, 0, 0, 0], [BUTTON.a, BUTTON.leftStick]));
  assert.deepEqual([s.use, s.back, s.run], [true, false, true]);
  assert.equal(readPad(pad([0, 0, 0, 0], [BUTTON.b])).back, true);
  assert.equal(readPad(pad([0, 0, 0, 0], [BUTTON.back])).back, true);
  const half = pad([0, 0, 0, 0]);
  half.buttons[BUTTON.a] = { pressed: false, value: 0.6 };
  assert.equal(readPad(half).use, true);
  // A pad with one stick only walks.
  s = readPad({ axes: [0.9, 0], buttons: [] });
  assert.ok(s.moveX > 0.8);
  assert.equal(s.lookX, 0);
  assert.equal(s.use, false);
});

test('the first connected pad is used, one with the standard mapping first', () => {
  const odd = pad([], [], { mapping: '' }), std = pad([]), gone = pad([], [], { connected: false });
  assert.equal(firstPad([null, gone, odd, std]), std);
  assert.equal(firstPad([odd, null]), odd);
  assert.equal(firstPad([null, gone]), null);
  assert.equal(firstPad(undefined), null);
});
