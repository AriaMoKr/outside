// Moving about the garden: common's Controls (common/controls.js), the walking the hallway, the
// rooms and here share, on every device (its README's table): a drag to look, WASD or the arrows, a
// click or a tap, a gamepad, a TV's remote (main.js gives it useMiddle, and sets aimMiddle while
// walking), and in VR the hands and the sticks, with less motion, seated mode and the vignette's
// speeds. Here is the garden's own:
//   the garden: garden.js's castRay (the door, the control panel, the house's wall, the book, the
//     bench, a tree, a hedge, the far wall, the water, the ground), clampWalk, groundAt (the ground
//     rises and falls, and the bridge arches) and route (round the water, over the bridge); its eye;
//     its hit's own fields (where on the panel, and the open book's)
//   on a screen, a walk to the water or to ground one can't stand on goes as near as one can (its
//     route ends there), where common's walks only to ground that is walkable
//   the walk up to the doorway and through it (walkInto), and back to the start (resetTo)
//   the control panel: a button pressed is onPanel(id), and the one pointed at hoverPanel
//   the bench: sitting (sit, onBench; on a screen walking up to it first, in VR straight onto it),
//     and getting up by moving (stand; onSeat either way), the seat's height (_standOnGround), which
//     setPose, setEyeLift, and entering and leaving VR keep to
//   the book, through the places where a site's own comes first: the open book is what a ray meets
//     first, a press on it is onBookPress (off it, onCloseBook puts it down), what is pointed at on
//     it lights, and while it is open it takes vrlbry's book controls (onPage, onBookAction):
//     desktop: a press on a page turns it (or follows a contents entry), on its toolbar or contents
//              uses what is there; ← → Space Page Up/Down turn, + − text size, N theme, C contents
//              (↑ ↓ Enter in it), P one page or two, T text view, F the book in front, Backspace
//              back, Esc closes the contents or the book; Q and E don't turn, and only WASD walks;
//              the wheel brings it nearer or farther
//     phone:   a tap, or a quick swipe turns the page; two fingers pinch it nearer or farther
//     gamepad: A on what the dot is on, LB RB or the D-pad ← → turn, D-pad ↑ ↓ text size, Y theme,
//              X contents, the triggers nearer or farther, the right stick pressed the book in
//              front, B back
//     headset: the trigger as a press; the right stick left or right turns, up or down nearer or
//              farther; the left stick up or down larger or smaller (walking waits until it is
//              put down); a grip moves it (onGrab); a thumbstick pressed brings it in front; B or Y
//              back
// Home is back to the start (onHome), anywhere. Per frame nothing is allocated.
import { Controls as Walking } from 'common/controls.js';
import { BUTTONS, held } from 'common/gamepad.js';
import { GARDEN, SEAT, castRay, clampWalk, groundAt, panelButtonAt, route } from './garden.js';

/**
 * What a ray meets in the garden (garden.js castRay) or on the open book (book.js pick): common's
 * Hit, with where on the control panel or the book's panel (u, v: 0…1 from its bottom left), and the
 * open book's: the page's side (-1 left, 1 right), the panel (its toolbar or contents) and what can
 * be used there, the page's index and a contents entry on it; off the book, panel, el and link are
 * null.
 * @typedef {import('common/controls.js').Hit & { u: number, v: number, side: number, panel: import('./canvas-panel.js').Panel | null, el: import('./canvas-panel.js').Control | null, page: number, link: import('./pages.js').Link | null }} GardenHit
 */
/** @typedef {import('common/controls.js').How} How */
/** @typedef {import('common/controls.js').Hand<GardenHit>} Hand */

