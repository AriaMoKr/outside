// The page around the 3D view (not shown in a headset), as the hallway's: the garden's name and
// the way back to the hallway as a plain link (for keyboards, screen readers and browsers without
// WebGL), and what the garden offers in 3D as real controls as well: sitting on the bench and
// getting up, reading the book (from anywhere: one walks to the bench first, as in 3D), starting or
// leaving a shared session, and Settings, the panel on the wall's choices: motion (common/access.js,
// for a screen too), how to move and turn in VR, the comfort vignette and seated mode. The card is
// the page's <nav>; the view is its <main>, with a hint on how to move (or, with the book open, how
// to read), the Fullscreen and Enter VR buttons, Wave and Copy invite link while in a shared
// session, the dot a gamepad aims with, and short messages.

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}

const HINTS = {
  touch: 'Drag to look · tap the ground to walk · tap the bench to sit and read',
  mouse: 'Drag to look around · WASD or arrows to walk · click the bench to sit and read',
  gamepad: 'Right stick to look · left stick to walk · A on the bench to sit and read',
};
const READING = {
  touch: 'Tap a page to turn it · tap off the book to put it down',
  mouse: 'Click a page, or ← →, to turn it · Esc puts the book down',
  gamepad: 'A on a page turns it · B puts the book down',
};

