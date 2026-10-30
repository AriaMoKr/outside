// The page around the 3D view (not shown in a headset), as the hallway's: the garden's name and
// the way back to the hallway as a plain link (for keyboards, screen readers and browsers without
// WebGL), and what the garden offers in 3D as real controls as well: sitting on the bench and
// getting up, reading the book (from anywhere: one walks to the bench first, as in 3D), starting or
// leaving a shared session, and Settings, the panel on the wall's choices: motion (common/access.js,
// for a screen too), how to move and turn in VR, the comfort vignette and seated mode; and, as in
// vrlbry, "Open the book as text" and "Reset view". While the book is open, the card has what its
// keys do too (Contents, the text size, one page or two, the theme, Text view, in front of me),
// and "Text view" by the buttons at the foot opens its words as a page of text (text-view.js). The
// card is the page's <nav>; the view is its <main>, with a hint on how to move (or, with the book
// open, how to read), the Fullscreen and Enter VR buttons, Wave and Copy invite link while in a
// shared session, the dot a gamepad (or a TV's remote) aims with, short messages, and the open
// book's words for a screen reader. On a TV (common's tv.js) the hint is the remote's, and there is
// nothing to copy a link to: the invite link is shown in the card, to open on another device.

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
  touch: 'Tap or swipe a page to turn it · pinch it nearer · tap off the book to put it down',
  mouse: 'Click a page or ← → to turn it · C contents · T text view · Esc puts it down',
  gamepad: 'A on a page, or LB RB, turns it · X contents · B goes back, then puts it down',
};
/** A TV's remote (common's tv.js): walking, sitting, reading, reading as text, and in the card (the reader's or the walker's). */
const TV = {
  walk: 'Arrows: walk and turn · OK: what the dot is on · Menu or hold Back: sit, read and settings\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
  sit: 'OK: read the book · Back: stand up · Menu or hold Back: the card',
  read: '← →: turn the page · OK: the contents, ↑ ↓ in it · Menu: the book\'s controls · Back: one step back',
  text: '↑ ↓: read on · ← →: a page · Menu: its toolbar · Back: the book in 3D',
  card: 'Up, down: from control to control · left, right: a choice · OK: choose · Back: walk again',
  cardReading: 'Up, down: from control to control · left, right: a choice · OK: choose · Back: read again',
};
const THEME_NAMES = { paper: 'Paper', sepia: 'Sepia', night: 'Night' };

