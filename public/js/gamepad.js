// Standard-layout gamepads (Xbox, PlayStation, most Bluetooth pads) through the Gamepad API, on a
// desktop or a phone (in VR the controllers come through the XR session instead). Handled as
// vrlbry's xr/gamepad.js handles them, so a pad feels the same on both sides of a door: the left
// stick walks (clicked in, it hurries), the right one looks, A uses what the middle of the view
// is on, B or Back goes back (here: out of fullscreen). Pure, and allocation-free, for the tests.

/** Buttons in the W3C standard mapping (https://w3c.github.io/gamepad/#remapping). */
export const BUTTON = { a: 0, b: 1, back: 8, leftStick: 10 };

/** How far a stick moves before it counts (vrlbry's). */
export const DEADZONE = 0.18;

/** The factor to multiply a stick's (x, y) by: 0 inside the dead zone, then rising to 1 at full tilt. */
function stickScale(x, y) {
  const m = Math.hypot(x, y);
  if (m <= DEADZONE) return 0;
  return Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m;
}

/** A button held: pressed, or an analogue one more than half way. */
function held(pad, i) {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

/**
 * What a gamepad asks for now. Writes into out { moveX, moveY, lookX, lookY, run, use, back }:
 * the sticks as -1…1 (y down, as gamepads give it), the buttons as held or not.
 */
export function readPad(pad, out = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, use: false, back: false }) {
  const a = pad.axes;
  const lx = a[0] ?? 0, ly = a[1] ?? 0, rx = a[2] ?? 0, ry = a[3] ?? 0;
  const m = stickScale(lx, ly), l = stickScale(rx, ry);
  out.moveX = lx * m;
  out.moveY = ly * m;
  out.lookX = rx * l;
  out.lookY = ry * l;
  out.run = held(pad, BUTTON.leftStick);
  out.use = held(pad, BUTTON.a);
  out.back = held(pad, BUTTON.b) || held(pad, BUTTON.back);
  return out;
}

/** The first connected gamepad, preferring one with the standard mapping (as vrlbry does). */
export function firstPad(pads) {
  let any = null;
  for (let i = 0; pads && i < pads.length; i++) {
    const p = pads[i];
    if (!p?.connected) continue;
    if (p.mapping === 'standard') return p;
    any ??= p;
  }
  return any;
}
