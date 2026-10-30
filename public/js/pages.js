// The book set in pages: a title page, the contents, each piece from a new page (prose justified,
// a paragraph's first line indented; verse as a block in the middle of the page, a long line
// carried over under a hanging indent, a stanza kept on one page when it fits), running heads,
// page numbers, and a last page saying where the texts come from. At any of vrlbry's text sizes
// (FONT_STEPS): the contents and the sources run over onto more pages when they must, and every
// line knows its place in the book (`at`), so the reader stays at the same words at another size.
// Pure: widths come from `measure(text, font)`, so the tests run it in Node; book.js draws the
// pages it returns. And the words of the pages open, as a screen reader reads them (readingText):
// headings, paragraphs, stanzas and the contents, put back together from the lines they were set
// in; and each part of the book as blocks, for the text view (sectionBlocks).

/** A page's canvas, in pixels: its size, where the text block starts and ends, its margins. */
export const PAGE = { width: 1024, height: 1448, top: 170, bottom: 1296, inner: 122, outer: 100 };
export const TEXT_WIDTH = PAGE.width - PAGE.inner - PAGE.outer;

/** The kinds of text, by size (px) and leading; style is the CSS font style or weight. */
export const TYPE = {
  body: { size: 33, line: 49, style: '' },
  title: { size: 48, line: 62, style: '600' },
  author: { size: 24, line: 40, style: '', spacing: 3 },
  source: { size: 23, line: 34, style: 'italic' },
  bookTitle: { size: 86, line: 104, style: '600' },
  bookSub: { size: 33, line: 50, style: 'italic' },
  heading: { size: 40, line: 70, style: '600' },
  entry: { size: 30, line: 42, style: 'italic' },
  entryBy: { size: 22, line: 40, style: '', spacing: 2 },
  small: { size: 24, line: 38, style: 'italic' },
  head: { size: 22, line: 30, style: 'italic' },
  folio: { size: 23, line: 30, style: '' },
};

const INDENT = 44; // a paragraph's first line
const HANG = 52; // a verse line carried over
const SMALL_PRINT = 'Outside · a garden beyond the Hallway'; // at the foot of the title page

/** The text sizes one can choose, as in vrlbry: the type's sizes (and the spaces that go with them) times these. */
export const FONT_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8];

/**
 * The kinds of text at text size `scale` (FONT_STEPS): TYPE's sizes, leading and letter spacing
 * times it. A font, for `measure`, is one of these: { size, line, style, spacing? }.
 */
export function typeAt(scale = 1) {
  const out = {};
  for (const [k, t] of Object.entries(TYPE)) {
    out[k] = { ...t, size: t.size * scale, line: t.line * scale };
    if (t.spacing) out[k].spacing = t.spacing * scale;
  }
  return out;
}

/**
 * The book's parts, as `at` and `section` number them: the title page, the contents, each piece
 * (PIECE + its index), then the sources (PIECE + the number of pieces).
 */
export const SECTION = { title: 0, contents: 1, piece: 2 };

/** Words of text in lines no wider than width (the first narrower by `firstIndent`; wider, when it is negative). */
function wrap(text, width, measure, font, firstIndent = 0) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    const room = lines.length === 0 ? width - firstIndent : width;
    if (!line || measure(next, font) <= room) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** How many words a line set by wrap has. */
const wordCount = (line) => line.split(' ').length;

/**
 * The pages, in reading order: each { items, head, folio, side, kind, section, at, links }. An
 * item is text ({ text, type, x (from the text block's left), y (its baseline), align:
 * 'left'|'center'|'right', justify (the width to spread it to), at }) or a rule ({ rule: true, x0,
 * x1, y }). `at` is a line's place in the book, [section, block, word]: its part (SECTION), the
 * paragraph, stanza, contents entry or note it is in (-1 for a part's heading, title, author and
 * source), and how many words of that block come before it; a page's `at` is its first line's
 * (pageAt finds a place's page). A contents page's `links` are where its entries are (in the same
 * units as items), each { section, x0, y0, x1, y1 } leading to that piece (linkAt). For reading
 * the text back (readingText), a line that begins a paragraph, a stanza, a contents entry or a
 * colophon note has `start`, a verse line carried over from the one before has `carried`, a line
 * set in capitals has `spoken` (as written), and a piece's pages have its `kind`, 'prose' or
 * 'verse'. Page 0 is a right-hand page (the title), so even pages are right-hand ('recto') and odd
 * ones left-hand ('verso').
 * @param {{ title: string, subtitle: string, pieces: object[], colophon: string[] }} book
 * @param {(text: string, font: { size: number, style: string, spacing?: number }) => number} measure
 * @param {{ scale?: number }} [o] the text size (FONT_STEPS)
 */
