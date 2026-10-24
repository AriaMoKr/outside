// The book set in pages: nothing lost or out of order, nothing over the margins, stanzas kept
// whole, each piece from a new page and the contents pointing at it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE, TEXT_WIDTH, TYPE, paginate, readingText, spreadCount, spreadLabel, spreadPages } from '../public/js/pages.js';
import { BOOK_SUBTITLE, BOOK_TITLE, COLOPHON, PIECES } from '../public/js/reading.js';

// A stand-in for the canvas's measureText: every character half its type's size wide.
const measure = (text, type) => text.length * TYPE[type].size * 0.5 + (TYPE[type].spacing ?? 0) * text.length;
const book = { title: BOOK_TITLE, subtitle: BOOK_SUBTITLE, pieces: PIECES, colophon: COLOPHON };
const pages = paginate(book, measure);
const words = (s) => s.split(/\s+/).filter(Boolean);

/** The pages a piece is on: from its first to before the next one's (or the colophon). */
function pagesOf(i) {
  const start = pages.findIndex((p) => p.items.some((it) => it.type === 'title' && PIECES[i].title.startsWith(it.text)));
  let end = pages.findIndex((p, k) => k > start && p.head !== PIECES[i].title);
  if (end < 0) end = pages.length;
  return { start, end };
}

test('every word of every piece is there, in order', () => {
  PIECES.forEach((piece, i) => {
    const { start, end } = pagesOf(i);
    assert.ok(start > 1, `${piece.title} not found`);
    const set = pages.slice(start, end).flatMap((p) => p.items.filter((it) => it.type === 'body').flatMap((it) => words(it.text)));
    assert.deepEqual(set, words(piece.text), piece.title);
  });
});

test('nothing runs past the page\'s margins', () => {
  for (const [n, p] of pages.entries()) {
    for (const it of p.items) {
      if (it.rule) continue;
      const w = measure(it.text, it.type);
      const left = it.align === 'center' ? it.x - w / 2 : it.align === 'right' ? it.x - w : it.x;
      assert.ok(left >= -0.5 && left + w <= TEXT_WIDTH + 0.5, `page ${n}: "${it.text}" is ${w} wide at ${left}`);
      if (it.justify) assert.ok(it.x + it.justify <= TEXT_WIDTH + 0.5 && w <= it.justify + 0.5, `page ${n}: "${it.text}" justified past the margin`);
      assert.ok(it.y <= PAGE.bottom && it.y >= PAGE.top - 40, `page ${n}: "${it.text}" at y = ${it.y}`);
    }
  }
});

test('a stanza is not split across pages when it fits on one', () => {
  for (const [i, piece] of PIECES.entries()) {
    if (piece.kind !== 'verse') continue;
    const { start, end } = pagesOf(i);
    // Each page's verse as one run of words (a long line may be carried over onto two).
    const set = pages.slice(start, end).map((p) => words(p.items.filter((it) => it.type === 'body').map((it) => it.text).join(' ')).join(' '));
    for (const stanza of piece.text.split(/\n\s*\n/)) {
      assert.ok(set.some((page) => page.includes(words(stanza).join(' '))), `${piece.title}: the stanza beginning "${stanza.split('\n')[0]}" goes over a page`);
    }
  }
});

test('the title page, the contents with the right page numbers, the colophon', () => {
  assert.ok(pages[0].items.some((it) => it.type === 'bookTitle' && it.text === BOOK_TITLE));
  assert.equal(pages[0].side, 'recto');
  const contents = pages[1];
  assert.ok(contents.items.some((it) => it.text === 'Contents'));
  PIECES.forEach((piece, i) => {
    const { start } = pagesOf(i);
    const entry = contents.items.findIndex((it) => it.type === 'entry' && piece.title.startsWith(it.text));
    const number = contents.items.slice(entry).find((it) => it.align === 'right');
    assert.equal(Number(number.text), pages[start].folio, `${piece.title}: listed at ${number.text}, starts at ${pages[start].folio}`);
  });
  assert.ok(pages.at(-1).items.some((it) => it.text?.includes('public domain')));
});

