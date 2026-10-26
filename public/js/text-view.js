// The text view, as vrlbry has it (its public/js/ui/text-view.js): on a screen, the open book's
// part as a page of text over the 3D view, for screen readers, the keyboard, zoom and phones. A
// part is the title page with the contents, one piece, or the sources (pages.js sectionBlocks),
// built as DOM nodes and text, never as HTML. The 3D book stays the reading place: opening the
// view scrolls it to the open page's first block, turning pages keeps it in step, and closing it
// leaves the book open at the block at the top of the view. Its header is the book's toolbar: the
// parts before and after, contents, text size, theme, where the reader is, Back, and putting the
// book down.
//
// renderPart, partOf and topBlock are pure (a document passed in), for the tests; TextView is the page's.
import { SECTION, folioLabel, progressOf, sectionBlocks, sectionCount } from './pages.js';

/** The parts: the title page with the contents (part 0), each piece, the sources. */
export const partCount = (book) => sectionCount(book) - 1;
/** The part a section of the book (pages.js SECTION) is in, and the sections of a part. */
export const partOf = (section) => Math.max(0, section - 1);
export const partSections = (part) => (part === 0 ? [SECTION.title, SECTION.contents] : [part + 1]);

/**
 * Part `part` of `book` as DOM nodes appended to `container`: a piece's title as an h2 (under the
 * view's own h1, the book's title, which the title page's heading would repeat), its author and
 * source, its paragraphs, its stanzas (lines as <br>s), the contents as a list of links, which
 * onLink(section) follows. Every block's element carries `data-s` and `data-b` (its place, as
 * pages.js numbers it), and the first of each the id `tv-<s>-<b>`.
 * @param {Document} doc
 * @param {Element} container
 * @param {{ title: string, subtitle: string, pieces: object[], colophon: string[] }} book
 * @param {number} part
 * @param {{ onLink?: (section: number, e: Event) => void }} [o]
 */
export function renderPart(doc, container, book, part, o = {}) {
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.setAttribute('class', cls);
    if (text) e.append(doc.createTextNode(text));
    return e;
  };
  const ids = new Set();
  const mark = (e, s, b) => {
    e.setAttribute('data-s', String(s));
    e.setAttribute('data-b', String(b));
    const id = `tv-${s}-${b}`;
    if (!ids.has(id)) {
      ids.add(id);
      e.setAttribute('id', id);
    }
    container.append(e);
    return e;
  };
  for (const s of partSections(part)) {
    let list = null;
    for (const block of sectionBlocks(book, s)) {
      if (block.kind !== 'entry') list = null;
      if (block.kind === 'heading') {
        if (s !== SECTION.title) mark(el('h2', null, block.text), s, block.b);
      } else if (block.kind === 'byline') {
        mark(el('p', 'tv-by', block.author), s, block.b);
        mark(el('p', 'tv-source', block.source), s, block.b);
      } else if (block.kind === 'paragraph') {
        mark(el('p', s === SECTION.title ? 'tv-sub' : null, block.text), s, block.b);
      } else if (block.kind === 'verse') {
        const p = el('p', 'tv-verse');
        block.lines.forEach((line, i) => {
          if (i) p.append(doc.createElement('br'));
          p.append(doc.createTextNode(line));
        });
        mark(p, s, block.b);
      } else if (block.kind === 'entry') {
        if (!list) list = mark(el('ul', 'tv-list'), s, -1);
        const li = el('li');
        li.setAttribute('data-s', String(s));
        li.setAttribute('data-b', String(block.b));
        const a = el('a', 'tv-link', block.title);
        a.setAttribute('href', `#tv-${block.to}--1`);
        const to = block.to;
        a.addEventListener?.('click', (e) => {
          e.preventDefault?.();
          o.onLink?.(to, e);
        });
        li.append(a, doc.createTextNode(` · ${block.author}`));
        list.append(li);
      }
    }
  }
}

/**
 * The block at the top of the view: the first whose bottom is below `top` (the toolbar's foot),
 * else the last. rects: each block's { s, b, top, bottom }, in the order shown.
 * @returns {[number, number, number]} its place (pages.js `at`), from its first word
 */
export function topBlock(rects, top) {
  for (const r of rects) if (r.bottom > top + 1) return [r.s, r.b, 0];
  const last = rects[rects.length - 1];
  return last ? [last.s, last.b, 0] : [SECTION.title, -1, 0];
}

/**
 * The words of an element, as pages.js counts a block's words (`at`'s third part): each [text
 * node, where in it the word starts], in order.
 */
