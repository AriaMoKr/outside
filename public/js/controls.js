// Moving about the garden, as one moves about the hallway, on every device:
//   desktop: drag to look, WASD / arrows to walk (Shift runs), click the ground, a door, the bench
//   phone:   drag to look, tap the ground, the door, the bench
//   gamepad: as in vrlbry, it takes over when used and the mouse takes it back: the left stick
//            walks, the right one looks, A uses what the middle of the view is on (common's
//            gamepad.js)
//   headset: point and pull the trigger (or pinch) at the ground, the door, the bench or the
//            control panel; the left stick walks (move 'smooth') or aims a teleport (move
//            'teleport'), the right one turns in steps (turn 'snap') or smoothly (turn 'smooth');
//            or walk through the doorway
// What is different outside: the ground rises and falls (and the bridge arches), so the viewer
// stands on it; a walk to somewhere across the water goes over the bridge (garden.js route); one
// can sit on the bench, and get up again by moving; and while the book is open (book.js) it takes
// vrlbry's book controls (onBookPress, onBookAction):
//   desktop: a press on a page turns it (or follows a contents entry), on its toolbar or contents
//            uses what is there; ← → Space Page Up/Down turn, + − text size, N theme, C contents
//            (↑ ↓ Enter in it), P one page or two, T text view, F the book in front, Backspace
//            back, Esc closes the contents or the book; the wheel brings it nearer or farther
//   phone:   a tap, or a quick swipe turns the page; two fingers pinch it nearer or farther
//   gamepad: A on what the dot is on, LB RB or the D-pad ← → turn, D-pad ↑ ↓ text size, Y theme,
//            X contents, the triggers nearer or farther, the right stick pressed the book in
//            front, B back
//   headset: the trigger as a press; the right stick left or right turns, up or down nearer or
//            farther; the left stick up or down larger or smaller (walking waits until it is
//            put down); a grip moves it; a thumbstick pressed brings it in front; B or Y back
// Home is back to the start (onHome).
// The viewer's body is `rig` (yaw only); the camera is its head (pitch on a screen, the headset's
// pose in VR). Per frame nothing is allocated.
import * as THREE from 'three';
import { GARDEN, SEAT, castRay, clampWalk, groundAt, panelButtonAt, route } from './garden.js';
import { BUTTONS, firstPad, held, readPad } from 'common/gamepad.js';

const LOOK = 0.0045; // radians per pixel dragged
const WALK = 1.9, RUN = 3.8, XR_WALK = 1.8; // metres per second
const TURN = 1.9; // radians per second (arrow keys)
const SNAP = Math.PI / 6;
const SMOOTH_TURN = 1.6; // radians per second at full stick
const PITCH = 1.35;
const PAD_TURN = 2.4, PAD_PITCH = 1.6; // radians per second, a gamepad's right stick at full tilt (vrlbry's)
const EYE = GARDEN.eye;