test('running heads and page numbers on the pieces\' pages, none on the title or contents', () => {
  assert.equal(pages[0].folio, null);
  assert.equal(pages[1].folio, null);
  let last = 0;
  for (const p of pages.slice(2, -1)) {
    assert.ok(p.head, 'a running head');
    assert.equal(p.folio, last + 1, 'numbered in order');
    last = p.folio;
  }
});

test('read out, each piece is its title, author and source, then its paragraphs or stanzas whole', () => {
  const norm = (s) => words(s).join(' ');
  PIECES.forEach((piece, i) => {
    const { start, end } = pagesOf(i);
    const indices = Array.from({ length: end - start }, (_, k) => start + k);
    const [heading, author, source, ...rest] = readingText(pages, indices).blocks;
    assert.deepEqual(heading, { kind: 'heading', level: 3, text: piece.title });
    assert.equal(author.text, piece.author, 'as written, not in capitals');
    assert.equal(norm(source.text), norm(piece.source));
    const parts = piece.text.split(/\n\s*\n/);
    if (piece.kind === 'prose') assert.deepEqual(rest.map((b) => b.text), parts.map(norm), piece.title);
    else assert.deepEqual(rest.map((b) => b.lines.map(norm)), parts.map((s) => s.split('\n').map(norm)), piece.title);
  });
});

test('read out, the title page, the contents and the sources, and where one is', () => {
  const title = readingText(pages, [0]);
  assert.equal(title.label, 'The title page');
  assert.deepEqual(title.blocks.slice(0, 2), [{ kind: 'heading', level: 3, text: BOOK_TITLE }, { kind: 'paragraph', text: BOOK_SUBTITLE, continued: false }]);
  // The book's headings sit under the h2 that says where one is (overlay.js): never above it.
  for (let i = 0; i < pages.length; i++) for (const b of readingText(pages, [i]).blocks) if (b.kind === 'heading') assert.equal(b.level, 3);
  const contents = readingText(pages, [1]).blocks;
  assert.deepEqual(contents[0], { kind: 'heading', level: 3, text: 'Contents' });
  assert.deepEqual(contents[1].items, PIECES.map((p, i) => `${p.title}, ${p.author}, page ${pages[pagesOf(i).start].folio}`));
  const sources = readingText(pages, [pages.length - 1]);
  assert.equal(sources.label, 'The sources');
  assert.deepEqual(sources.blocks.map((b) => b.text), COLOPHON.map((c) => words(c).join(' ')));
  assert.equal(spreadLabel(pages, [1, 2]), 'The contents and page 1');
  assert.equal(spreadLabel(pages, [3, 4]), `Pages ${pages[3].folio} and ${pages[4].folio}`);
  assert.equal(spreadLabel(pages, [4]), `Page ${pages[4].folio}`);
  assert.equal(spreadLabel(pages, []), 'The inside of the cover');
  // A spread's two pages read on from one into the other: no paragraph cut where the page ends.
  for (let s = 1; s < spreadCount(pages); s++) {
    const [l, r] = spreadPages(pages, s);
    if (l === null || r === null || !pages[r].kind) continue;
    const both = readingText(pages, [l, r]).blocks.length;
    const apart = readingText(pages, [l]).blocks.length + readingText(pages, [r]).blocks.length;
    const runsOn = pages[r].items.find((it) => it.type === 'body') && !pages[r].items.find((it) => it.type === 'body').start && pages[l].kind === pages[r].kind;
    assert.equal(both, apart - (runsOn ? 1 : 0), `spread ${s}`);
  }
});

test('spreads: the title alone on the right of the first, then two pages each', () => {
  assert.deepEqual(spreadPages(pages, 0), [null, 0]);
  assert.deepEqual(spreadPages(pages, 1), [1, 2]);
  const n = spreadCount(pages);
  const shown = new Set();
  for (let s = 0; s < n; s++) for (const i of spreadPages(pages, s)) if (i !== null) shown.add(i);
  assert.equal(shown.size, pages.length, 'every page on some spread');
  assert.deepEqual(spreadPages(pages, n), [null, null].map((_, k) => (2 * n - 1 + k < pages.length ? 2 * n - 1 + k : null)));
});