export class Overlay {
  /**
   * @param {{ url: string, label: string, title: string }} way the way back (common/door.js wayBack)
   * @param {object} o
   * @param {() => string} o.href the address the way back opens now (it carries the shared session)
   * @param {() => void} o.onLeave called when its link is followed
   */
  constructor(way, { href = () => way.url, onLeave = () => {} } = {}) {
    this.root = document.getElementById('overlay');
    this.view = document.getElementById('view-overlay');
    this.href = href;
    this.back = el('a', { class: 'way-back', href: href(), title: way.title }, way.label);
    this.back.addEventListener('click', () => onLeave());
    // What one can do in the garden, without pointing at it in 3D.
    /** (sit) true to sit on the bench (walking there first on a screen), false to get up. */
    this.onBench = () => {};
    this.onRead = () => {};
    this.onSession = () => {};
    /** (key, value) a movement choice for VR: 'move' 'smooth' or 'teleport', 'turn' 'snap' or 'smooth'. */
    this.onNav = () => {};
    /** (change) accessibility settings changed (common/access.js), such as { motion: 'reduce' } or { seated: true }. */
    this.onAccess = () => {};
    this._seated = false;
    this.bench = el('button', { class: 'chip', type: 'button' }, 'Sit on the bench');
    this.bench.addEventListener('click', () => this.onBench(!this._seated));
    this.read = el('button', { class: 'chip', type: 'button' }, 'Read the book');
    this.read.addEventListener('click', () => this.onRead());
    this.session = el('button', { class: 'chip', type: 'button' }, 'Start shared session');
    this.session.addEventListener('click', () => this.onSession());
    this.settingsToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'settings' }, 'Settings');
    this.choices = new Map(); // 'move:smooth' → its radio button, 'vignette' → its checkbox
    const choice = (key, legend, options, apply) => el('fieldset', {}, el('legend', {}, legend), ...options.map(([value, label]) => {
      const input = el('input', { type: 'radio', name: key, value });
      input.addEventListener('change', () => {
        if (input.checked) apply(key, value);
      });
      this.choices.set(`${key}:${value}`, input);
      return el('label', {}, input, label);
    }));
    const toggle = (key, label) => {
      const input = el('input', { type: 'checkbox', name: key });
      input.addEventListener('change', () => this.onAccess({ [key]: input.checked }));
      this.choices.set(key, input);
      return el('label', {}, input, label);
    };
    this.settings = el('div', { class: 'settings', id: 'settings', hidden: '' },
      choice('motion', 'Motion', [['system', 'System'], ['reduce', 'Less'], ['full', 'Full']], (key, value) => this.onAccess({ [key]: value })),
      choice('move', 'Move in VR', [['smooth', 'Smooth'], ['teleport', 'Teleport']], (key, value) => this.onNav(key, value)),
      choice('turn', 'Turn in VR', [['snap', 'Snap'], ['smooth', 'Smooth']], (key, value) => this.onNav(key, value)),
      el('fieldset', {}, el('legend', {}, 'In VR'), toggle('vignette', 'Comfort vignette'), toggle('seated', 'Seated mode')));
    this.settingsToggle.addEventListener('click', () => {
      const open = this.settings.hidden;
      this.settings.hidden = !open;
      this.settingsToggle.setAttribute('aria-expanded', String(open));
    });
    this.card = el('nav', { class: 'card', 'aria-label': 'Outside' },
      el('header', {}, el('h1', { class: 'brand' }, 'Outside'), this.back),
      el('p', { class: 'tagline' }, 'A garden outside the Hallway: a lawn, a stream and a pond, a foot bridge, and a bench to read on'),
      this.inGarden = el('section', { class: 'garden', 'aria-label': 'In the garden' },
        el('div', { class: 'actions' }, this.bench, this.read, this.session, this.settingsToggle),
        this.settings));
    this.hint = el('p', { class: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.wave = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Wave');
    this.onWave = () => {};
    this.wave.addEventListener('click', () => this.onWave());
    this.buttons = el('div', { class: 'buttons' }, this.wave, this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.card);
    this.view.append(this.hint, this.buttons, this.dot, this.toasts);
    this._how = 'mouse';
    this._reading = false;
  }

  /** @param {'mouse'|'touch'|'gamepad'} how */
  setHint(how) {
    this._how = how;
    this._showHint();
  }

  /** The book open (or put down): the hint says how to read it, while it is. */
  setReading(on) {
    if (this._reading === on) return;
    this._reading = on;
    this.read.textContent = on ? 'Put the book down' : 'Read the book';
    if (on) this._showHint(0);
    else this.hideHint();
  }

  /** Sitting on the bench, or not: the bench's button sits down, or gets up. */
  setSeated(on) {
    this._seated = on;
    this.bench.textContent = on ? 'Get up' : 'Sit on the bench';
  }

  /** In a shared session (or paused in one, going through a door), or not: its button leaves, or starts one. */
  setSession(on) {
    this.session.textContent = on ? 'Leave shared session' : 'Start shared session';
  }

  /** The settings as they are now: the VR movement choices (common/nav.js) and the accessibility settings (common/access.js). */
  setChoices({ move, turn }, { motion, vignette, seated }) {
    const on = new Set([`move:${move}`, `turn:${turn}`, `motion:${motion}`]);
    if (vignette) on.add('vignette');
    if (seated) on.add('seated');
    for (const [id, input] of this.choices) input.checked = on.has(id);
  }

  _showHint(seconds = 12) {
    this.hint.classList.remove('gone');
    this.hint.textContent = (this._reading ? READING : HINTS)[this._how];
    clearTimeout(this._hintTimer);
    if (seconds) this._hintTimer = setTimeout(() => this.hideHint(), seconds * 1000);
  }

  hideHint() {
    if (this._reading) return;
    this.hint.classList.add('gone');
  }

  /** Works out the way back's link again (it carries the shared session's room). */
  refreshLinks() {
    this.back.setAttribute('href', this.href());
  }

  showVR(onClick) {
    this.vr.hidden = false;
    this.vr.addEventListener('click', onClick);
  }

  /** The shared session's invite link (together.js), or '' when not in one: hides the button. */
  setInvite(link) {
    this._inviteLink = link;
    this.invite.hidden = !link;
  }

  /** In a shared session (together.js active), or not: the Wave button shows while one is. */
  setTogether(active) {
    this.wave.hidden = !active;
  }

  async _copyInvite() {
    const link = this._inviteLink;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.toast('Invite link copied: anyone who opens it joins you here');
    } catch {
      prompt('Copy this link to invite others:', link);
    }
  }

  showFullscreen(onClick) {
    this.fullscreen.hidden = false;
    this.fullscreen.addEventListener('click', onClick);
  }

  setFullscreen(on) {
    this.fullscreen.textContent = on ? '✕ Exit fullscreen' : 'Fullscreen';
    this.fullscreen.classList.toggle('on', on);
  }

  /** The dot in the middle of the view that a gamepad aims with; larger and filled on something A would use. */
  setAim(on, hover = false) {
    if (this.dot.hidden !== !on) this.dot.hidden = !on;
    if (this.dot.classList.contains('hover') !== hover) this.dot.classList.toggle('hover', hover);
  }

  toast(text, seconds = 3.5) {
    const t = el('div', { class: 'toast' }, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), seconds * 1000);
  }

  /** No 3D view: the way back is all there is. */
  noWebGL(message) {
    this.card.classList.add('alone');
    this.inGarden.remove();
    this.card.append(el('p', { class: 'no-webgl' }, message));
    this.hint.remove();
  }
}