export function paginate(book, measure, { scale = 1 } = {}) {
  const T = typeAt(scale);
  const sp = (v) => v * scale; // a space that goes with the type's size
  const pages = [];
  const newPage = (section, head = null) => {
    const page = { items: [], head, folio: null, side: pages.length % 2 === 0 ? 'recto' : 'verso', kind: null, section, at: null, links: [] };
    pages.push(page);
    return page;
  };
  const text = (page, s, type, x, y, at, align = 'left', justify = 0) => {
    const item = { text: s, type, x, y, align, justify, at };
    page.items.push(item);
    page.at ??= at;
    return item;
  };
  const centre = TEXT_WIDTH / 2;
  const sources = SECTION.piece + book.pieces.length;

  // The title page.
  {
    const p = newPage(SECTION.title);
    let y = 520;
    for (const line of wrap(book.title, TEXT_WIDTH, measure, T.bookTitle)) {
      text(p, line, 'bookTitle', centre, y, [SECTION.title, -1, 0], 'center');
      y += T.bookTitle.line;
    }
    y += sp(10);
    let w = 0;
    wrap(book.subtitle, TEXT_WIDTH, measure, T.bookSub).forEach((line, k) => {
      if (k > 0) y += T.bookSub.line;
      text(p, line, 'bookSub', centre, y, [SECTION.title, 0, w], 'center');
      w += wordCount(line);
    });
    p.items.push({ rule: true, x0: centre - sp(70), x1: centre + sp(70), y: y + sp(60) });
    const foot = wrap(SMALL_PRINT, TEXT_WIDTH, measure, T.small);
    w = 0;
    foot.forEach((line, k) => {
      text(p, line, 'small', centre, PAGE.bottom - sp(40) - (foot.length - 1 - k) * T.small.line, [SECTION.title, 1, w], 'center');
      w += wordCount(line);
    });
  }

  // The contents, on as many pages as it takes: its page numbers go in once the pieces are set.
  const numbers = []; // where each entry's goes: { page, index (among the page's items), y }
  {
    let page = newPage(SECTION.contents);
    let y = PAGE.top + sp(60);
    text(page, 'Contents', 'heading', centre, y, [SECTION.contents, -1, 0], 'center');
    y += sp(40);
    book.pieces.forEach((piece, i) => {
      const at = [SECTION.contents, i, 0];
      const to = SECTION.piece + i;
      const titleLines = wrap(piece.title, TEXT_WIDTH - sp(90), measure, T.entry);
      const height = T.entry.line + sp(8) + (titleLines.length - 1) * T.entry.line + T.entryBy.line - sp(6);
      if (y + height > PAGE.bottom) {
        page = newPage(SECTION.contents);
        y = PAGE.top;
      }
      y += T.entry.line + sp(8);
      const top = y - T.entry.size - sp(6);
      const first = y;
      titleLines.forEach((line, k) => {
        if (k > 0) y += T.entry.line;
        const item = text(page, line, 'entry', 0, y, at);
        if (k === 0) item.start = true;
        item.link = to;
      });
      numbers.push({ page, index: page.items.length, y: first });
      y += T.entryBy.line - sp(6);
      const by = text(page, piece.author.toUpperCase(), 'entryBy', 0, y, at);
      by.spoken = piece.author;
      by.link = to;
      page.links.push({ section: to, x0: 0, y0: top, x1: TEXT_WIDTH, y1: y + sp(10) });
    });
  }

  // The pieces.
  const starts = [];
  let folio = 0;
  const fits = (y, h) => y + h <= PAGE.bottom;
  book.pieces.forEach((piece, i) => {
    const s = SECTION.piece + i;
    let page = newPage(s, piece.title);
    page.folio = ++folio;
    page.kind = piece.kind;
    starts.push(pages.length - 1);
    let y = PAGE.top + sp(40);
    for (const line of wrap(piece.title, TEXT_WIDTH - sp(40), measure, T.title)) {
      y += T.title.line;
      text(page, line, 'title', centre, y, [s, -1, 0], 'center');
    }
    y += T.author.line;
    text(page, piece.author.toUpperCase(), 'author', centre, y, [s, -1, 0], 'center').spoken = piece.author;
    for (const line of wrap(piece.source, TEXT_WIDTH - sp(80), measure, T.source)) {
      y += T.source.line;
      text(page, line, 'source', centre, y, [s, -1, 0], 'center');
    }
    page.items.push({ rule: true, x0: centre - sp(50), x1: centre + sp(50), y: y + sp(30) });
    y += sp(60);
    const L = T.body.line;
    const turn = () => {
      page = newPage(s, piece.title);
      page.folio = ++folio;
      page.kind = piece.kind;
      y = PAGE.top;
    };
    if (piece.kind === 'prose') {
      const paragraphs = piece.text.split(/\n\s*\n/);
      paragraphs.forEach((para, b) => {
        const indent = b === 0 ? 0 : sp(INDENT);
        const lines = wrap(para, TEXT_WIDTH, measure, T.body, indent);
        let w = 0;
        lines.forEach((line, k) => {
          if (!fits(y, L)) turn();
          y += L;
          const last = k === lines.length - 1;
          const x = k === 0 ? indent : 0;
          const item = text(page, line, 'body', x, y, [s, b, w], 'left', last ? 0 : TEXT_WIDTH - x);
          if (k === 0) item.start = true;
          w += wordCount(line);
        });
      });
    } else {
      // Verse: the block as wide as its longest line, in the middle; each stanza on one page if it
      // fits. A line too long for the page is carried over under the hanging indent.
      const stanzas = piece.text.split(/\n\s*\n/).map((st) => st.split('\n'));
      const widest = Math.min(TEXT_WIDTH, Math.max(...stanzas.flat().map((l) => measure(l, T.body))));
      const left = (TEXT_WIDTH - widest) / 2;
      const hang = sp(HANG);
      stanzas.forEach((stanza, b) => {
        const set = stanza.flatMap((line) => wrap(line, TEXT_WIDTH - left - hang, measure, T.body, -hang).map((part, k) => ({ part, carried: k > 0 })));
        const height = (set.length + (b > 0 ? 1 : 0)) * L;
        // A new page has no blank line before the stanza: it goes there when it fits there.
        if (y + height > PAGE.bottom && set.length * L <= PAGE.bottom - PAGE.top) turn();
        else if (b > 0) y += L;
        let w = 0;
        set.forEach(({ part, carried }, k) => {
          if (!fits(y, L)) turn();
          y += L;
          const item = text(page, part, 'body', left + (carried ? hang : 0), y, [s, b, w]);
          if (k === 0) item.start = true;
          if (carried) item.carried = true;
          w += wordCount(part);
        });
      });
    }
  });

  // The last page: where the texts are from, at its foot (from its top, and over onto more pages,
  // when they don't fit there).
  {
    const notes = book.colophon.map((note) => wrap(note, TEXT_WIDTH - sp(120), measure, T.small));
    const count = notes.reduce((n, lines) => n + lines.length, 0);
    let p = newPage(sources);
    let y = Math.max(PAGE.top + sp(40), PAGE.bottom - sp(60) - count * T.small.line);
    p.items.push({ rule: true, x0: centre - sp(50), x1: centre + sp(50), y: y - sp(40) });
    notes.forEach((lines, b) => {
      let w = 0;
      lines.forEach((line, k) => {
        if (!fits(y, T.small.line)) {
          p = newPage(sources);
          y = PAGE.top;
        }
        y += T.small.line;
        const item = text(p, line, 'small', centre, y, [sources, b, w], 'center');
        if (k === 0) item.start = true;
        w += wordCount(line);
      });
    });
  }

  // Now the contents' page numbers, where each piece starts (last first, so the places noted on a
  // page stay where they were).
  for (let i = numbers.length - 1; i >= 0; i--) {
    const { page, index, y } = numbers[i];
    const item = { text: String(pages[starts[i]].folio), type: 'entry', x: TEXT_WIDTH, y, align: 'right', justify: 0, at: [SECTION.contents, i, 0], link: SECTION.piece + i };
    page.items.splice(index, 0, item);
  }
  return pages;
}