const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnLeft', KeyQ: 'turnLeft',
  ArrowRight: 'turnRight', KeyE: 'turnRight',
  ShiftLeft: 'run', ShiftRight: 'run',
};
/** While the book is open: these turn its pages instead. */
const PAGE_KEYS = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1, Space: 1 };
/** While the book is open: the keys for what else it does (vrlbry's), by code, as onBookAction's actions. */
const BOOK_KEYS = { KeyC: 'contents', KeyN: 'theme', KeyP: 'pages', KeyT: 'textView', KeyF: 'front', Backspace: 'back', Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter' };
/** A gamepad's buttons while the book is open (vrlbry's), by their index in the standard mapping: [action, value]. */
const PAD_BOOK = {
  [BUTTONS.indexOf('x')]: ['contents'], [BUTTONS.indexOf('y')]: ['theme'],
  [BUTTONS.indexOf('lb')]: ['turn', -1], [BUTTONS.indexOf('rb')]: ['turn', 1],
  [BUTTONS.indexOf('left')]: ['turn', -1], [BUTTONS.indexOf('right')]: ['turn', 1],
  [BUTTONS.indexOf('up')]: ['font', 1], [BUTTONS.indexOf('down')]: ['font', -1],
  [BUTTONS.indexOf('rs')]: ['front'],
};
const PAD_LT = BUTTONS.indexOf('lt'), PAD_RT = BUTTONS.indexOf('rt');
const WHEEL = 0.0006; // metres nearer or farther per wheel unit (vrlbry's)
const SWIPE = { distance: 60, ms: 500 }; // a quick swipe across turns the page; a slower drag looks

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Controls {
  constructor({ renderer, camera, rig, scene, dom, layout }) {
    this.renderer = renderer;
    this.camera = camera;
    this.rig = rig;
    this.scene = scene;
    this.dom = dom;
    this.layout = layout;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.hover = null; // what is pointed at that could be used: 'door', 'bench', 'book', 'page', a panel button id
    this.hoverDoor = false;
    this.hoverPanel = null; // the control panel's button pointed at
    /** VR navigation (common/nav.js, under hallway.nav): move 'smooth' | 'teleport', turn 'snap' | 'smooth'. */
    this.move = 'smooth';
    this.turn = 'snap';
    /** (how) when the door is chosen: how is 'screen' or 'xr'. */
    this.onDoor = () => {};
    /** (button id) when a button of the control panel is pressed. */
    this.onPanel = () => {};
    /** (hand) when a controller's grip is squeezed in VR (main.js: a wave in the shared session). */
    this.onSqueeze = () => {};
    /** () when the bench is chosen (sit down), and when the book is (open it). */
    this.onBench = () => {};
    this.onBook = () => {};
    /** (side) a key or a stick turns a page of the open book: -1 back, 1 on. () close it. */
    this.onPage = () => {};
    this.onCloseBook = () => {};
    /** (hit) the open book was pressed: a page, a contents entry on it, or its toolbar or contents (book.js pick, press). */
    this.onBookPress = () => {};
    /**
     * (action, value) the open book's other controls: 'font' ±1, 'theme', 'contents', 'contents-move'
     * ±1, 'enter', 'pages', 'textView', 'front', 'back', 'escape', 'distance' (metres), 'scale' (a fraction).
     */
    this.onBookAction = () => {};
    /** (hand, on) a grip squeezed (or let go) in VR while the book is open: it moves with that hand. */
    this.onGrab = () => {};
    /** () Home: back to the start. */
    this.onHome = () => {};
    /** (move) for a teleport or sitting down in VR: main.js blinks the view around move(), which puts the viewer there. */
    this.onTeleport = (move) => move();
    /** The first time the viewer does anything (hides the hint). */
    this.onActivity = () => {};
    /** Sitting down, or getting up: (seated). */
    this.onSeat = () => {};
    /** A gamepad was used last: the middle of the view is what it points at (main.js shows a dot there). */
    this.padActive = false;
    /** (on) when the gamepad takes over or hands back; when its B or Back is pressed (main.js leaves fullscreen). */
    this.onPadActive = () => {};
    this.onPadBack = () => {};
    /**
     * The open book, when it is (book.js): its pick(ox, oy, oz, dx, dy, dz) → { t, side } or null
     * is asked before the garden, so its pages take presses.
     */
    this.book = null;
    this._pad = readPad({ axes: [], buttons: [] });
    this._padUse = false;
    this._padBack = false;
    this._padHeld = new Array(BUTTONS.length).fill(false); // the book's buttons, held last frame
    this._padWheel = 0; // seconds until the triggers move the book again
    this._pads = 0; // connected; none, and nothing is polled
    /** Whether a gamepad is connected. */
    this.hasPad = false;
    this.auto = null; // a walk under way: { points: [[x, z], …], i, face: yaw|null, speed, turn, then }
    /** Sitting on the bench: { lift } (in VR, how far the rig is lowered to bring the head to a seated height), or null. */
    this.seated = null;
    /** Less motion (common/access.js reduceMotion): a walk (to a spot, over the bridge, to the bench, into the door) jumps there. */
    this.reduceMotion = false;
    /** In VR, how far the rig stands above the ground: common/access.js eyeLift, for seated mode (setEyeLift). */
    this.eyeLift = 0;
    /** The sticks' smooth movement (m/s) and turning (rad/s) this frame in VR, for the vignette; 0 for snaps and teleports. */
    this.moveSpeed = 0;
    this.turnRate = 0;
    this._down = null;
    this._mouse = null;
    this._cursor = '';
    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._hit = { t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, side: 0, panel: null, el: null, page: -1, link: null };
    this._touches = new Map(); // fingers down: pointerId → [x, y]
    this._pinch = 0; // two fingers' distance apart, while they pinch
    this._head = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._clamped = { x: 0, z: 0 };
    this._snapArmed = true;
    this._pageArmed = true;
    this._backHeld = false;
    this._stickHeld = false;
    this._recenter = 0; // frames until VR lines the headset up with the pose it entered at
    this._entry = { x: 0, z: 0, yaw: 0 };
    camera.position.set(0, EYE, 0);
    camera.rotation.order = 'YXZ';
    this._bindDom();
    this._setupXR();
  }

  /** Puts the viewer at (x, z) facing yaw (and pitch), standing. */
  setPose(x, z, yaw, pitch = 0) {
    this.seated = null;
    this.rig.position.set(x, groundAt(this.layout, x, z), z);
    this.yaw = yaw;
    this.pitch = clamp(pitch, -PITCH, PITCH);
    this.auto = null;
    this._apply();
  }

  /** Sets how to move and turn in VR (common/nav.js). */
  setNav({ move, turn }) {
    this.move = move;
    this.turn = turn;
    for (const h of this.hands) h.aiming = false;
  }

  /**
   * Raises the rig this far above the ground in VR (common/access.js eyeLift: 0.45 m in seated
   * mode, else 0), at once. On the bench the bench's own lift holds instead: it brings the head to
   * a seated eye over the seat from wherever the headset is, so a visitor already sitting is not
   * lowered further, and the lift comes back on getting up.
   */
  setEyeLift(lift) {
    this.eyeLift = lift;
    if (!this.renderer.xr.isPresenting || this.seated) return;
    this.camera.getWorldPosition(this._head);
    this.rig.position.y = groundAt(this.layout, this._head.x, this._head.z) + lift;
  }

  /** Walks to a point on the ground (round the water, over the bridge), then maybe turns to `face` and calls `then`. */
  walkTo(x, z, { face = null, then = null } = {}) {
    this.stand();
    const p = this.rig.position;
    const points = route(this.layout, p.x, p.z, x, z);
    if (!points.length) return;
    this._startWalk(points, face, then);
  }

  /** Walks up to the door and through it. */
  walkInto() {
    this.stand();
    const p = this.rig.position;
    const jamb = this.layout.door.width / 2 - 0.25;
    const front = [clamp(p.x, -jamb, jamb), -1.0];
    const points = p.z > -1.2 && Math.abs(p.x) < jamb ? [] : route(this.layout, p.x, p.z, front[0], front[1]);
    points.push([front[0], 0.25]);
    this._startWalk(points, Math.PI, null);
  }

  _startWalk(points, face, then) {
    if (this.reduceMotion) {
      this._jump(points[points.length - 1], face, then);
      return;
    }
    let length = 0, x = this.rig.position.x, z = this.rig.position.z;
    for (const [px, pz] of points) {
      length += Math.hypot(px - x, pz - z);
      x = px;
      z = pz;
    }
    // Long walks go faster, so none takes much more than a second and a half (as in the hallway);
    // a walk that turns corners looks where it is going.
    this.auto = { points, i: 0, face, speed: clamp(length / 1.5, 2.2, 7), turn: points.length > 1, then };
  }

  /** Less motion: straight to the end of a walk (a point on its route, or through the doorway), facing `face` if given. */
  _jump([x, z], face, then) {
    this.auto = null;
    const p = this.rig.position;
    p.set(x, groundAt(this.layout, x, z), z);
    if (face !== null) {
      this.yaw = face;
      this.pitch = 0;
    }
    this._apply();
    then?.();
  }

  /**
   * Sits down on the bench, facing out over the pond: on a screen, walking up to it first; in VR
   * (where walks are the viewer's own), straight onto it, the view blinking.
   */
  sit(then = null) {
    if (this.seated) {
      then?.();
      return;
    }
    const L = this.layout, f = L.benchFront, s = L.seat, p = this.rig.position;
    if (this.renderer.xr.isPresenting) {
      this.onTeleport(() => this._seat(then));
      return;
    }
    if (Math.hypot(p.x - f.x, p.z - f.z) < 0.35 || Math.hypot(p.x - s.x, p.z - s.z) < 0.6) this._seat(then);
    else this.walkTo(f.x, f.z, { face: s.yaw, then: () => this._seat(then) });
  }

  /** Onto the seat, from wherever one is. */
  _seat(then = null) {
    this.auto = null;
    const s = this.layout.seat;
    if (this.renderer.xr.isPresenting) {
      this.camera.getWorldPosition(this._head);
      // Bring the head (however high it is held) to a seated eye over the seat.
      const local = this._head.y - this.rig.position.y;
      this.seated = { lift: s.y + SEAT.eye - local };
      this._turnAboutHead(wrapAngle(s.yaw - this._headYaw()));
      this.rig.updateMatrixWorld();
      this.camera.getWorldPosition(this._head);
      this.rig.position.x += s.x - this._head.x;
      this.rig.position.z += s.z - this._head.z;
    } else {
      this.seated = { lift: s.y + SEAT.eye - EYE };
      this.rig.position.x = s.x;
      this.rig.position.z = s.z;
      this.yaw = s.yaw;
      this.pitch = -0.12;
    }
    this.rig.position.y = this.seated.lift;
    this._apply();
    this.onSeat(true);
    then?.();
  }

  /** Gets up from the bench (if sitting), to stand in front of it. */
  stand() {
    if (!this.seated) return;
    const f = this.layout.benchFront;
    this.seated = null;
    if (this.renderer.xr.isPresenting) {
      this.camera.getWorldPosition(this._head);
      this.rig.position.x += f.x - this._head.x;
      this.rig.position.z += f.z - this._head.z;
    } else {
      this.rig.position.x = f.x;
      this.rig.position.z = f.z;
    }
    this.rig.position.y = groundAt(this.layout, f.x, f.z) + (this.renderer.xr.isPresenting ? this.eyeLift : 0);
    this.onSeat(false);
  }

  /** Back to the start (main.js resetView): standing at (x, z), facing yaw, level; in VR the head goes there, the view blinking. */
  resetTo(x, z, yaw) {
    this.auto = null;
    if (!this.renderer.xr.isPresenting) {
      if (this.seated) this.stand();
      this.setPose(x, z, yaw);
      return;
    }
    this.onTeleport(() => {
      this.stand();
      this._turnAboutHead(wrapAngle(yaw - this._headYaw()));
      this.rig.updateMatrixWorld();
      this._moveHead(x, z);
    });
  }

  update(dt) {
    this.moveSpeed = 0;
    this.turnRate = 0;
    if (this.renderer.xr.isPresenting) {
      this._updateXR(dt);
      return;
    }
    if (this.auto) this._updateWalk(dt);
    else this._updateKeys(dt);
    if (this._pads) this._updatePad(dt);
    this._standOnGround(dt, this.rig.position.x, this.rig.position.z, 0);
    this._apply();
    this._updateHover();
  }

  /** Keeps the rig on the ground under (x, z) (where the head is), `lift` above it, or at its seat. */
  _standOnGround(dt, x, z, lift) {
    const target = this.seated ? this.seated.lift : groundAt(this.layout, x, z) + lift;
    const p = this.rig.position;
    const k = dt > 0 ? 1 - Math.exp(-dt * 18) : 1;
    p.y += (target - p.y) * k;
  }

  _apply() {
    this.rig.rotation.y = this.yaw;
    if (!this.renderer.xr.isPresenting) this.camera.rotation.set(this.pitch, 0, 0);
  }

  _move(x, z) {
    const p = this.rig.position;
    const c = clampWalk(this.layout, p.x, p.z, x, z, this._clamped);
    p.x = c.x;
    p.z = c.z;
    return c;
  }

  _updateKeys(dt) {
    const k = this.keys;
    if (!k.size) return;
    if (!this.book) this.yaw += ((k.has('turnLeft') ? 1 : 0) - (k.has('turnRight') ? 1 : 0)) * TURN * dt;
    const f = (k.has('forward') ? 1 : 0) - (k.has('back') ? 1 : 0);
    const s = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    if (!f && !s) return;
    if (this.book && !k.has('wasd')) return; // the arrows turn its pages
    this.stand();
    const step = ((k.has('run') ? RUN : WALK) * dt) / Math.hypot(f, s);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Forward is (-sin, -cos); right is (cos, -sin).
    const p = this.rig.position;
    this._move(p.x + (-sin * f + cos * s) * step, p.z + (-cos * f - sin * s) * step);
  }

  /** The gamepad takes over the view's middle as the pointer when used; the mouse takes it back. */
  _setPadActive(on) {
    if (this.padActive === on) return;
    this.padActive = on;
    this.onPadActive(on);
  }

  /** The first connected gamepad: walking and looking like a first-person game, A to use. */
  _updatePad(dt) {
    const pad = firstPad(navigator.getGamepads?.());
    if (!pad) {
      this._setPadActive(false);
      return;
    }
    const s = readPad(pad, this._pad);
    const moving = s.moveX !== 0 || s.moveY !== 0, looking = s.lookX !== 0 || s.lookY !== 0;
    const book = this._padBook(pad, dt); // the book's buttons act at once, and count as using the pad
    if (moving || looking || book || (s.use && !this._padUse) || (s.back && !this._padBack)) {
      this._setPadActive(true);
      this.onActivity();
    }
    if (!this.padActive) {
      this._padUse = s.use;
      this._padBack = s.back;
      return;
    }
    if (moving || looking) this.auto = null;
    if (looking) {
      this.yaw -= s.lookX * PAD_TURN * dt;
      this.pitch = clamp(this.pitch - s.lookY * PAD_PITCH * dt, -PITCH, PITCH);
    }
    if (moving) {
      this.stand();
      const step = (s.run ? RUN : WALK) * dt;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const f = -s.moveY, r = s.moveX;
      const p = this.rig.position;
      this._move(p.x + (-sin * f + cos * r) * step, p.z + (-cos * f - sin * r) * step);
    }
    // Buttons act once per press. B goes back in the book first, if it is open.
    if (s.use && !this._padUse) this._useMiddle();
    if (s.back && !this._padBack) {
      if (this.book) this.onBookAction('back');
      else this.onPadBack();
    }
    this._padUse = s.use;
    this._padBack = s.back;
  }

  /**
   * A gamepad's buttons for the open book (vrlbry's: PAD_BOOK), and its triggers bringing it
   * nearer or farther; whether any of them did something.
   */
  _padBook(pad, dt) {
    let used = false;
    for (const i in PAD_BOOK) {
      const on = held(pad, i);
      if (on && !this._padHeld[i] && this.book) {
        const a = PAD_BOOK[i];
        if (a[0] === 'turn') this.onPage(a[1]);
        else this.onBookAction(a[0], a[1]);
        used = true;
      }
      this._padHeld[i] = on;
    }
    // The triggers, as a wheel that repeats (vrlbry's): the right one farther, the left nearer.
    const t = (pad.buttons[PAD_RT]?.value ?? 0) - (pad.buttons[PAD_LT]?.value ?? 0);
    this._padWheel -= dt;
    if (this.book && Math.abs(t) > 0.15 && this._padWheel <= 0) {
      this.onBookAction('distance', 100 * t * WHEEL);
      this._padWheel = 0.12;
      used = true;
    }
    return used;
  }

  /** A on a gamepad: what the middle of the view is on, as a click there would. */
  _useMiddle() {
    this.camera.updateWorldMatrix(true, false);
    this._use(this._pickNdc(0, 0), 'screen');
  }

  _updateWalk(dt) {
    const a = this.auto;
    const p = this.rig.position;
    const [tx, tz] = a.points[a.i];
    const dx = tx - p.x, dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    const turn = 1 - Math.exp(-dt * 6);
    const last = a.i === a.points.length - 1;
    if (a.face !== null && (last || !a.turn)) {
      this.yaw += wrapAngle(a.face - this.yaw) * turn;
      this.pitch += (0 - this.pitch) * turn;
    } else if (a.turn && dist > 0.3) {
      this.yaw += wrapAngle(Math.atan2(-dx, -dz) - this.yaw) * turn;
      this.pitch += (-0.1 - this.pitch) * turn;
    }
    const step = a.speed * dt;
    if (dist <= step) {
      this._move(tx, tz);
      if (++a.i >= a.points.length) {
        this.auto = null;
        a.then?.();
      }
      return;
    }
    const px = p.x, pz = p.z;
    const c = this._move(px + (dx / dist) * step, pz + (dz / dist) * step);
    if (Math.hypot(c.x - px, c.z - pz) < step * 0.05) this.auto = null; // blocked
  }

  _pickScreen(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    this.camera.updateWorldMatrix(true, false);
    return this._pickNdc(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /** What is at (x, y) in the view, -1…1 from its bottom left. */
  _pickNdc(x, y) {
    this._ndc.set(x, y);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    const { origin: o, direction: d } = this._raycaster.ray;
    return this._pick(o.x, o.y, o.z, d.x, d.y, d.z, this._hit);
  }

  /** The open book first (its contents, toolbar and pages: book.js pick), then the garden. */
  _pick(ox, oy, oz, dx, dy, dz, out) {
    const b = this.book?.pick(ox, oy, oz, dx, dy, dz);
    if (b) {
      out.t = b.t;
      out.kind = b.kind;
      out.side = b.side;
      out.panel = b.panel;
      out.el = b.el;
      out.u = b.u;
      out.v = b.v;
      out.page = b.page;
      out.link = b.link;
      out.x = ox + dx * b.t;
      out.y = oy + dy * b.t;
      out.z = oz + dz * b.t;
      out.nx = -dx;
      out.ny = -dy;
      out.nz = -dz;
      out.walkable = false;
      return out;
    }
    out.panel = out.el = out.link = null;
    return castRay(this.layout, ox, oy, oz, dx, dy, dz, out);
  }

  /** What could be used where a hit is: 'door', 'bench', 'book', 'page', 'bookui' (the open book's toolbar or contents), a panel button, or null. */
  _usable(hit) {
    if (!hit) return null;
    if (hit.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit.kind === 'bookui') return hit.el ? 'bookui' : null;
    if (hit.kind === 'door' || hit.kind === 'page' || hit.kind === 'book' || hit.kind === 'bench') return hit.kind;
    return null;
  }

  _updateHover() {
    let hit = null;
    const aim = this.padActive;
    if (aim || (this._mouse && !this._down)) {
      if (aim) this.camera.updateWorldMatrix(true, false);
      hit = aim ? this._pickNdc(0, 0) : this._pickScreen(this._mouse.x, this._mouse.y);
    }
    this._setHover(this._usable(hit), hit);
    const cursor = this.hover ? 'pointer' : this._down?.moved ? 'grabbing' : '';
    if (cursor !== this._cursor) this.dom.style.cursor = this._cursor = cursor;
  }

  _setHover(usable, hit) {
    this.hover = usable;
    this.hoverDoor = usable === 'door';
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
    // The open book's toolbar and contents light what is pointed at, and a contents entry its band.
    this.book?.setHover(hit && (hit.kind === 'page' || hit.kind === 'bookui') ? hit : null);
  }

  /** Uses what a hit is on: the door, a panel button, the bench, the book, the open book, or walks to the ground. */
  _use(hit, how) {
    if (!hit) {
      if (this.book) this.onCloseBook();
      return;
    }
    if (hit.kind === 'page' || hit.kind === 'bookui') this.onBookPress(hit);
    else if (this.book && hit.kind !== 'panel') this.onCloseBook(); // a press off the book puts it down
    else if (hit.kind === 'door') this.onDoor(how);
    else if (hit.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit.kind === 'book') this.onBook();
    else if (hit.kind === 'bench') this.onBench();
    else if (hit.kind === 'ground' || hit.kind === 'water') {
      if (how === 'xr') {
        if (hit.walkable) this._teleport(hit.x, hit.z);
      } else this.walkTo(hit.x, hit.z);
    }
  }

  _tap(clientX, clientY) {
    this._use(this._pickScreen(clientX, clientY), 'screen');
  }

  /** How far apart two fingers are. */
  _pinchDistance() {
    let a = null, d = 0;
    for (const f of this._touches.values()) {
      if (a) d = Math.hypot(f[0] - a[0], f[1] - a[1]);
      else a = f;
    }
    return d;
  }

  _bindDom() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      this._setPadActive(false);
      if (e.pointerType === 'touch') {
        this._touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (this._touches.size === 2) {
          // A second finger: a pinch, so the first one's touch is no tap.
          this._pinch = this._pinchDistance();
          this._down = null;
          return;
        }
      }
      if (this._down || this._touches.size > 1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, touch: e.pointerType !== 'mouse', moved: false, t: performance.now(), yaw: this.yaw, pitch: this.pitch };
      el.setPointerCapture?.(e.pointerId);
      this.onActivity();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this._mouse = { x: e.clientX, y: e.clientY };
      if (e.movementX || e.movementY) this._setPadActive(false);
      const f = this._touches.get(e.pointerId);
      if (f) {
        f[0] = e.clientX;
        f[1] = e.clientY;
        if (this._touches.size === 2) {
          // Two fingers pinch the open book nearer (apart) or farther (together), as the wheel does.
          const d = this._pinchDistance();
          if (this.book && this._pinch && Math.abs(d - this._pinch) > 4) {
            this.onBookAction('distance', (this._pinch - d) * 2 * WHEEL);
            this._pinch = d;
          }
          return;
        }
      }
      const d = this._down;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
      d.lx = e.clientX;
      d.ly = e.clientY;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? 10 : 5)) d.moved = true;
      if (!d.moved) return;
      // The mouse turns the view the way it is dragged; a finger drags the scene (the opposite).
      const k = d.touch ? -LOOK * 1.15 : LOOK;
      this.yaw -= dx * k;
      this.pitch = clamp(this.pitch - dy * k, -PITCH, PITCH);
      if (this.auto && !this.auto.then) this.auto = null;
    });
    const end = (e) => {
      this._touches.delete(e.pointerId);
      if (this._touches.size < 2) this._pinch = 0;
      const d = this._down;
      if (!d || d.id !== e.pointerId) return;
      this._down = null;
      if (e.type !== 'pointerup') return;
      if (!d.moved) this._tap(e.clientX, e.clientY);
      else if (this.book && d.touch) {
        // A quick swipe across turns the open book's page (vrlbry's), the view left as it was; a
        // slower drag looks about.
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) > SWIPE.distance && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - d.t < SWIPE.ms) {
          this.yaw = d.yaw;
          this.pitch = d.pitch;
          this.onPage(dx < 0 ? 1 : -1);
        }
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this._mouse = null;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // The wheel brings the open book nearer or farther (vrlbry's).
    el.addEventListener('wheel', (e) => {
      if (!this.book) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1; // lines, pages
      this.onBookAction('distance', e.deltaY * unit * WHEEL);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // The overlay's own controls keep their keys: a radio button its arrows (as the hallway's
      // name field keeps its typing), and a button the Space or Enter that presses it; and so
      // does the text view (data-own-keys).
      if (e.target?.closest?.('input, textarea, select, [contenteditable], [data-own-keys]')) return;
      if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') && e.target?.closest?.('button, a[href]')) return;
      if (e.code === 'Home') {
        e.preventDefault();
        this.onHome();
        return;
      }
      if (this.book) {
        // vrlbry's keys for the open book: what else it does, the text size, the contents' entries.
        const action = BOOK_KEYS[e.code] ?? (e.key === '+' || e.key === '=' || e.key === '-' ? 'font' : e.code === 'ArrowUp' || e.code === 'ArrowDown' ? 'contents-move' : null);
        if (action) {
          e.preventDefault();
          if (!e.repeat || action === 'contents-move') {
            this.onBookAction(action, action === 'font' ? (e.key === '-' ? -1 : 1) : e.code === 'ArrowUp' ? -1 : 1);
          }
          this.onActivity();
          return;
        }
        if (e.code in PAGE_KEYS) {
          e.preventDefault();
          if (!e.repeat) this.onPage(PAGE_KEYS[e.code]);
          this.onActivity();
          return;
        }
      }
      const k = KEYS[e.code];
      if (!k) return;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(k);
      // Reading: WASD still gets one up; the arrows are the book's.
      if (/^Key[WASD]$/.test(e.code)) this.keys.add('wasd');
      if (k !== 'run') this.auto = null;
      this.onActivity();
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k) this.keys.delete(k);
      if (/^Key[WASD]$/.test(e.code) && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((c) => this.keys.has(KEYS[c]))) this.keys.delete('wasd');
    });
    window.addEventListener('blur', () => this.keys.clear());
    // A browser shows a page a gamepad once one of its buttons is pressed.
    window.addEventListener('gamepadconnected', () => {
      this._pads++;
      this.hasPad = true;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this._pads = Math.max(0, this._pads - 1);
      this.hasPad = this._pads > 0;
      if (!this.hasPad) this._setPadActive(false);
    });
  }

  // ── VR ──────────────────────────────────────────────────────────────────────

  _setupXR() {
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const laserMaterial = new THREE.LineBasicMaterial({ color: 0xfff0d6, transparent: true, opacity: 0.6 });
    const ringGeometry = new THREE.RingGeometry(0.022, 0.034, 28);
    this.hands = [];
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const laser = new THREE.Line(laserGeometry, laserMaterial);
      laser.visible = false;
      controller.add(laser);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d6 }));
      controller.add(tip);
      const reticle = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: 0xfff0d6, transparent: true, opacity: 0.85, depthWrite: false }));
      reticle.visible = false;
      this.scene.add(reticle);
      const hand = { controller, laser, tip, reticle, source: null, hit: { ...this._hit }, last: null, aiming: false, backHeld: false, stickHeld: false };
      controller.addEventListener('connected', (e) => {
        hand.source = e.data;
      });
      controller.addEventListener('disconnected', () => {
        hand.source = null;
        hand.last = null;
        hand.aiming = false;
        laser.visible = reticle.visible = false;
      });
      controller.addEventListener('select', () => this._xrSelect(hand));
      // A grip moves the open book (vrlbry's); otherwise it waves.
      controller.addEventListener('squeezestart', () => {
        if (this.book) this.onGrab(hand, true);
        else this.onSqueeze(hand);
      });
      controller.addEventListener('squeezeend', () => this.onGrab(hand, false));
      this.rig.add(controller);
      this.hands.push(hand);
    }
    this.renderer.xr.addEventListener('sessionstart', () => {
      this._entry.x = this.rig.position.x;
      this._entry.z = this.rig.position.z;
      this._entry.yaw = this.yaw;
      this._entry.seated = !!this.seated;
      this.seated = null;
      this._recenter = 2;
      this.auto = null;
      this.keys.clear();
    });
    this.renderer.xr.addEventListener('sessionend', () => this._onSessionEnd());
  }

  _headYaw() {
    this.camera.getWorldDirection(this._dir);
    return Math.atan2(-this._dir.x, -this._dir.z);
  }

  /** Turns the rig by angle about the head, so the viewer turns in place. */
  _turnAboutHead(angle) {
    this.camera.getWorldPosition(this._head);
    const p = this.rig.position;
    const ox = p.x - this._head.x, oz = p.z - this._head.z;
    const c = Math.cos(angle), s = Math.sin(angle);
    p.x = this._head.x + ox * c + oz * s;
    p.z = this._head.z - ox * s + oz * c;
    this.yaw += angle;
    this.rig.rotation.y = this.yaw;
  }

  /** Moves the rig so the head goes to (x, z), or as near as the garden allows. */
  _moveHead(x, z) {
    this.camera.getWorldPosition(this._head);
    const c = clampWalk(this.layout, this._head.x, this._head.z, x, z, this._clamped);
    this.rig.position.x += c.x - this._head.x;
    this.rig.position.z += c.z - this._head.z;
  }

  _updateXR(dt) {
    // A moment after entering, line the headset up with where the viewer stood and looked.
    if (this._recenter > 0 && --this._recenter === 0) {
      this._turnAboutHead(wrapAngle(this._entry.yaw - this._headYaw()));
      this.rig.updateMatrixWorld();
      this._moveHead(this._entry.x, this._entry.z);
      if (this._entry.seated) this._seat();
      else this.setEyeLift(this.eyeLift); // up at once in seated mode, not rising into it
    }
    // The sticks: the right one turns, the left one walks or aims a teleport. Reading (vrlbry's), the
    // right one turns pages (left, right) and brings the book nearer or farther (up, down), the
    // left one makes it larger or smaller; walking waits until it is put down.
    for (const h of this.hands) {
      const pad = h.source?.gamepad;
      if (!pad || pad.axes.length < 2) continue;
      const ax = pad.axes.length >= 4 ? pad.axes[2] : pad.axes[0];
      const ay = pad.axes.length >= 4 ? pad.axes[3] : pad.axes[1];
      const right = h.source.handedness === 'right';
      if (this.book) {
        h.aiming = false;
        if (right) {
          this._pageStick(ax);
          if (Math.abs(ay) > 0.3) this.onBookAction('distance', ay * 0.4 * dt);
        } else if (Math.abs(ay) > 0.3) this.onBookAction('scale', -ay * 0.8 * dt);
      } else if (right) this._turnStick(ax, dt);
      else if (this.move === 'teleport') this._teleportStick(h, ay);
      else this._walkStick(ax, ay, dt);
      // B or Y goes back in the book (the contents, the links followed, then it is put down); a
      // thumbstick pressed brings it in front.
      const back = !!this.book && !!pad.buttons[5]?.pressed;
      if (back && !h.backHeld) this.onBookAction('back');
      h.backHeld = back;
      const stick = !!this.book && !!pad.buttons[3]?.pressed;
      if (stick && !h.stickHeld) this.onBookAction('front');
      h.stickHeld = stick;
    }
    this.rig.updateMatrixWorld();
    // Stand on the ground under the head (its height above the rig is the headset's own), raised in seated mode.
    this.camera.getWorldPosition(this._head);
    this._standOnGround(dt, this._head.x, this._head.z, this.eyeLift);
    this.rig.updateMatrixWorld();
    let usable = null, usableHit = null;
    for (const h of this.hands) {
      const mode = h.source?.targetRayMode;
      if (mode !== 'tracked-pointer') {
        h.laser.visible = h.reticle.visible = false;
        h.last = null;
        continue;
      }
      const m = h.controller.matrixWorld;
      this._origin.setFromMatrixPosition(m);
      this._dir.set(0, 0, -1).transformDirection(m);
      const o = this._origin, d = this._dir;
      const hit = this._pick(o.x, o.y, o.z, d.x, d.y, d.z, h.hit);
      h.last = hit;
      h.laser.visible = true;
      h.laser.scale.z = hit ? hit.t : 4;
      if (!hit) {
        h.reticle.visible = false;
        continue;
      }
      const use = this._usable(hit);
      const target = h.aiming && hit.kind === 'ground';
      if (use && !usable) {
        usable = use;
        usableHit = hit;
      }
      this._normal.set(hit.nx, hit.ny, hit.nz).normalize();
      h.reticle.position.set(hit.x + this._normal.x * 0.01, hit.y + this._normal.y * 0.01, hit.z + this._normal.z * 0.01);
      h.reticle.quaternion.setFromUnitVectors(Z_AXIS, this._normal);
      h.reticle.scale.setScalar(target ? 3.2 : use === 'door' ? 1.8 : use ? 0.7 : 1);
      const good = (target && hit.walkable) || use || (hit.kind === 'ground' && hit.walkable);
      h.reticle.material.color.setHex(target ? (hit.walkable ? 0xe8c47c : 0x8a7f72) : use ? 0xe8c47c : good ? 0xfff0d6 : 0x9a8f80);
      h.reticle.visible = true;
    }
    this._setHover(usable, usableHit);
  }

  /** Right stick, reading: a push left or right turns a page. */
  _pageStick(ax) {
    if (this._pageArmed && Math.abs(ax) > 0.6) {
      this.onPage(Math.sign(ax));
      this._pageArmed = false;
    } else if (Math.abs(ax) < 0.3) this._pageArmed = true;
  }

  /** Right stick: a 30 degree step each push (snap), or turning while held (smooth). */
  _turnStick(ax, dt) {
    if (this.turn === 'smooth') {
      if (Math.abs(ax) > 0.15) {
        this._turnAboutHead(-ax * SMOOTH_TURN * dt);
        this.turnRate = Math.max(this.turnRate, Math.abs(ax) * SMOOTH_TURN);
      }
      return;
    }
    if (this._snapArmed && Math.abs(ax) > 0.6) {
      this._turnAboutHead(-Math.sign(ax) * SNAP);
      this._snapArmed = false;
    } else if (Math.abs(ax) < 0.3) this._snapArmed = true;
  }

  /** Left stick, move 'smooth': walk the way the head faces (getting up first). */
  _walkStick(ax, ay, dt) {
    if (Math.hypot(ax, ay) <= 0.15) return;
    if (this.seated) {
      this.onCloseBook();
      this.stand();
    }
    this.camera.getWorldDirection(this._dir);
    let fx = this._dir.x, fz = this._dir.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    // Right of forward (fx, fz) is (-fz, fx).
    const step = XR_WALK * dt;
    this.moveSpeed = Math.max(this.moveSpeed, XR_WALK * Math.min(1, Math.hypot(ax, ay)));
    this.camera.getWorldPosition(this._head);
    this._moveHead(this._head.x + (-fz * ax - fx * ay) * step, this._head.z + (fx * ax - fz * ay) * step);
  }

  /** Left stick, move 'teleport': pushed forward, that hand's ray aims; let go, and the viewer is there. */
  _teleportStick(h, ay) {
    if (ay < -0.6) h.aiming = true;
    else if (h.aiming && ay > -0.3) {
      h.aiming = false;
      const hit = h.last;
      if (hit?.kind === 'ground' && hit.walkable) this._teleport(hit.x, hit.z);
    }
  }

  _teleport(x, z) {
    this.onTeleport(() => {
      if (this.seated) {
        this.onCloseBook();
        this.stand();
      }
      this._moveHead(x, z);
    });
  }

  _press(id) {
    if (id) this.onPanel(id);
  }

  _xrSelect(hand) {
    const hit = hand.last;
    this.onActivity();
    this._use(hit, 'xr');
  }

  _onSessionEnd() {
    // Carry on from where the headset was, facing the way it faced.
    this.camera.getWorldPosition(this._head);
    const yaw = this._headYaw();
    const wasSeated = !!this.seated;
    const c = clampWalk(this.layout, this._head.x, this._head.z, this._head.x, this._head.z, this._clamped);
    this.camera.position.set(0, EYE, 0);
    this.camera.quaternion.identity();
    for (const h of this.hands) {
      h.laser.visible = h.reticle.visible = false;
      h.last = null;
      h.aiming = false;
    }
    this._setHover(null, null);
    if (wasSeated) this._seat();
    else this.setPose(c.x, c.z, yaw);
  }
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