/** While the book is open: these turn its pages instead. @type {Record<string, number>} */
const PAGE_KEYS = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1, Space: 1 };
/** While the book is open: the keys for what else it does (vrlbry's), by code (keyOf), as onBookAction's actions. @type {Record<string, string>} */
const BOOK_KEYS = { KeyC: 'contents', KeyN: 'theme', KeyP: 'pages', KeyT: 'textView', KeyF: 'front', Backspace: 'back', Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter' };
/**
 * A gamepad's buttons while the book is open (vrlbry's): [its index in the standard mapping,
 * action, value], 'turn' a page (onPage), the rest onBookAction's.
 * @type {[number, string, number?][]}
 */
const PAD_BOOK = [
  [BUTTONS.indexOf('x'), 'contents'], [BUTTONS.indexOf('y'), 'theme'],
  [BUTTONS.indexOf('lb'), 'turn', -1], [BUTTONS.indexOf('rb'), 'turn', 1],
  [BUTTONS.indexOf('left'), 'turn', -1], [BUTTONS.indexOf('right'), 'turn', 1],
  [BUTTONS.indexOf('up'), 'font', 1], [BUTTONS.indexOf('down'), 'font', -1],
  [BUTTONS.indexOf('rs'), 'front'],
];
const PAD_LT = BUTTONS.indexOf('lt'), PAD_RT = BUTTONS.indexOf('rt');
const WHEEL = 0.0006; // metres nearer or farther per wheel unit (vrlbry's)
const SWIPE = { distance: 60, ms: 500 }; // a quick swipe across turns the page; a slower drag looks

/** @type {(a: number) => number} */
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Walking about the garden: common's, with its ground, its bench and the book on it, and its
 * control panel.
 * @extends {Walking<GardenHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<GardenHit>, 'eye' | 'hit'> & { layout: ReturnType<typeof import('./garden.js').layoutGarden> }} options
   *   common's, and the garden's layout (garden.js layoutGarden)
   */
  constructor({ layout, ...options }) {
    super({ ...options, eye: GARDEN.eye, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, side: 0, panel: null, el: null, page: -1, link: null }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    /** The control panel's button pointed at, or null. @type {string | null} */
    this.hoverPanel = null;
    /** Sitting on the bench: { lift } (in VR, how far the rig is lowered to bring the head to a seated height), or null. @type {{ lift: number } | null} */
    this.seated = null;
    /**
     * The open book, when it is (book.js; main.js sets it): its pick is asked before the garden, so
     * its pages take presses, and while it is open the keys, the gamepad, the sticks, a swipe, a
     * pinch, the wheel and a grip are its. @type {import('./book.js').Book | null}
     */
    this.book = null;
    /** (button id) when a button of the control panel is pressed. @type {(id: string) => void} */
    this.onPanel = () => {};
    /** () when the bench is chosen (sit down), and when the book is (open it). */
    this.onBench = () => {};
    this.onBook = () => {};
    /** (side) a key or a stick turns a page of the open book: -1 back, 1 on. () close it. @type {(side: number) => void} */
    this.onPage = () => {};
    this.onCloseBook = () => {};
    /** (hit) the open book was pressed: a page, a contents entry on it, or its toolbar or contents (book.js pick, press). @type {(hit: GardenHit) => void} */
    this.onBookPress = () => {};
    /**
     * (action, value) the open book's other controls: 'font' ±1, 'theme', 'contents', 'contents-move'
     * ±1, 'enter', 'pages', 'textView', 'front', 'back', 'escape', 'distance' (metres), 'scale' (a fraction).
     * @type {(action: string, value?: number) => void}
     */
    this.onBookAction = () => {};
    /** (hand, on) a grip squeezed (or let go) in VR while the book is open: it moves with that hand. @type {(hand: Hand, on: boolean) => void} */
    this.onGrab = () => {};
    /** () Home: back to the start. */
    this.onHome = () => {};
    /** Sitting down, or getting up: (seated). @type {(seated: boolean) => void} */
    this.onSeat = () => {};
    this._padHeld = new Array(BUTTONS.length).fill(false); // the book's buttons, held last frame
    this._padWheel = 0; // seconds until the triggers move the book again
    this._pageArmed = true;
    // Each hand's B or Y, and its thumbstick, held last frame (by its index in hands).
    this._backHeld = [false, false];
    this._stickHeld = [false, false];
    /** Sitting when VR began: back onto the bench once the headset is lined up (_lineUp). */
    this._entrySeated = false;
    // Entering VR on the bench: up, for the headset to be lined up with where one was, then down
    // again. (Common's own sessionstart, before this, has set the entry and the rig's height.)
    this.renderer.xr.addEventListener('sessionstart', () => {
      this._entrySeated = this.seated !== null;
      this.seated = null;
    });
  }

  /**
   * Standing at (x, z), facing yaw (and pitch), off the bench: else its lift would hold the rig at
   * the seat's height there (_standOnGround), and the first step put one back on it (stand).
   * @param {number} x
   * @param {number} z
   * @param {number} yaw
   * @param {number} [pitch]
   */
  setPose(x, z, yaw, pitch) {
    if (this.seated) {
      this.seated = null;
      this.onSeat(false);
    }
    super.setPose(x, z, yaw, pitch);
  }

  /**
   * Raises the rig this far above the ground in VR (common/access.js eyeLift: 0.45 m in seated
   * mode, else 0), at once. On the bench the bench's own lift holds instead: it brings the head to
   * a seated eye over the seat from wherever the headset is, so a visitor already sitting is not
   * lowered further (nor the view moved at each change of a setting), and the lift comes back on
   * getting up.
   * @param {number} lift
   */
  setEyeLift(lift) {
    if (this.seated) this.eyeLift = lift;
    else super.setEyeLift(lift);
  }

  // ── The garden ──────────────────────────────────────────────────────────────

  /**
   * What a ray meets first: the open book (its contents, toolbar and pages: book.js pick), then the
   * garden (garden.js castRay).
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {GardenHit} out
   */
  castRay(ox, oy, oz, dx, dy, dz, out) {
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

  /**
   * The hedges, the far wall, the house but its doorway, the trunks, the bench, the bridge's rails
   * and the water (garden.js clampWalk).
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   */
  clampWalk(fx, fz, x, z, out) {
    return clampWalk(this.layout, fx, fz, x, z, out);
  }

  /**
   * The ground, which rises and falls, and the bridge's deck (garden.js groundAt).
   * @param {number} x
   * @param {number} z
   */
  groundAt(x, z) {
    return groundAt(this.layout, x, z);
  }

  /**
   * Round the water (over the bridge), the trunks and the bench, to where one may stand nearest
   * (x, z) (garden.js route).
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   */
  route(fx, fz, x, z) {
    return route(this.layout, fx, fz, x, z);
  }

  /**
   * What could be used where a hit is: a panel button's id, 'bench', 'book', 'page', 'bookui' (the
   * open book's toolbar or contents, where something is), or common's ('door').
   * @param {GardenHit | null} hit
   */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit?.kind === 'bookui') return hit.el ? 'bookui' : null;
    if (hit?.kind === 'page' || hit?.kind === 'book' || hit?.kind === 'bench') return hit.kind;
    return super.usable(hit);
  }

  /**
   * Uses what a hit is on: the open book, or off it puts it down (a press on nothing too); a panel
   * button, the book, the bench; on a screen, the water or ground one can't stand on, walked to as
   * near as one may stand; or common's (the doorway, ground to walk or teleport to).
   * @param {GardenHit | null} hit
   * @param {How} how
   */
  use(hit, how) {
    if (hit?.kind === 'page' || hit?.kind === 'bookui') this.onBookPress(hit);
    else if (this.book && hit?.kind !== 'panel') this.onCloseBook();
    else if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'book') this.onBook();
    else if (hit?.kind === 'bench') this.onBench();
    else if (how === 'screen' && hit && !hit.walkable && (hit.kind === 'water' || hit.kind === 'ground')) this.walkTo(hit.x, hit.z);
    else super.use(hit, how);
  }

  /**
   * @protected
   * @param {string | null} usable
   * @param {GardenHit | null} hit
   */
  _setHover(usable, hit) {
    super._setHover(usable, hit);
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
    // The open book's toolbar and contents light what is pointed at, and a contents entry its band.
    this.book?.setHover(hit?.kind === 'page' || hit?.kind === 'bookui' ? hit : null);
  }

  /**
   * Walks up to the door and through it (round the water, over the bridge): looking where it goes,
   * and facing the door on its last leg, from just in front of it (common's turn).
   */
  walkInto() {
    this.stand();
    const p = this.rig.position;
    const jamb = this.layout.door.width / 2 - 0.25;
    /** @type {[number, number]} */
    const front = [clamp(p.x, -jamb, jamb), -1.0];
    const points = p.z > -1.2 && Math.abs(p.x) < jamb ? [] : this.route(p.x, p.z, front[0], front[1]);
    points.push([front[0], 0.25]);
    this._startWalk(points, Math.PI);
  }

  /**
   * Back to the start (main.js resetView): standing at (x, z), facing yaw, level; in VR the head goes
   * there, the view blinking.
   * @param {number} x
   * @param {number} z
   * @param {number} yaw
   */
  resetTo(x, z, yaw) {
    this.auto = null;
    if (!this.renderer.xr.isPresenting) {
      this.stand();
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

  /** @param {string | null} id a panel button's, or null where there is none */
  _press(id) {
    if (id) this.onPanel(id);
  }

  // ── The bench ───────────────────────────────────────────────────────────────

  /**
   * Sits down on the bench, facing out over the pond: on a screen, walking up to it first; in VR
   * (where walks are the visitor's own), straight onto it, the view blinking.
   * @param {(() => void) | null} [then]
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

  /**
   * Onto the seat, from wherever one is.
   * @param {(() => void) | null} [then]
   */
  _seat(then = null) {
    this.auto = null;
    const s = this.layout.seat;
    if (this.renderer.xr.isPresenting) {
      this.camera.getWorldPosition(this._head);
      // Bring the head (however high it is held) to a seated eye over the seat.
      const local = this._head.y - this.rig.position.y;
      this.seated = { lift: s.y + SEAT.eye - local };
      this._turnAboutHead(wrapAngle(s.yaw - this._headYaw()));
      this._placeHead(s.x, s.z);
    } else {
      this.seated = { lift: s.y + SEAT.eye - this.eye };
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

  /**
   * Gets up from the bench (if sitting), to stand in front of it: whether one did. In VR the book is
   * put down first.
   */
  stand() {
    if (!this.seated) return false;
    const xr = this.renderer.xr.isPresenting;
    if (xr) this.onCloseBook();
    const f = this.layout.benchFront;
    this.seated = null;
    if (xr) this._placeHead(f.x, f.z);
    else {
      this.rig.position.x = f.x;
      this.rig.position.z = f.z;
    }
    this.rig.position.y = this.groundAt(f.x, f.z) + (xr ? this._riseXR() : 0);
    this.onSeat(false);
    return true;
  }

  /**
   * Keeps the rig on the ground under (x, z) (where the head is), `lift` above it, or at its seat.
   * @protected
   * @param {number} dt
   * @param {number} x
   * @param {number} z
   * @param {number} lift
   */
  _standOnGround(dt, x, z, lift) {
    if (!this.seated) {
      super._standOnGround(dt, x, z, lift);
      return;
    }
    const p = this.rig.position;
    p.y += (this.seated.lift - p.y) * (dt > 0 ? 1 - Math.exp(-dt * 18) : 1);
  }

  /**
   * A moment after entering VR: lined up as common's lines it up, then, if one was sitting, back
   * onto the bench.
   * @protected
   */
  _lineUp() {
    super._lineUp();
    if (this._entrySeated) this._seat();
  }

  /**
   * Leaving VR: on from where the headset was (common's), or still on the bench.
   * @protected
   */
  _onSessionEnd() {
    const seated = this.seated !== null;
    this.seated = null; // not getting up (onSeat): back on the seat below, as on a screen
    super._onSessionEnd();
    if (seated) this._seat();
  }

  // ── The book, and Home: where the garden's own comes first ─────────────────

  /**
   * Home anywhere; while the book is open, vrlbry's keys for it: what else it does, the text size,
   * the contents' entries (↑ ↓) and its pages (← →). Q and E don't turn while reading, so only WASD
   * walks.
   * @param {KeyboardEvent} e
   * @param {string} name keyOf(e)
   */
  takeKey(e, name) {
    if (name === 'Home') {
      e.preventDefault();
      this.onHome();
      return true;
    }
    if (!this.book) return false;
    const action = BOOK_KEYS[name] ?? (e.key === '+' || e.key === '=' || e.key === '-' ? 'font' : name === 'ArrowUp' || name === 'ArrowDown' ? 'contents-move' : null);
    if (action) {
      e.preventDefault();
      if (!e.repeat || action === 'contents-move') {
        this.onBookAction(action, action === 'font' ? (e.key === '-' ? -1 : 1) : name === 'ArrowUp' ? -1 : 1);
      }
      this.onActivity();
      return true;
    }
    if (name in PAGE_KEYS) {
      e.preventDefault();
      if (!e.repeat) this.onPage(PAGE_KEYS[name]);
      this.onActivity();
      return true;
    }
    return name === 'KeyQ' || name === 'KeyE';
  }

  /**
   * A gamepad's buttons for the open book (vrlbry's: PAD_BOOK), its triggers bringing it nearer or
   * farther, and B back in it first; whether any of them did something.
   * @param {Gamepad} pad
   * @param {number} dt
   * @param {import('common/controls.js').PadPress} press
   */
  takePad(pad, dt, press) {
    let used = false;
    for (let k = 0; k < PAD_BOOK.length; k++) {
      const b = PAD_BOOK[k], i = b[0];
      const on = held(pad, i);
      if (on && !this._padHeld[i] && this.book) {
        if (b[1] === 'turn') this.onPage(/** @type {number} */ (b[2])); // a turn has its side
        else this.onBookAction(b[1], b[2]);
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
    // B goes back in the book (its contents, the links followed, then it is put down).
    if (this.book && press.back) {
      press.back = false;
      this.onBookAction('back');
      used = true;
    }
    return used;
  }

  /**
   * Reading (vrlbry's): the right stick turns pages (left, right) and brings the book nearer or
   * farther (up, down), the left one makes it larger or smaller; walking waits until it is put
   * down. B or Y goes back in the book (the contents, the links followed, then it is put down), and
   * a thumbstick pressed brings it in front.
   * @param {Hand} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   * @param {number} dt
   */
  takeHand(hand, pad, ax, ay, dt) {
    const reading = this.book !== null;
    if (reading) {
      if (hand.source?.handedness === 'right') {
        this._pageStick(ax);
        if (Math.abs(ay) > 0.3) this.onBookAction('distance', ay * 0.4 * dt);
      } else if (Math.abs(ay) > 0.3) this.onBookAction('scale', -ay * 0.8 * dt);
    }
    const i = this.hands.indexOf(hand);
    const back = this.book !== null && !!pad.buttons[5]?.pressed;
    if (back && !this._backHeld[i]) this.onBookAction('back');
    this._backHeld[i] = back;
    const stick = this.book !== null && !!pad.buttons[3]?.pressed;
    if (stick && !this._stickHeld[i]) this.onBookAction('front');
    this._stickHeld[i] = stick;
    return reading;
  }

  /**
   * Right stick, reading: a push left or right turns a page.
   * @param {number} ax
   */
  _pageStick(ax) {
    if (this._pageArmed && Math.abs(ax) > 0.6) {
      this.onPage(Math.sign(ax));
      this._pageArmed = false;
    } else if (Math.abs(ax) < 0.3) this._pageArmed = true;
  }

  /**
   * A quick swipe across turns the open book's page (vrlbry's), the view left as it was; a slower
   * drag looks about.
   * @param {number} dx
   * @param {number} dy
   * @param {number} ms
   * @param {boolean} touch
   */
  takeSwipe(dx, dy, ms, touch) {
    if (!this.book || !touch) return false;
    if (Math.abs(dx) <= SWIPE.distance || Math.abs(dx) <= Math.abs(dy) * 1.5 || ms >= SWIPE.ms) return false;
    this.onPage(dx < 0 ? 1 : -1);
    return true;
  }

  /**
   * Two fingers pinch the open book nearer (apart) or farther (together), as the wheel does.
   * @param {number} apart
   */
  takePinch(apart) {
    if (!this.book || Math.abs(apart) <= 4) return false;
    this.onBookAction('distance', -apart * 2 * WHEEL);
    return true;
  }

  /**
   * The wheel brings the open book nearer or farther (vrlbry's).
   * @param {number} dy
   */
  takeWheel(dy) {
    if (!this.book) return false;
    this.onBookAction('distance', dy * WHEEL);
    return true;
  }

  /**
   * A grip moves the open book (vrlbry's); otherwise it waves (common's onSqueeze). Let go, the book
   * is let go of.
   * @param {Hand} hand
   * @param {boolean} on
   */
  takeGrip(hand, on) {
    if (on && !this.book) return false;
    this.onGrab(hand, on);
    return true;
  }
}