/** Whether place a ([section, block, word]) is before b (< 0), the same (0) or after it (> 0). */
export const comparePlaces = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The page a place is on: the last one starting at or before it. */
export function pageAt(pages, at) {
  let i = 0;
  while (i + 1 < pages.length && comparePlaces(pages[i + 1].at, at) <= 0) i++;
  return i;
}

/** The first page of part `section` (SECTION), or -1. */
export const sectionStart = (pages, section) => pages.findIndex((p) => p.section === section);

/** Which spread page i is on, and on which side of it (-1 left, 1 right): spreadPages' inverse. */
export const spreadOf = (i) => Math.floor((i + 1) / 2);
export const sideOf = (i) => (i % 2 === 1 ? -1 : 1);

/** How far into the book page i is, 0 to 1 (the toolbar's slider), and the page at a fraction. */
export const progressOf = (pages, i) => (pages.length > 1 ? i / (pages.length - 1) : 0);
export const pageAtProgress = (pages, v) => Math.round(Math.max(0, Math.min(1, v)) * (pages.length - 1));

/** How far from an entry a press still takes it, in page pixels (a laser in VR is not exact). */
const LINK_REACH = 12;

/** The contents entry at (x, y) on a page (from its text block's left, in page pixels): the part it leads to, or null. */
export function linkAt(page, x, y) {
  for (const l of page.links) {
    if (x >= l.x0 - LINK_REACH && x <= l.x1 + LINK_REACH && y >= l.y0 - LINK_REACH && y <= l.y1 + LINK_REACH) return l;
  }
  return null;
}

