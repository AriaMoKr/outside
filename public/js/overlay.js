// The page around the 3D view (not shown in a headset), as the hallway's: the garden's name and
// the way back to the hallway as a plain link (for keyboards, screen readers and browsers without
// WebGL), a hint on how to move (or, with the book open, how to read), the Fullscreen and Enter VR
// buttons, Wave and Copy invite link while in a shared session, the dot a gamepad aims with, and
// short messages.

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
    this.href = href;
    this.back = el('a', { class: 'way-back', href: href(), title: way.title }, way.label);
    this.back.addEventListener('click', () => onLeave());
    this.card = el('nav', { class: 'card', 'aria-label': 'Outside' },
      el('header', {}, el('h1', { class: 'brand' }, 'Outside'), this.back),
      el('p', { class: 'tagline' }, 'A garden outside the Hallway: a lawn, a stream and a pond, a foot bridge, and a bench to read on'));
    this.hint = el('p', { class: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.wave = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Wave');
    this.onWave = () => {};
    this.wave.addEventListener('click', () => this.onWave());
    // On the bench, the book lies beside one, out of sight on a screen: this opens it (and puts it down).
    this.read = el('button', { class: 'pill read', type: 'button', hidden: '' }, 'Read the book');
    this.onRead = () => {};
    this.read.addEventListener('click', () => this.onRead());
    this.buttons = el('div', { class: 'buttons' }, this.read, this.wave, this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.card, this.hint, this.buttons, this.dot, this.toasts);
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

  /** Sitting on the bench, or not: the button that opens the book shows while one is. */
  setSeated(on) {
    this.read.hidden = !on;
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
    this.card.append(el('p', { class: 'no-webgl' }, message));
    this.hint.remove();
  }
}
