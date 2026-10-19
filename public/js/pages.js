// The book set in pages: a title page, the contents, each piece from a new page (prose justified,
// a paragraph's first line indented; verse as a block in the middle of the page, a long line
// carried over under a hanging indent, a stanza kept on one page when it fits), running heads,
// page numbers, and a last page saying where the texts come from. Pure: widths come from
// `measure(text, type)`, so the tests run it in Node; book.js draws the pages it returns.

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
 * The pages, in reading order: each { items, head, folio, side }. An item is text ({ text, type,
 * x (from the text block's left), y (its baseline), align: 'left'|'center'|'right', justify (the
 * width to spread it to) }) or a rule ({ rule: true, x0, x1, y }). Page 0 is a right-hand page
 * (the title), so even pages are right-hand ('recto') and odd ones left-hand ('verso').
 * @param {{ title: string, subtitle: string, pieces: object[], colophon: string[] }} book
 * @param {(text: string, type: string) => number} measure
 */
export function paginate(book, measure) {
  const pages = [];
  const newPage = (head = null) => {
    const page = { items: [], head, folio: null, side: pages.length % 2 === 0 ? 'recto' : 'verso' };
    pages.push(page);
    return page;
  };
  const text = (page, s, type, x, y, align = 'left', justify = 0) => page.items.push({ text: s, type, x, y, align, justify });
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
    starts.push(pages.length - 1);
    let y = PAGE.top + 40;
    for (const line of wrap(piece.title, TEXT_WIDTH - 40, measure, 'title')) {
      y += TYPE.title.line;
      text(page, line, 'title', centre, y, 'center');
    }
    y += TYPE.author.line;
    text(page, piece.author.toUpperCase(), 'author', centre, y, 'center');
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
          text(page, line, 'body', x, y, 'left', last ? 0 : TEXT_WIDTH - x);
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
        for (const { part, carried } of set) {
          if (!fits(y, L)) turn();
          y += L;
          text(page, part, 'body', left + (carried ? HANG : 0), y);
        }
      });
    }
  }

  // The last page: where the texts are from.
  {
    const p = newPage();
    let y = PAGE.bottom - 60 - book.colophon.length * TYPE.small.line * 2;
    p.items.push({ rule: true, x0: centre - 50, x1: centre + 50, y: y - 40 });
    for (const line of book.colophon.flatMap((c) => wrap(c, TEXT_WIDTH - 120, measure, 'small'))) {
      y += TYPE.small.line;
      text(p, line, 'small', centre, y, 'center');
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
        text(contents, line, 'entry', 0, y);
      });
      text(contents, String(pages[starts[i]].folio), 'entry', TEXT_WIDTH, y, 'right');
      y += TYPE.entryBy.line - 6;
      text(contents, piece.author.toUpperCase(), 'entryBy', 0, y);
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