export class Overlay {
  /**
   * @param {{ url: string, label: string, title: string }} way the way back (common/door.js wayBack)
   * @param {object} [o]
   * @param {() => string} [o.href] the address the way back opens now (it carries the shared session)
   * @param {() => void} [o.onLeave] called when its link is followed
   * @param {boolean} [o.tv] the TV app's page (common's tv.js tvMode)
   */
  constructor(way, { href = () => way.url, onLeave = () => {}, tv = false } = {}) {
    this.root = document.getElementById('overlay');
    this.tv = tv;
    this.view = document.getElementById('view-overlay');
    this.href = href;
    this.back = el('a', { class: 'way-back', href: href(), title: way.title }, way.label);
    this.back.addEventListener('click', () => onLeave());
    // What one can do in the garden, without pointing at it in 3D.
    /** (sit) true to sit on the bench (walking there first on a screen), false to get up. @type {(sit: boolean) => void} */
    this.onBench = () => {};
    this.onRead = () => {};
    this.onSession = () => {};
    /** (key, value) a movement choice for VR: 'move' 'smooth' or 'teleport', 'turn' 'snap' or 'smooth'. @type {(key: string, value: string) => void} */
    this.onNav = () => {};
    /** (change) accessibility settings changed (common/access.js), such as { motion: 'reduce' } or { seated: true }. @type {(change: Record<string, string | boolean>) => void} */
    this.onAccess = () => {};
    /** The open book's words as a page of text (text-view.js); the book back in front of the eyes; back to the start. */
    this.onTextView = () => {};
    this.onFront = () => {};
    this.onReset = () => {};
    /** (action, value) what the open book's keys do (controls.js onBookAction): 'contents', 'font' ±1, 'pages', 'theme'. @type {(action: string, value?: number) => void} */
    this.onBook = () => {};
    /** (on) "Open the book as text" (book.js settings.textView). @type {(on: boolean) => void} */
    this.onTextViewPref = () => {};
    this._seated = false;
    this.bench = el('button', { class: 'chip', type: 'button' }, 'Sit on the bench');
    this.bench.addEventListener('click', () => this.onBench(!this._seated));
    this.read = el('button', { class: 'chip', type: 'button' }, 'Read the book');
    this.read.addEventListener('click', () => this.onRead());
    this.textView = el('button', { class: 'pill', type: 'button', hidden: '', title: 'The open book as a page of text (T)' }, 'Text view');
    this.textView.addEventListener('click', () => this.onTextView());
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
    this.asText = el('input', { type: 'checkbox', name: 'textView' });
    this.asText.addEventListener('change', () => this.onTextViewPref(this.asText.checked));
    // While the book is open: what its keys do (controls.js BOOK_KEYS), for a TV's remote, which has
    // no letters, and for whoever reaches the card rather than the 3D toolbar.
    const tool = (label, attrs, fn) => {
      const b = el('button', { class: 'chip', type: 'button', ...attrs }, ...[label].flat());
      b.addEventListener('click', fn);
      return b;
    };
    this.contents = tool('Contents', { 'aria-pressed': 'false', 'aria-keyshortcuts': 'C', title: 'The contents beside the pages (C)' }, () => this.onBook('contents'));
    // A− and A+ are signs, not words: their names are the words, kept out of sight.
    const sign = (glyph, name) => [el('span', { 'aria-hidden': 'true' }, glyph), el('span', { class: 'sr-only' }, name)];
    const smaller = tool(sign('A−', 'Smaller text'), { title: 'Smaller text (−)' }, () => this.onBook('font', -1));
    const larger = tool(sign('A+', 'Larger text'), { title: 'Larger text (+)' }, () => this.onBook('font', 1));
    this.pages = tool('One page', { 'aria-keyshortcuts': 'P', title: 'One page at a time, or two (P)' }, () => this.onBook('pages'));
    this.theme = tool('Theme: Paper', { 'aria-keyshortcuts': 'N', title: 'The next theme: paper, sepia, night (N)' }, () => this.onBook('theme'));
    this.asTextNow = tool('Text view', { 'aria-keyshortcuts': 'T', title: 'The open book as a page of text (T)' }, () => this.onTextView());
    this.front = tool('In front of me', { 'aria-label': 'Bring the book in front of me', 'aria-keyshortcuts': 'F', title: 'Bring the book in front of me (F)' }, () => this.onFront());
    this.bookTools = el('section', { class: 'book-tools', 'aria-label': 'The book', hidden: '' },
      el('div', { class: 'actions' }, this.contents, smaller, larger, this.pages, this.theme, this.asTextNow, this.front));
    this._book = { contents: false, single: false, theme: 'paper' };
    const reset = el('button', { class: 'chip', type: 'button', title: 'Home: the book put down, its size and distance as at first, and you at the door' }, 'Reset view');
    reset.addEventListener('click', () => this.onReset());
    this.settings = el('div', { class: 'settings', id: 'settings', hidden: '' },
      choice('motion', 'Motion', [['system', 'System'], ['reduce', 'Less'], ['full', 'Full']], (key, value) => this.onAccess({ [key]: value })),
      choice('move', 'Move in VR', [['smooth', 'Smooth'], ['teleport', 'Teleport']], (key, value) => this.onNav(key, value)),
      choice('turn', 'Turn in VR', [['snap', 'Snap'], ['smooth', 'Smooth']], (key, value) => this.onNav(key, value)),
      el('fieldset', {}, el('legend', {}, 'In VR'), toggle('vignette', 'Comfort vignette'), toggle('seated', 'Seated mode')),
      el('fieldset', {}, el('legend', {}, 'The book'), el('label', {}, this.asText, 'Open it as text')),
      el('div', { class: 'actions' }, reset));
    this.settingsToggle.addEventListener('click', () => {
      const open = this.settings.hidden;
      this.settings.hidden = !open;
      this.settingsToggle.setAttribute('aria-expanded', String(open));
    });
    this.card = el('nav', { class: 'card', 'aria-label': 'Outside' },
      el('header', {}, el('h1', { class: 'brand' }, 'Outside'), this.back),
      el('p', { class: 'tagline' }, 'A garden outside the Hallway: a lawn, a stream and a pond, a foot bridge, and a bench to read on'),
      this.inGarden = el('section', { class: 'garden', 'aria-label': 'In the garden' },
        this.bookTools,
        el('div', { class: 'actions' }, this.bench, this.read, this.session, this.settingsToggle),
        this.settings));
    // On a TV, the address others open to join the shared session (setInvite).
    this.inviteText = tv ? el('p', { class: 'invite-text', hidden: '' }) : null;
    if (this.inviteText) this.inGarden.insertBefore(this.inviteText, this.settings);
    this.hint = el('p', { class: 'hint', id: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.wave = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Wave');
    this.onWave = () => {};
    this.wave.addEventListener('click', () => this.onWave());
    this.buttons = el('div', { class: 'buttons' }, this.textView, this.wave, this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    // The open book's words for a screen reader, out of sight (the 3D book is what one sees): while
    // it is open, a region named for the book holds the pages open, said politely as they turn.
    this.bookText = el('div', { class: 'sr-only', 'aria-live': 'polite' });
    this.root.append(this.card);
    this.view.append(this.hint, this.buttons, this.dot, this.toasts, this.bookText);
    this._how = 'mouse';
    this._reading = false;
    this._inCard = false; // a TV's: the remote in the card (Menu), not walking
    this._textView = false;
    addEventListener('resize', () => this._placeHint());
  }

  /** @param {'mouse'|'touch'|'gamepad'|'tv'} how */
  setHint(how) {
    this._how = how;
    this._showHint();
  }

  /** On a TV: the remote in the card (Menu), or walking (or reading) again; the hint says what it does now. */
  setInCard(on) {
    this._inCard = on;
    if (this._how === 'tv') this._showHint();
  }

  /** The text view open or closed: on a TV, its hint (how to read it with the remote), else the hint goes. */
  setTextView(on) {
    if (this._textView === on) return;
    this._textView = on;
    if (this._how === 'tv') this._showHint();
    else if (on) this.hideHint();
  }

  /**
   * What the open book shows now, for its controls in the card: the contents beside it or not, a
   * page at a time or two, the theme. Called each frame while reading: only a change touches them.
   */
  setBook(contents, single, theme) {
    const b = this._book;
    if (b.contents !== contents) this.contents.setAttribute('aria-pressed', String((b.contents = contents)));
    if (b.single !== single) this.pages.textContent = (b.single = single) ? 'Two pages' : 'One page';
    if (b.theme !== theme) this.theme.textContent = `Theme: ${THEME_NAMES[(b.theme = theme)] ?? theme}`;
  }

  /**
   * The book open (or put down): the hint says for a while how to read it (on a TV, the remote's,
   * again once it is down); Text view (by the buttons at the foot, but not on a TV) and the book's
   * keys in the card show; and, as in vrlbry, the card goes out of the book's way, coming back when
   * the keyboard goes into it (style.css).
   */
  setReading(on) {
    if (this._reading === on) return;
    this._reading = on;
    this.root.classList.toggle('reading', on);
    this.read.textContent = on ? 'Put the book down' : 'Read the book';
    this.bookTools.hidden = !on;
    this.textView.hidden = !on || this.tv; // a TV's remote has it in the card
    this._placeHint();
    if (on) this._showHint(this._how === 'tv' ? 12 : 8);
    else if (this._how === 'tv') this._showHint();
    else this.hideHint();
  }

  /** "Open it as text", as it is now. */
  setTextViewPref(on) {
    this.asText.checked = on;
  }

  /** Sitting on the bench, or not: the bench's button sits down, or gets up; on a TV, the hint says what the remote does now. */
  setSeated(on) {
    if (this._seated === on) return;
    this._seated = on;
    this.bench.textContent = on ? 'Get up' : 'Sit on the bench';
    if (this._how === 'tv') this._showHint();
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
    this.hint.textContent = this._how !== 'tv' ? (this._reading ? READING : HINTS)[this._how]
      : this._inCard ? (this._reading ? TV.cardReading : TV.card)
      : this._textView ? TV.text : this._reading ? TV.read : this._seated ? TV.sit : TV.walk;
    this._placeHint();
    clearTimeout(this._hintTimer);
    if (seconds) this._hintTimer = setTimeout(() => this.hideHint(), seconds * 1000);
  }

  /**
   * Keeps the hint clear of the buttons at the foot (Text view, Wave, Fullscreen, Enter VR…): in
   * the middle where it fits beside them, else in the space beside them (wrapping within it),
   * else above them (a narrow screen). Again whenever they or the window change.
   */
  _placeHint() {
    const s = this.hint.style;
    s.left = s.bottom = s.maxWidth = '';
    let left = Infinity, top = Infinity;
    for (const b of this.buttons.children) {
      if (b.hidden) continue;
      const r = b.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
    }
    const h = this.hint.getBoundingClientRect();
    const gap = 12, margin = 16;
    if (left === Infinity || h.right <= left - gap || h.bottom <= top - 4) return;
    const room = left - gap - margin;
    if (room >= 260) {
      s.left = `${margin + room / 2}px`;
      s.maxWidth = `${room}px`;
    } else s.bottom = `${innerHeight - top + 8}px`;
  }

  hideHint() {
    this.hint.classList.add('gone');
  }

  /**
   * The pages open, for a screen reader: a region named `title` (the book's), its heading `label`
   * (where one is: 'Pages 4 and 5'), then `blocks`, their words, the book's headings under it
   * (pages.js readingText). Each call replaces the last, and is announced.
   */
  showBookText(title, { label, blocks }) {
    const block = (b) => {
      if (b.kind === 'heading') return el(`h${b.level}`, {}, b.text);
      if (b.kind === 'list') return el('ul', {}, ...b.items.map((item) => el('li', {}, item)));
      if (b.kind === 'verse') return el('p', {}, ...b.lines.flatMap((line, i) => (i ? [el('br'), line] : [line])));
      return el('p', {}, b.text);
    };
    this.bookText.replaceChildren(el('section', { 'aria-label': title }, el('h2', {}, label), ...blocks.map(block)));
  }

  /** The book put down: its words go. */
  hideBookText() {
    this.bookText.replaceChildren();
  }

  /** Works out the way back's link again (it carries the shared session's room). */
  refreshLinks() {
    this.back.setAttribute('href', this.href());
  }

  showVR(onClick) {
    this.vr.hidden = false;
    this._placeHint();
    this.vr.addEventListener('click', onClick);
  }

  /** The shared session's invite link (together.js), or '' when not in one: hides the button. On a TV, the link to open elsewhere. */
  setInvite(link) {
    this._inviteLink = link;
    if (this.inviteText) {
      this.inviteText.hidden = !link;
      if (link) this.inviteText.replaceChildren('To join from a phone or a computer, open ', el('span', { class: 'invite-link' }, link.replace(/^https?:\/\//, '')));
      return;
    }
    this.invite.hidden = !link;
    this._placeHint();
  }

  /** In a shared session (together.js active), or not: the Wave button shows while one is. */
  setTogether(active) {
    this.wave.hidden = !active;
    this._placeHint();
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
    this._placeHint();
    this.fullscreen.addEventListener('click', onClick);
  }

  setFullscreen(on) {
    this.fullscreen.textContent = on ? '✕ Exit fullscreen' : 'Fullscreen';
    this._placeHint();
    this.fullscreen.classList.toggle('on', on);
  }

  /** The dot in the middle of the view that a gamepad (or a TV's remote) aims with; larger and filled on something A (or OK) would use. */
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
