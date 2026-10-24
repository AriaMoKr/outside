// The book set in pages: a title page, the contents, each piece from a new page (prose justified,
// a paragraph's first line indented; verse as a block in the middle of the page, a long line
// carried over under a hanging indent, a stanza kept on one page when it fits), running heads,
// page numbers, and a last page saying where the texts come from. Pure: widths come from
// `measure(text, type)`, so the tests run it in Node; book.js draws the pages it returns. And the
// words of the pages open, as a screen reader reads them (readingText): headings, paragraphs,
// stanzas and the contents, put back together from the lines they were set in.

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

/** Words of text in lines no wider than width (the first `first` narrower by `firstIndent`). */
function wrap(text, width, measure, type, firstIndent = 0) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    const room = lines.length === 0 ? width - firstIndent : width;
    if (!line || measure(next, type) <= room) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The pages, in reading order: each { items, head, folio, side, kind }. An item is text ({ text,
 * type, x (from the text block's left), y (its baseline), align: 'left'|'center'|'right', justify
 * (the width to spread it to) }) or a rule ({ rule: true, x0, x1, y }). For reading the text back
 * (readingText), a line that begins a paragraph, a stanza, a contents entry or a colophon note has
 * `start`, a verse line carried over from the one before has `carried`, a line set in capitals
 * has `spoken` (as written), and a piece's pages have its `kind`, 'prose' or 'verse'. Page 0 is a
 * right-hand page (the title), so even pages are right-hand ('recto') and odd ones left-hand
 * ('verso').
 * @param {{ title: string, subtitle: string, pieces: object[], colophon: string[] }} book
 * @param {(text: string, type: string) => number} measure
 */
export function paginate(book, measure) {
  const pages = [];
  const newPage = (head = null) => {
    const page = { items: [], head, folio: null, side: pages.length % 2 === 0 ? 'recto' : 'verso', kind: null };
    pages.push(page);
    return page;
  };
  const text = (page, s, type, x, y, align = 'left', justify = 0) => {
    const item = { text: s, type, x, y, align, justify };
    page.items.push(item);
    return item;
  };
  const centre = TEXT_WIDTH / 2;

  // The title page.
  {
    const p = newPage();
    let y = 520;
    for (const line of wrap(book.title, TEXT_WIDTH, measure, 'bookTitle')) {
      text(p, line, 'bookTitle', centre, y, 'center');
      y += TYPE.bookTitle.line;
    }
    text(p, book.subtitle, 'bookSub', centre, y + 10, 'center');
    p.items.push({ rule: true, x0: centre - 70, x1: centre + 70, y: y + 70 });
    text(p, 'Outside · a garden beyond the Hallway', 'small', centre, PAGE.bottom - 40, 'center');
  }
  // The contents: filled in once the pieces are set.
  const contents = newPage();

  // The pieces.
  const starts = [];
  let folio = 0;
  const fits = (y, h) => y + h <= PAGE.bottom;
  for (const piece of book.pieces) {
    let page = newPage(piece.title);
    page.folio = ++folio;
    page.kind = piece.kind;
    starts.push(pages.length - 1);
    let y = PAGE.top + 40;
    for (const line of wrap(piece.title, TEXT_WIDTH - 40, measure, 'title')) {
      y += TYPE.title.line;
      text(page, line, 'title', centre, y, 'center');
    }
    y += TYPE.author.line;
    text(page, piece.author.toUpperCase(), 'author', centre, y, 'center').spoken = piece.author;
    for (const line of wrap(piece.source, TEXT_WIDTH - 80, measure, 'source')) {
      y += TYPE.source.line;
      text(page, line, 'source', centre, y, 'center');
    }
    page.items.push({ rule: true, x0: centre - 50, x1: centre + 50, y: y + 30 });
    y += 60;
    const L = TYPE.body.line;
    const turn = () => {
      page = newPage(piece.title);
      page.folio = ++folio;
      page.kind = piece.kind;
      y = PAGE.top;
    };
    if (piece.kind === 'prose') {
      const paragraphs = piece.text.split(/\n\s*\n/);
      paragraphs.forEach((para, n) => {
        const indent = n === 0 ? 0 : INDENT;
        const lines = wrap(para, TEXT_WIDTH, measure, 'body', indent);
        lines.forEach((line, i) => {
          if (!fits(y, L)) turn();
          y += L;
          const last = i === lines.length - 1;
          const x = i === 0 ? indent : 0;
          const item = text(page, line, 'body', x, y, 'left', last ? 0 : TEXT_WIDTH - x);
          if (i === 0) item.start = true;
        });
      });
    } else {
      // Verse: the block as wide as its longest line, in the middle; each stanza on one page if it fits.
      const stanzas = piece.text.split(/\n\s*\n/).map((s) => s.split('\n'));
      const widest = Math.min(TEXT_WIDTH, Math.max(...stanzas.flat().map((l) => measure(l, 'body'))));
      const left = (TEXT_WIDTH - widest) / 2;
      stanzas.forEach((stanza, n) => {
        const set = stanza.flatMap((line) => wrap(line, TEXT_WIDTH - left, measure, 'body', 0).map((part, i) => ({ part, carried: i > 0 })));
        const height = (set.length + (n > 0 ? 1 : 0)) * L;
        const capacity = PAGE.bottom - PAGE.top;
        if (y + height > PAGE.bottom && height <= capacity) turn();
        else if (n > 0) y += L;
        set.forEach(({ part, carried }, k) => {
          if (!fits(y, L)) turn();
          y += L;
          const item = text(page, part, 'body', left + (carried ? HANG : 0), y);
          if (k === 0) item.start = true;
          if (carried) item.carried = true;
        });
      });
    }
  }

  // The last page: where the texts are from.
  {
    const p = newPage();
    let y = PAGE.bottom - 60 - book.colophon.length * TYPE.small.line * 2;
    p.items.push({ rule: true, x0: centre - 50, x1: centre + 50, y: y - 40 });
    for (const note of book.colophon) {
      wrap(note, TEXT_WIDTH - 120, measure, 'small').forEach((line, k) => {
        y += TYPE.small.line;
        const item = text(p, line, 'small', centre, y, 'center');
        if (k === 0) item.start = true;
      });
    }
  }

  // Now the contents, with where each piece starts.
  {
    let y = PAGE.top + 60;
    text(contents, 'Contents', 'heading', centre, y, 'center');
    y += 40;
    book.pieces.forEach((piece, i) => {
      y += TYPE.entry.line + 8;
      const titleLines = wrap(piece.title, TEXT_WIDTH - 90, measure, 'entry');
      titleLines.forEach((line, k) => {
        if (k > 0) y += TYPE.entry.line;
        const item = text(contents, line, 'entry', 0, y);
        if (k === 0) item.start = true;
      });
      text(contents, String(pages[starts[i]].folio), 'entry', TEXT_WIDTH, y, 'right');
      y += TYPE.entryBy.line - 6;
      text(contents, piece.author.toUpperCase(), 'entryBy', 0, y).spoken = piece.author;
    });
  }
  return pages;
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
  if (i === 0) return 'the title page';
  if (i === 1) return 'the contents';
  return 'the sources';
}

/** The pages open, read out: 'Pages 4 and 5', 'The contents and page 1', 'Page 23'. */
export function spreadLabel(pages, indices) {
  const folios = indices.map((i) => pages[i].folio);
  let s;
  if (!indices.length) s = 'the inside of the cover';
  else if (folios.length === 2 && folios.every((f) => f !== null)) s = `pages ${folios[0]} and ${folios[1]}`;
  else s = indices.map((i) => pageLabel(pages, i)).join(' and ');
  return s[0].toUpperCase() + s.slice(1);
}

/** The kinds of line that are headings, and their level: under the h2 that says which pages are open (overlay.js). */
const HEADINGS = { bookTitle: 3, heading: 3, title: 3 };

/**
 * A page's words as blocks a screen reader reads: { kind: 'heading', level, text },
 * { kind: 'paragraph', text }, { kind: 'verse', lines } (a stanza) or { kind: 'list', items } (the
 * contents: "title, author, page n"). Lines set apart are joined again with a space; a paragraph or
 * stanza that began on an earlier page is `continued` (and a verse line carried onto this one,
 * `carried`). The running head and the page number are left out: the label says where one is.
 */
export function pageBlocks(page) {
  const blocks = [];
  let open = null; // the block the next line of the same type may join: { block, type }
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
        const lines = open.block.lines;
        if (it.carried) lines[lines.length - 1] += ` ${words}`;
        else lines.push(words);
      } else {
        const block = { kind: 'verse', lines: [words], continued: !it.start, carried: !!it.carried };
        blocks.push(block);
        open = { block, type: 'body' };
      }
    } else if (joins) {
      open.block.text += ` ${words}`;
    } else {
      const level = HEADINGS[it.type];
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
 */
export function readingText(pages, indices) {
  const blocks = [];
  for (const i of indices) {
    for (const b of pageBlocks(pages[i])) {
      const prev = blocks.at(-1);
      if (b.continued && prev?.kind === b.kind) {
        if (b.kind === 'paragraph') prev.text += ` ${b.text}`;
        else {
          const [first, ...rest] = b.lines;
          if (b.carried) prev.lines[prev.lines.length - 1] += ` ${first}`;
          else prev.lines.push(first);
          prev.lines.push(...rest);
        }
      } else blocks.push(b);
    }
  }
  return { label: spreadLabel(pages, indices), blocks };
}
