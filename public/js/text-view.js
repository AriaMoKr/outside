// The text view, as vrlbry has it: on a screen, the open book's part as a page of text over the 3D
// view, for screen readers, the keyboard, zoom and phones. A part is the title page with the
// contents, one piece, or the sources (pages.js sectionBlocks), built as DOM nodes and text, never
// as HTML. The 3D book stays the reading place: opening the view scrolls it to the reader's place,
// to the word, turning pages keeps it in step, and closing it leaves the book open at the place at
// the top of the view. Its header is the book's toolbar: the parts before and after, contents,
// text size, theme, where the reader is, Back, and putting the book down.
//
// The view itself, its toolbar, keys, place and CSS, is AriaMoKr/common's TextView (text-view.js,
// the shell vrlbry's and music's views extend too); this module gives it the garden's book, its
// places pages.js's `at`, [section, block, word].
// renderPart, partOf and topBlock are pure (a document passed in), for the tests; TextView is the page's.
import { TextView as Shell } from 'common/text-view.js';
import { SECTION, folioLabel, progressOf, sectionBlocks, sectionCount } from './pages.js';

/** @typedef {import('./pages.js').At} At */
/** @typedef {import('./pages.js').BookText} BookText */
/** @typedef {import('common/text-view.js').ContentsEntry<At>} ContentsEntry */

/** The parts: the title page with the contents (part 0), each piece, the sources. @type {(book: BookText) => number} */
export const partCount = (book) => sectionCount(book) - 1;
/** The part a section of the book (pages.js SECTION) is in, and the sections of a part. @type {(section: number) => number} */
export const partOf = (section) => Math.max(0, section - 1);
/** @type {(part: number) => number[]} */
export const partSections = (part) => (part === 0 ? [SECTION.title, SECTION.contents] : [part + 1]);

/**
 * Part `part` of `book` as DOM nodes appended to `container`: a piece's title as an h2 (under the
 * view's own h1, the book's title, which the title page's heading would repeat), its author and
 * source, its paragraphs, its stanzas (lines as <br>s), the contents as a list of links, which
 * onLink(section) follows. Every block's element carries `data-s` and `data-b` (its place, as
 * pages.js numbers it), and the first of each the id `tv-<s>-<b>`.
 * @param {Document} doc
 * @param {Element} container
 * @param {BookText} book
 * @param {number} part
 * @param {{ onLink?: (section: number, e: Event) => void }} [o]
 */
export function renderPart(doc, container, book, part, o = {}) {
  /** @type {(tag: string, cls?: string | null, text?: string) => HTMLElement} */
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.setAttribute('class', cls);
    if (text) e.append(doc.createTextNode(text));
    return e;
  };
  const ids = new Set();
  /** @type {(e: HTMLElement, s: number, b: number) => HTMLElement} */
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
 * @param {{ s: number, b: number, top: number, bottom: number }[]} rects
 * @param {number} top
 * @returns {At} its place (pages.js `at`), from its first word
 */
export function topBlock(rects, top) {
  for (const r of rects) if (r.bottom > top + 1) return [r.s, r.b, 0];
  const last = rects[rects.length - 1];
  return last ? [last.s, last.b, 0] : [SECTION.title, -1, 0];
}

/**
 * The words of an element, as pages.js counts a block's words (`at`'s third part): each [text
 * node, where in it the word starts], in order.
 * @param {Node} el
 */
export function wordStarts(el) {
  /** @type {[Text, number][]} */
  const out = [];
  /** @param {Node} n */
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const node = /** @type {Text} */ (c); // nodeType 3: a text node
        const re = /\S+/g;
        for (let m = re.exec(node.data); m; m = re.exec(node.data)) out.push([node, m.index]);
      } else walk(c);
    }
  };
  walk(el);
  return out;
}

/**
 * The first of `count` words whose line is below `top`: lineBottom(i) is word i's line's foot (it only grows with i).
 * @param {number} count
 * @param {number} top
 * @param {(i: number) => number} lineBottom
 */
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

/**
 * The text view of the open book, on a screen: common's TextView, the book being book.js's.
 * main.js calls follow() after every page turn or jump of the 3D book (book.js onShow), close()
 * as it is put down, and toggle() for T and the overlay's "Text view".
 * @extends {Shell<At>}
 */