export function wordStarts(el) {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const re = /\S+/g;
        for (let m = re.exec(c.data); m; m = re.exec(c.data)) out.push([c, m.index]);
      } else walk(c);
    }
  };
  walk(el);
  return out;
}

/** The first of `count` words whose line is below `top`: lineBottom(i) is word i's line's foot (it only grows with i). */
export function firstWordBelow(count, top, lineBottom) {
  let lo = 0, hi = count - 1;
  if (count === 0 || lineBottom(hi) <= top + 1) return Math.max(0, count - 1);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineBottom(mid) > top + 1) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// ---------------------------------------------------------------------------------------------
// The view on the page

const STATIC = `
  <header class="tv-bar">
    <button type="button" class="tv-prev" aria-label="Previous part">←<span class="tv-wide"> Previous part</span></button>
    <button type="button" class="tv-close" aria-label="Close text view" title="Back to the book in 3D (T or Esc)">Close<span class="tv-wide"> text view</span></button>
    <button type="button" class="tv-toc-btn" aria-expanded="false" aria-controls="tv-toc">Contents</button>
    <span class="tv-size" role="group" aria-label="Text size">
      <button type="button" class="tv-smaller"><span aria-hidden="true">A−</span><span class="sr-only">Smaller text</span></button><button type="button" class="tv-bigger"><span aria-hidden="true">A+</span><span class="sr-only">Larger text</span></button>
    </span>
    <label class="tv-theme"><span class="tv-wide">Theme</span> <select class="tv-theme-sel" aria-label="Theme"><option value="paper">Paper</option><option value="sepia">Sepia</option><option value="night">Night</option></select></label>
    <span class="tv-where"><span class="tv-label tv-wide" aria-hidden="true"></span><input class="tv-slider" type="range" min="0" max="1000" step="1" aria-label="Where in the book"></span>
    <button type="button" class="tv-back" hidden>↩ Back</button>
    <button type="button" class="tv-putback">Put<span class="tv-wide"> the book</span> down</button>
    <button type="button" class="tv-next" aria-label="Next part"><span class="tv-wide">Next part </span>→</button>
  </header>
  <nav class="tv-toc" id="tv-toc" aria-label="Contents" hidden><ol class="tv-toc-list"></ol></nav>
  <div class="tv-col">
    <p class="tv-partno"></p>
    <h1 id="tv-title" class="tv-title" tabindex="-1"></h1>
    <div class="tv-body"></div>
    <nav class="tv-parts" aria-label="At the end"><button type="button" class="tv-prev" aria-label="Previous part">←<span class="tv-wide"> Previous part</span></button><button type="button" class="tv-next" aria-label="Next part"><span class="tv-wide">Next part </span>→</button></nav>
  </div>`;

const isField = (t) => t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);

/**
 * The text view of the open book, on a screen. main.js calls follow() after every page turn or
 * jump of the 3D book (book.js onShow), close() as it is put down, and toggle() for T and the
 * overlay's "Text view".
 */
export class TextView {
  /**
   * @param {object} o
   * @param {HTMLElement} o.root where the view goes (inside the page's <main>)
   * @param {import('./book.js').Book} o.reader the 3D book
   * @param {object} o.text its words (reading.js: { title, subtitle, pieces, colophon })
   * @param {() => void} o.putDown puts the book down (main.js closeBook)
   * @param {() => void} o.back Back along the links (main.js: through the browser's history)
   * @param {() => boolean} o.presenting whether in VR (nothing shows there)
   * @param {() => void} [o.onOpen] the view has opened
   * @param {() => void} [o.onClose] the view has closed, the 3D book still open
   * @param {() => HTMLElement|null} [o.returnFocus] where focus goes when the view closes
   */
  constructor({ root, reader, text, putDown, back, presenting, onOpen = () => {}, onClose = () => {}, returnFocus = () => null }) {
    Object.assign(this, { book: reader, text, putDown, goBack: back, presenting, onOpen, onClose, returnFocus });
    const doc = root.ownerDocument;
    this.doc = doc;
    const el = doc.createElement('article');
    el.className = 'tv';
    el.hidden = true;
    el.tabIndex = -1; // a click on its text keeps the keys here (controls.js leaves them alone: data-own-keys)
    el.setAttribute('aria-labelledby', 'tv-title');
    el.setAttribute('data-own-keys', '');
    el.innerHTML = STATIC; // the view's own markup only: the book's text goes in as text (renderPart)
    root.append(el);
    this.el = el;
    this.$ = (sel) => el.querySelector(sel);
    this.part = -1; // the part shown
    this._open = false;
    // The place shared with the 3D book, [s, b, 0]: where the view put itself, or the block at its
    // top once the reader's own scrolling rests (_sync). The view's own scrolls are not reading:
    // _self while a smooth one runs, _selfTop where an instant one left the view. _moved: the
    // reader has scrolled since the place was taken.
    this._at = null;
    this._aim = null; // a place the view goes to, not the 3D page's first block (a size, a part)
    this._self = false;
    this._selfTop = null;
    this._moved = false;
    this._quiet = false; // a jump of the 3D book to the view's place: the view stays as it is
    this._wire();
  }