/** Where one is, on the toolbar (as vrlbry's): the right-hand page's number of the last, or which page it is. */
export function folioLabel(pages, indices) {
  const last = pages.findLast((p) => p.folio !== null)?.folio ?? 0;
  const i = indices.length ? indices[indices.length - 1] : 0;
  if (pages[i].folio !== null) return `${pages[i].folio} / ${last}`;
  return pages[i].section === SECTION.title ? 'Title page' : pages[i].section === SECTION.contents ? 'Contents' : 'Sources';
}

/** Which pages lie open at spread s: [left, right], either null for the inside of a cover. */
export function spreadPages(pages, s) {
  const left = 2 * s - 1, right = 2 * s;
  return [left >= 0 && left < pages.length ? left : null, right < pages.length ? right : null];
}

/** How many spreads the book has (the last may have only its left page). */
export function spreadCount(pages) {
  return Math.floor(pages.length / 2) + 1;
}

/** What page i is called, read out: 'page 4', or the title page, the contents, the sources (unnumbered). */
export function pageLabel(pages, i) {
  if (pages[i].folio !== null) return `page ${pages[i].folio}`;
  if (pages[i].section === SECTION.title) return 'the title page';
  if (pages[i].section === SECTION.contents) return 'the contents';
  return 'the sources';
}

/** The pages open, read out: 'Pages 4 and 5', 'The contents and page 1', 'Page 23', 'The contents' (two of its pages). */
export function spreadLabel(pages, indices) {
  const folios = indices.map((i) => pages[i].folio);
  let s;
  if (!indices.length) s = 'the inside of the cover';
  else if (folios.length === 2 && folios.every((f) => f !== null)) s = `pages ${folios[0]} and ${folios[1]}`;
  else s = [...new Set(indices.map((i) => pageLabel(pages, i)))].join(' and ');
  return s[0].toUpperCase() + s.slice(1);
}

/** The kinds of line that are headings, and their level: under the h2 that says which pages are open (overlay.js). */
const HEADINGS = { bookTitle: 3, heading: 3, title: 3 };

/**
 * A block of the open pages' words, as a screen reader reads them (pageBlocks, readingText), one
 * type per kind.
 * @typedef {{ kind: 'heading', level: number, text: string }} HeadingBlock
 * @typedef {{ kind: 'paragraph', text: string, continued: boolean }} ParagraphBlock
 * @typedef {{ kind: 'verse', lines: string[], continued: boolean, carried: boolean }} VerseBlock
 * @typedef {{ kind: 'list', items: string[], entries?: { title: string, page: string, by: string }[] }} ListBlock
 * @typedef {HeadingBlock | ParagraphBlock | VerseBlock | ListBlock} ReadingBlock
 */

/**
 * A page's words as blocks a screen reader reads: { kind: 'heading', level, text },
 * { kind: 'paragraph', text }, { kind: 'verse', lines } (a stanza) or { kind: 'list', items } (the
 * contents: "title, author, page n"). Lines set apart are joined again with a space; a paragraph or
 * stanza that began on an earlier page is `continued` (and a verse line carried onto this one,
 * `carried`). The running head and the page number are left out: the label says where one is.
 * @returns {ReadingBlock[]}
 */