export class TextView extends Shell {
  /**
   * @param {object} o
   * @param {HTMLElement} o.root where the view goes (inside the page's <main>)
   * @param {import('./book.js').Book} o.reader the 3D book
   * @param {BookText} o.text its words (reading.js: { title, subtitle, pieces, colophon })
   * @param {() => void} o.putDown puts the book down (main.js closeBook)
   * @param {() => void} o.back Back along the links (main.js: through the browser's history)
   * @param {() => boolean} o.presenting whether in VR (nothing shows there)
   * @param {() => void} [o.onOpen] the view has opened
   * @param {() => void} [o.onClose] the view has closed, the 3D book still open
   * @param {() => HTMLElement|null} [o.returnFocus] where focus goes when the view closes
   */
  constructor({ root, reader, text, putDown, back, presenting, onOpen, onClose, returnFocus }) {
    // ↑ ↓ (a TV's, main.js) read on by most of what shows below the toolbar, a few lines staying in sight.
    super({ root, step: (h) => Math.max(40, h * 0.75), onOpen, onClose, returnFocus });
    /** The 3D book. */
    this.book = reader;
    /** Its words. */
    this.text = text;
    /** @private */
    this._putDown = putDown;
    /** @private */
    this._back = back;
    /** @private */
    this._presenting = presenting;
    /** What placeTop and placeAt measure a word with, made when first needed. @private @type {Range | null} */
    this._range = null;
    // Put back is putting the book down here ("Put down" on a narrow screen): the view's own markup.
    this.$('.tv-putback').innerHTML = 'Put<span class="tv-wide"> the book</span> down';
  }

  /** Where a word ([text node, offset], wordStarts) is drawn: its first letter's box. @private @param {[Text, number]} word */
  _rangeRect([node, offset]) {
    const r = (this._range ??= this.doc.createRange());
    r.setStart(node, offset);
    r.setEnd(node, Math.min(node.data.length, offset + 1));
    return r.getBoundingClientRect();
  }

  // ── What the shell asks of the book ────────────────────────────────────────

  bookOpen() {
    return this.book.isOpen;
  }

  presenting() {
    return this._presenting();
  }

  partCount() {
    return partCount(this.text);
  }

  /** @param {At} at */
  partOf(at) {
    return partOf(at[0]);
  }

  /** A part's start: its first section's heading. @param {number} part @returns {At} */
  partStart(part) {
    return [partSections(part)[0], -1, 0];
  }

  /**
   * The part's blocks, as text (renderPart), under the book's title.
   * @param {HTMLElement} body
   * @param {number} part
   * @param {{ onLink: (link: unknown) => void }} options
   */
  renderPart(body, part, { onLink }) {
    renderPart(this.doc, body, this.text, part, { onLink });
    return { title: this.text.title };
  }

  placeShown() {
    return this.book.place;
  }

  /** @param {At} at */
  showsPlace(at) {
    return this.book.showsPlace(at);
  }

  /**
   * Where a place is: the line with its word (a page of the 3D book may begin in the middle of a
   * paragraph), or its block; null for a part's heading, the view's top.
   * @param {At} at
   */
  placeTop(at) {
    if (at[1] < 0 && at[0] === partSections(this.part)[0]) return null;
    const target = this.$('.tv-body').querySelector(`[data-s="${at[0]}"][data-b="${at[1]}"]`);
    if (!target) return null;
    const word = at[2] > 0 ? wordStarts(target)[at[2]] : null;
    return (word ? this._rangeRect(word) : target.getBoundingClientRect()).top;
  }

  /**
   * The place at the view's top, top being the toolbar's foot: the block there, and the word on
   * its first line in sight.
   * @param {number} top
   */
  placeAt(top) {
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

  /**
   * @param {At} at
   * @param {{ inPlace: boolean }} options
   */
  jumpTo(at, { inPlace }) {
    return this.book.jumpToPlace(at, { inPlace });
  }

  /** @param {number} side */
  turnPage(side) {
    this.book.turn(side);
  }

  /** @param {number} f */
  jumpToProgress(f) {
    this.book.jumpToProgress(f);
  }

  /** @param {number} step */
  changeFont(step) {
    this.book.changeFont(step);
  }

  /** @param {string} name */
  setTheme(name) {
    this.book.setTheme(name);
  }

  goBack() {
    this._back();
  }

  putBack() {
    this._putDown();
  }

  /**
   * A link in the contents page (Back returns here): to the piece's start, as a part's button goes
   * there, since the spread it opens may begin with the end of the piece before (its left page),
   * which is the 3D book's place.
   * @param {number} section
   */
  followLink(section) {
    this.aim([section, -1, 0]);
    this.book.followLink(section);
    this.aim(null);
  }

  /** The pieces, each a link to its start with its author after it. @returns {ContentsEntry[]} */
  contents() {
    return this.text.pieces.map((piece, i) => ({
      title: piece.title, place: [SECTION.piece + i, -1, 0], after: ` · ${piece.author}`, href: `#tv-${SECTION.piece + i}--1`,
    }));
  }

  /** As the 3D contents goes there, without a trail, and closed. @param {ContentsEntry} entry */
  useContents(entry) {
    this.book.toggleContents(false);
    return super.useContents(entry);
  }

  label() {
    return folioLabel(this.book.pages, this.book.readingPages());
  }

  progress() {
    return progressOf(this.book.pages, this.book.readingIndex());
  }

  hasTrail() {
    return this.book.trail.length > 0;
  }

  theme() {
    return this.book.settings.theme;
  }

  fontScale() {
    return this.book.settings.fontScale;
  }

  reduced() {
    return this.book.reduceMotion;
  }
}