  get isOpen() { return this._open; }

  /** Whether its contents is open (Back closes it first: main.js). */
  get contentsOpen() { return this._open && !this.$('.tv-toc').hidden; }

  closeContents() {
    this._toggleToc(false);
  }

  _wire() {
    const B = this.book;
    const q = (sel, fn) => this.el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', fn));
    // What starts from the reader's place brings the 3D book there first (_sync), so a size, Back
    // or a turn starts from where the view is, not from where the 3D book was left.
    const synced = (fn) => () => {
      this._sync();
      fn();
    };
    q('.tv-close', () => this.close());
    q('.tv-toc-btn', () => this._toggleToc());
    q('.tv-smaller', synced(() => this._size(-1)));
    q('.tv-bigger', synced(() => this._size(1)));
    q('.tv-back', synced(() => this.goBack()));
    q('.tv-putback', () => this.putDown());
    q('.tv-prev', () => this._part(-1));
    q('.tv-next', () => this._part(1));
    this.$('.tv-theme-sel').addEventListener('change', (e) => this._theme(e.target.value));
    this.$('.tv-slider').addEventListener('change', (e) => B.jumpToProgress(Number(e.target.value) / 1000));
    this.el.addEventListener('scroll', () => {
      if (!this._self && this.el.scrollTop !== this._selfTop) this._moved = true;
      this._restSoon();
    }, { passive: true });
    // What Tab scrolls to stops below the sticky toolbar, not under it (and _scrollTo sets it at once).
    const bar = this.$('.tv-bar');
    new ResizeObserver(() => this.el.style.setProperty('--tv-bar-h', `${bar.offsetHeight}px`)).observe(bar);
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!this.$('.tv-toc').hidden) this._toggleToc(false);
        else this.close();
      } else if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) {
        // the slider's and the theme's own keys
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.turn(e.key === 'ArrowRight' ? 1 : -1);
      }
    });
  }

  /** ← →: the 3D book a page on or back from the reader's place, the view following it. */
  turn(side) {
    this._sync();
    this.book.turn(side);
  }

  /**
   * Reads on (dir 1) or back (-1) by most of what shows below the toolbar, a few lines staying in
   * sight: a TV's ↑ ↓ (main.js), its remote leaving the focus on the 3D view.
   */
  scrollStep(dir) {
    if (!this._open) return;
    const bar = this.$('.tv-bar').offsetHeight;
    this.el.scrollBy({ top: dir * Math.max(40, (this.el.clientHeight - bar) * 0.75), behavior: this.book.reduceMotion ? 'auto' : 'smooth' });
  }

  /** The text size, one step, the view staying at its place. */
  _size(step) {
    this._aim = this._at;
    this.book.changeFont(step);
    this._aim = null;
  }

  /** A theme: the colours change, the text and its place do not. */
  _theme(name) {
    this._quiet = true;
    try {
      this.book.setTheme(name);
    } finally {
      this._quiet = false;
    }
    this._style();
  }

  /** The view scrolled: once it rests (a quarter second), its place is shared (_rest). */
  _restSoon() {
    clearTimeout(this._restTimer);
    this._restTimer = setTimeout(() => this._rest(), 250);
  }

  _rest() {
    this._self = false;
    if (this._moved) this._sync();
  }

  /**
   * The reader's place, the block at the view's top once they have scrolled, becomes the shared
   * one: the 3D book goes there in place (the view covers it), unless it shows that block already.
   * Also at once, before anything that starts from the place (a size, Back, a turn).
   */
  _sync() {
    if (!this._open || !this.book.isOpen) return;
    if (this._moved) this._at = this._topBlock();
    this._moved = false;
    if (!this._at) return;
    this._quiet = true;
    try {
      this.book.jumpToPlace(this._at, { inPlace: true });
    } finally {
      this._quiet = false;
    }
  }

  /** T, and the overlay's "Text view" button: opens it, or closes it back to the 3D book. */
  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  /** Opens it at the open page's first block. A screen only: in VR nothing changes. */
  open() {
    if (this._open || !this.book.isOpen || this.presenting()) return;
    this._open = true;
    this.el.hidden = false;
    this.onOpen();
    this._style();
    this._show(this.book.place, { smooth: false });
    this.$('.tv-title').focus({ preventScroll: true });
    // Once it is drawn, the place again (a late change of layout must not leave it under the
    // toolbar), unless the reader has scrolled meanwhile.
    requestAnimationFrame(() => {
      if (this._open && !this._moved && !this._self && this._at) this._scrollTo(this._at, false);
    });
  }

  /**
   * Closes it, leaving the 3D book open at the block at the top of the view (keepPlace), and
   * gives focus back.
   */
  close({ keepPlace = true } = {}) {
    if (!this._open) return;
    const place = keepPlace && this.book.isOpen;
    if (place && this._moved) this._at = this._topBlock();
    clearTimeout(this._restTimer);
    this._moved = this._self = false;
    this._open = false;
    this._toggleToc(false);
    this.el.hidden = true;
    if (place && this._at) {
      this._quiet = true;
      try {
        this.book.jumpToPlace(this._at, { inPlace: true });
      } finally {
        this._quiet = false;
      }
    }
    if (place) this.onClose();
    this.returnFocus()?.focus?.({ preventScroll: true });
  }

  /** After every page turn or jump of the 3D book: the view follows it. */
  follow() {
    if (!this._open) return;
    this._style();
    if (this._quiet || !this.book.isOpen) {
      this._header(); // the 3D book came to the view's place
      return;
    }
    const aim = this._aim;
    this._aim = null;
    this._show(aim ?? this.book.place);
  }

  /** The theme's colours and the text size, as the 3D book has them. */
  _style() {
    const s = this.book.settings;
    this.el.setAttribute('data-theme', s.theme);
    this.el.setAttribute('data-motion', this.book.reduceMotion ? 'less' : 'full');
    this.el.style.setProperty('--tv-scale', String(s.fontScale));
    this.$('.tv-theme-sel').value = s.theme;
  }

  /** Shows the part a place is in (building it when it is another), scrolled to its block. */
  _show(at, { smooth = true } = {}) {
    if (!this._open || !at) return;
    const part = partOf(at[0]);
    if (part !== this.part) {
      // Focus in the view (a link just followed, which goes with the old part) moves to the new
      // part's heading, so the keyboard and a screen reader carry on from there.
      const active = this.doc.activeElement;
      const refocus = !active || active === this.doc.body || this.el.contains(active);
      const body = this.$('.tv-body');
      body.replaceChildren();
      renderPart(this.doc, body, this.text, part, {
        onLink: (section) => {
          this._sync();
          this.book.followLink(section); // Back returns here
        },
      });
      this.$('.tv-title').textContent = this.text.title;
      this.part = part;
      smooth = false;
      if (refocus) this.$('.tv-title').focus({ preventScroll: true });
    }
    this._header();
    this._at = [at[0], at[1], at[2] ?? 0];
    this._moved = false;
    this._scrollTo(this._at, smooth);
  }

  /**
   * Scrolls the place to just below the toolbar: the line with its word (a page of the 3D book
   * may begin in the middle of a paragraph), or its block, or (a part's heading) the top.
   */
  _scrollTo(at, smooth) {
    // The toolbar's height now, measured: its observer has not run yet when the view has just
    // been shown (hidden, the toolbar had none), and what Tab scrolls to clears it by this.
    const bar = this.$('.tv-bar');
    this.el.style.setProperty('--tv-bar-h', `${bar.offsetHeight}px`);
    const target = at[1] >= 0 || at[0] !== partSections(this.part)[0] ? this.el.querySelector(`[data-s="${at[0]}"][data-b="${at[1]}"]`) : null;
    const smoothly = !!target && smooth && !this.book.reduceMotion;
    if (smoothly) {
      this._self = true; // a while: its scroll events until it rests are its own
      this._restSoon();
    }
    let y = 0;
    if (target) {
      const word = at[2] > 0 ? wordStarts(target)[at[2]] : null;
      y = (word ? this._rangeRect(word).top : target.getBoundingClientRect().top) + this.el.scrollTop - bar.getBoundingClientRect().bottom;
    }
    this.el.scrollTo({ top: Math.max(0, Math.round(y)), behavior: smoothly ? 'smooth' : 'auto' });
    this._selfTop = smoothly ? null : this.el.scrollTop;
  }

  /** Where a word ([text node, offset], wordStarts) is drawn: its first letter's box. */
  _rangeRect([node, offset]) {
    const r = (this._range ??= this.doc.createRange());
    r.setStart(node, offset);
    r.setEnd(node, Math.min(node.data.length, offset + 1));
    return r.getBoundingClientRect();
  }

  /** Where the reader is, Back, and the parts. */
  _header() {
    const B = this.book;
    const indices = B.readingPages();
    const label = folioLabel(B.pages, indices);
    this.$('.tv-label').textContent = label;
    const slider = this.$('.tv-slider');
    slider.value = String(Math.round(progressOf(B.pages, B.readingIndex()) * 1000));
    slider.setAttribute('aria-valuetext', /\//.test(label) ? `Page ${label.replace(' / ', ' of ')}` : label);
    this.$('.tv-back').hidden = !B.trail.length;
    const n = partCount(this.text);
    for (const b of this.el.querySelectorAll('.tv-prev')) b.disabled = this.part <= 0;
    for (const b of this.el.querySelectorAll('.tv-next')) b.disabled = this.part >= n - 1;
    this.$('.tv-partno').textContent = `Part ${this.part + 1} of ${n}`;
  }

  /** The previous or next part, from its start. */
  _part(dir) {
    const part = this.part + dir;
    if (part < 0 || part >= partCount(this.text)) return;
    this._goTo(partSections(part)[0]);
  }

  /** A section's part, from its start: the previous or next one, or a piece in the contents. */
  _goTo(section) {
    const at = [section, -1, 0];
    this._aim = at;
    // The spread may show the part's start already (a piece begun on its right-hand page): the
    // view goes there anyway.
    if (!this.book.jumpToPlace(at)) this.follow();
    this._aim = null;
    this.$('.tv-title').focus({ preventScroll: true });
  }

  /** The contents: the pieces, each a link to its start (as the 3D contents goes there, without a trail). */
  _toggleToc(show = this.$('.tv-toc').hidden) {
    const nav = this.$('.tv-toc');
    const btn = this.$('.tv-toc-btn');
    if (show && !this._tocFilled) {
      const list = this.$('.tv-toc-list');
      list.replaceChildren();
      this.text.pieces.forEach((piece, i) => {
        const li = this.doc.createElement('li');
        const a = this.doc.createElement('a');
        const section = SECTION.piece + i;
        a.href = `#tv-${section}--1`;
        a.textContent = piece.title;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          this._toggleToc(false);
          this.book.toggleContents(false);
          this._goTo(section);
        });
        li.append(a, this.doc.createTextNode(` · ${piece.author}`));
        list.append(li);
      });
      this._tocFilled = true;
    }
    // Closed from inside (Esc), focus goes back to its button, not to the page.
    if (!show && !nav.hidden && nav.contains(this.doc.activeElement)) btn.focus({ preventScroll: true });
    // A panel under the toolbar, over the text, so the reader's place stays where it is.
    if (show) {
      const top = Math.max(0, this.$('.tv-bar').getBoundingClientRect().bottom);
      nav.style.top = `${top}px`;
      nav.style.maxHeight = `min(60vh, ${Math.max(80, innerHeight - top - 8)}px)`;
    }
    nav.hidden = !show;
    btn.setAttribute('aria-expanded', String(!!show));
    if (show) {
      // Focus on where the reader is: the piece being read, else the first.
      const links = [...nav.querySelectorAll('a')];
      const here = links[Math.max(0, Math.min(links.length - 1, (this._at?.[0] ?? 0) - SECTION.piece))];
      here?.focus({ preventScroll: true });
    }
  }

  /** The place at the top of the view: the block there, and the word on its first line in sight. */
  _topBlock() {
    const top = this.el.getBoundingClientRect().top + this.$('.tv-bar').getBoundingClientRect().height;
    const rects = [];
    const nodes = [];
    for (const n of this.$('.tv-body').querySelectorAll('[data-b]')) {
      if (n.tagName === 'UL') continue; // the contents' items are its blocks
      const r = n.getBoundingClientRect();
      rects.push({ s: Number(n.getAttribute('data-s')), b: Number(n.getAttribute('data-b')), top: r.top, bottom: r.bottom });
      nodes.push(n);
    }
    const at = topBlock(rects, top);
    const i = rects.findIndex((r) => r.s === at[0] && r.b === at[1]);
    // A paragraph or stanza begun above the top: from its first word in sight.
    if (i >= 0 && at[1] >= 0 && rects[i].top < top - 1) {
      const words = wordStarts(nodes[i]);
      at[2] = firstWordBelow(words.length, top, (k) => this._rangeRect(words[k]).bottom);
    }
    return at;
  }
}