export function pageBlocks(page) {
  /** @type {ReadingBlock[]} */
  const blocks = [];
  /** The block the next line of the same type may join, and that type. @type {{ block: HeadingBlock | ParagraphBlock | VerseBlock, type: string } | null} */
  let open = null;
  for (const it of page.items) {
    if (it.rule) {
      open = null;
      continue;
    }
    const words = it.spoken ?? it.text;
    const joins = open && open.type === it.type && !it.start;
    if (it.type === 'entry' || it.type === 'entryBy') {
      // The contents: an entry's title (on a line or two), its page number, its author.
      let list = blocks.at(-1);
      if (list?.kind !== 'list') blocks.push(list = { kind: 'list', items: [], entries: [] });
      if (it.start || !list.entries.length) list.entries.push({ title: '', page: '', by: '' });
      const e = list.entries.at(-1);
      if (it.type === 'entryBy') e.by = words;
      else if (it.align === 'right') e.page = words;
      else e.title = e.title ? `${e.title} ${words}` : words;
      open = null;
    } else if (it.type === 'body' && page.kind === 'verse') {
      if (open?.type === 'body' && !it.start) {
        const lines = /** @type {VerseBlock} */ (open.block).lines; // on a verse page, the body's blocks are stanzas
        if (it.carried) lines[lines.length - 1] += ` ${words}`;
        else lines.push(words);
      } else {
        /** @type {VerseBlock} */
        const block = { kind: 'verse', lines: [words], continued: !it.start, carried: !!it.carried };
        blocks.push(block);
        open = { block, type: 'body' };
      }
    } else if (joins) {
      /** @type {HeadingBlock | ParagraphBlock} */ (open.block).text += ` ${words}`; // a stanza's lines join it above, so this is a heading or a paragraph
    } else {
      const level = HEADINGS[it.type];
      /** @type {HeadingBlock | ParagraphBlock} */
      const block = level ? { kind: 'heading', level, text: words } : { kind: 'paragraph', text: words, continued: it.type === 'body' && !it.start };
      blocks.push(block);
      open = { block, type: it.type };
    }
  }
  for (const b of blocks) {
    if (b.kind !== 'list') continue;
    b.items = b.entries.map((e) => `${e.title}, ${e.by}, page ${e.page}`);
    delete b.entries;
  }
  return blocks;
}

/**
 * The words of the pages open (indices, in reading order), for a screen reader: { label, blocks },
 * the label as spreadLabel says it, and a paragraph or stanza that runs from one page onto the next
 * read as one.
 * @returns {{ label: string, blocks: ReadingBlock[] }}
 */
export function readingText(pages, indices) {
  /** @type {ReadingBlock[]} */
  const blocks = [];
  for (const i of indices) {
    for (const b of pageBlocks(pages[i])) {
      const prev = blocks.at(-1);
      if (b.kind === 'paragraph' && b.continued && prev?.kind === 'paragraph') prev.text += ` ${b.text}`;
      else if (b.kind === 'verse' && b.continued && prev?.kind === 'verse') {
        const [first, ...rest] = b.lines;
        if (b.carried) prev.lines[prev.lines.length - 1] += ` ${first}`;
        else prev.lines.push(first);
        prev.lines.push(...rest);
      } else blocks.push(b);
    }
  }
  return { label: spreadLabel(pages, indices), blocks };
}

/** How many parts the book has (SECTION): the title page, the contents, the pieces, the sources. */
export const sectionCount = (book) => SECTION.piece + book.pieces.length + 1;

/**
 * Part `section` of the book (SECTION) as blocks, numbered as paginate's `at` numbers them, for
 * the text view: { b, kind: 'heading', text } (b -1: the part's own, a piece's title), { b: -1,
 * kind: 'byline', author, source } (a piece's), { b, kind: 'paragraph', text }, { b, kind:
 * 'verse', lines } (a stanza), { b, kind: 'entry', title, author, to } (the contents: the part it
 * leads to). The sources have a heading the page doesn't ('Sources'); the title page's small
 * print is left out.
 */
export function sectionBlocks(book, section) {
  const sources = SECTION.piece + book.pieces.length;
  const words = (s) => s.split(/\s+/).filter(Boolean).join(' ');
  if (section === SECTION.title) return [{ b: -1, kind: 'heading', text: book.title }, { b: 0, kind: 'paragraph', text: book.subtitle }];
  if (section === SECTION.contents) {
    return [{ b: -1, kind: 'heading', text: 'Contents' }, ...book.pieces.map((p, i) => ({ b: i, kind: 'entry', title: p.title, author: p.author, to: SECTION.piece + i }))];
  }
  if (section === sources) return [{ b: -1, kind: 'heading', text: 'Sources' }, ...book.colophon.map((note, b) => ({ b, kind: 'paragraph', text: words(note) }))];
  const piece = book.pieces[section - SECTION.piece];
  if (!piece) return [];
  const parts = piece.text.split(/\n\s*\n/);
  return [
    { b: -1, kind: 'heading', text: piece.title },
    { b: -1, kind: 'byline', author: piece.author, source: words(piece.source) },
    ...parts.map((part, b) => (piece.kind === 'prose' ? { b, kind: 'paragraph', text: words(part) } : { b, kind: 'verse', lines: part.split('\n').map(words) })),
  ];
}
