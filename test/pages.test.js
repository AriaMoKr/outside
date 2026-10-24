// The book set in pages, at every text size: nothing lost or out of order, nothing over the
// margins, stanzas kept whole, each piece from a new page and the contents pointing at it; each
// line's place in the book, and the same words found again at another size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONT_STEPS, PAGE, SECTION, TEXT_WIDTH, comparePlaces, folioLabel, linkAt, pageAt, pageAtProgress, paginate, progressOf,
  readingText, sectionBlocks, sectionCount, sectionStart, sideOf, spreadCount, spreadLabel, spreadOf, spreadPages, typeAt,
} from '../public/js/pages.js';
import { BOOK_SUBTITLE, BOOK_TITLE, COLOPHON, PIECES } from '../public/js/reading.js';

// A stand-in for the canvas's measureText: every character half its font's size wide.
const measure = (text, font) => text.length * font.size * 0.5 + (font.spacing ?? 0) * text.length;
const book = { title: BOOK_TITLE, subtitle: BOOK_SUBTITLE, pieces: PIECES, colophon: COLOPHON };
const sized = new Map(FONT_STEPS.map((s) => [s, paginate(book, measure, { scale: s })]));
const pages = sized.get(1);
const words = (s) => s.split(/\s+/).filter(Boolean);
const SOURCES = SECTION.piece + PIECES.length;

/** The pages a piece is on: from its first to before the next one's (or the colophon). */
function pagesOf(i, ps = pages) {
  const start = sectionStart(ps, SECTION.piece + i);
  let end = ps.findIndex((p, k) => k > start && p.section !== SECTION.piece + i);
  if (end < 0) end = ps.length;
  return { start, end };
}

test('every word of every piece is there, in order, at every size', () => {
  for (const [scale, ps] of sized) {
    PIECES.forEach((piece, i) => {
      const { start, end } = pagesOf(i, ps);
      assert.ok(start > 1, `${piece.title} not found`);
      const set = ps.slice(start, end).flatMap((p) => p.items.filter((it) => it.type === 'body').flatMap((it) => words(it.text)));
      assert.deepEqual(set, words(piece.text), `${piece.title} at ${scale}`);
    });
  }
});

test('nothing runs past the page\'s margins, at every size', () => {
  for (const [scale, ps] of sized) {
    const T = typeAt(scale);
    for (const [n, p] of ps.entries()) {
      for (const it of p.items) {
        if (it.rule) continue;
        const w = measure(it.text, T[it.type]);
        const left = it.align === 'center' ? it.x - w / 2 : it.align === 'right' ? it.x - w : it.x;
        const where = `at ${scale}, page ${n}: "${it.text}"`;
        assert.ok(left >= -0.5 && left + w <= TEXT_WIDTH + 0.5, `${where} is ${w} wide at ${left}`);
        if (it.justify) assert.ok(it.x + it.justify <= TEXT_WIDTH + 0.5 && w <= it.justify + 0.5, `${where} justified past the margin`);
        assert.ok(it.y <= PAGE.bottom && it.y >= PAGE.top - 40, `${where} at y = ${it.y}`);
      }
    }
  }
});

test('a stanza is not split across pages when it fits on one', () => {
  for (const [scale, ps] of sized) {
    for (const [i, piece] of PIECES.entries()) {
      if (piece.kind !== 'verse') continue;
      const { start, end } = pagesOf(i, ps);
      const capacity = Math.floor((PAGE.bottom - PAGE.top) / typeAt(scale).body.line);
      // Each page's verse as one run of words (a long line may be carried over onto two).
      const set = ps.slice(start, end).map((p) => words(p.items.filter((it) => it.type === 'body').map((it) => it.text).join(' ')).join(' '));
      for (const stanza of piece.text.split(/\n\s*\n/)) {
        const lines = ps.slice(start, end).flatMap((p) => p.items).filter((it) => it.type === 'body' && it.at[1] === piece.text.split(/\n\s*\n/).indexOf(stanza)).length;
        if (lines > capacity) continue; // too long for any page
        assert.ok(set.some((page) => page.includes(words(stanza).join(' '))), `${piece.title} at ${scale}: the stanza beginning "${stanza.split('\n')[0]}" goes over a page`);
      }
    }
  }
});

test('the title page, the contents with the right page numbers, the colophon, at every size', () => {
  for (const [scale, ps] of sized) {
    assert.ok(ps[0].items.some((it) => it.type === 'bookTitle' && BOOK_TITLE.startsWith(it.text)));
    assert.equal(ps[0].side, 'recto');
    assert.equal(ps[1].section, SECTION.contents);
    assert.ok(ps[1].items.some((it) => it.text === 'Contents'));
    const contents = ps.filter((p) => p.section === SECTION.contents).flatMap((p) => p.items);
    PIECES.forEach((piece, i) => {
      const { start } = pagesOf(i, ps);
      const number = contents.find((it) => it.at[1] === i && it.align === 'right');
      assert.equal(Number(number.text), ps[start].folio, `${piece.title} at ${scale}: listed at ${number.text}, starts at ${ps[start].folio}`);
    });
    assert.ok(ps.filter((p) => p.section === SOURCES).flatMap((p) => p.items).some((it) => it.text?.includes('public')));
    assert.equal(ps.at(-1).section, SOURCES);
  }
  // At the largest size the contents takes two pages.
  assert.ok(sized.get(1.8).filter((p) => p.section === SECTION.contents).length > 1);
  assert.equal(pages.filter((p) => p.section === SECTION.contents).length, 1);
});

test('running heads and page numbers on the pieces\' pages, none on the title, contents or sources', () => {
  for (const ps of sized.values()) {
    let last = 0;
    for (const p of ps) {
      const piece = p.section >= SECTION.piece && p.section < SOURCES;
      assert.equal(!!p.head, piece);
      if (!piece) assert.equal(p.folio, null);
      else {
        assert.equal(p.folio, last + 1, 'numbered in order');
        last = p.folio;
      }
    }
  }
});

test('every line has its place, in reading order, and a page starts at its first line\'s', () => {
  for (const [scale, ps] of sized) {
    let prev = [-1, -2, 0];
    for (const [n, p] of ps.entries()) {
      const lines = p.items.filter((it) => !it.rule);
      assert.deepEqual(p.at, lines[0].at, `page ${n} at ${scale}`);
      assert.equal(p.section, p.at[0]);
      for (const it of lines) {
        if (it.align === 'right' && it.type === 'entry') continue; // a page number, beside its entry's title
        assert.ok(comparePlaces(prev, it.at) <= 0, `at ${scale}, page ${n}: "${it.text}" before ${prev}`);
        prev = it.at;
      }
      assert.equal(pageAt(ps, p.at), n);
    }
  }
});

test('at another size, the page with the same words', () => {
  // The page a piece's paragraph or stanza, at any word, is on: the same words at any size.
  const where = (ps, at) => {
    const p = ps[pageAt(ps, at)];
    return p.items.filter((it) => !it.rule && comparePlaces(it.at, at) <= 0).at(-1);
  };
  for (const [scale, ps] of sized) {
    for (const p of pages) {
      const it = where(ps, p.at);
      assert.equal(it.at[0], p.at[0]);
      assert.equal(it.at[1], p.at[1], `at ${scale}: ${p.at} in the same block`);
      assert.ok(it.at[2] <= p.at[2], 'from a line at or before it');
    }
  }
});

test('the contents\' entries lead to their pieces', () => {
  for (const ps of sized.values()) {
    const contents = ps.filter((p) => p.section === SECTION.contents);
    const links = contents.flatMap((p) => p.links);
    assert.deepEqual(links.map((l) => l.section), PIECES.map((_, i) => SECTION.piece + i));
    for (const p of contents) {
      for (const l of p.links) {
        const title = p.items.find((it) => it.link === l.section && it.start);
        assert.equal(linkAt(p, TEXT_WIDTH / 2, title.y - 5)?.section, l.section, 'pressed on its title');
        assert.ok(l.y0 < title.y && l.y1 > title.y && l.y1 <= PAGE.bottom + 20);
      }
      // Entries do not overlap: a press is on one at most.
      for (let k = 1; k < p.links.length; k++) assert.ok(p.links[k].y0 >= p.links[k - 1].y1 - 1);
    }
    assert.equal(linkAt(ps[0], TEXT_WIDTH / 2, 600), null, 'no links on the title page');
  }
});

test('spreads, sides, progress and the toolbar\'s label', () => {
  for (let i = 0; i < pages.length; i++) {
    const [l, r] = spreadPages(pages, spreadOf(i));
    assert.equal(sideOf(i) < 0 ? l : r, i);
    assert.equal(pageAtProgress(pages, progressOf(pages, i)), i);
  }
  const last = pages.findLast((p) => p.folio).folio;
  assert.equal(folioLabel(pages, [0]), 'Title page');
  assert.equal(folioLabel(pages, [1, 2]), `1 / ${last}`);
  assert.equal(folioLabel(pages, [3, 4]), `${pages[4].folio} / ${last}`);
  assert.equal(folioLabel(pages, [pages.length - 1]), 'Sources');
});

test('read out, each piece is its title, author and source, then its paragraphs or stanzas whole', () => {
  const norm = (s) => words(s).join(' ');
  for (const ps of [pages, sized.get(1.8)]) {
    PIECES.forEach((piece, i) => {
      const { start, end } = pagesOf(i, ps);
      const indices = Array.from({ length: end - start }, (_, k) => start + k);
      const [heading, author, ...rest] = readingText(ps, indices).blocks;
      assert.deepEqual(heading, { kind: 'heading', level: 3, text: piece.title });
      assert.equal(author.text, piece.author, 'as written, not in capitals');
      const source = rest.shift();
      assert.equal(norm(source.text), norm(piece.source));
      const parts = piece.text.split(/\n\s*\n/);
      if (piece.kind === 'prose') assert.deepEqual(rest.map((b) => b.text), parts.map(norm), piece.title);
      else assert.deepEqual(rest.map((b) => b.lines.map(norm)), parts.map((s) => s.split('\n').map(norm)), piece.title);
    });
  }
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
  // At the largest size, over two pages: still each entry with its own page number.
  const big = sized.get(1.8);
  const both = big.map((p, i) => (p.section === SECTION.contents ? i : -1)).filter((i) => i >= 0);
  assert.equal(spreadLabel(big, both), 'The contents');
  assert.deepEqual(readingText(big, both).blocks.flatMap((b) => b.items ?? []), PIECES.map((p, i) => `${p.title}, ${p.author}, page ${big[pagesOf(i, big).start].folio}`));
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
    const both2 = readingText(pages, [l, r]).blocks.length;
    const apart = readingText(pages, [l]).blocks.length + readingText(pages, [r]).blocks.length;
    const runsOn = pages[r].items.find((it) => it.type === 'body') && !pages[r].items.find((it) => it.type === 'body').start && pages[l].kind === pages[r].kind;
    assert.equal(both2, apart - (runsOn ? 1 : 0), `spread ${s}`);
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

test('each part as blocks for the text view: the words of its pages, numbered as their places', () => {
  assert.equal(sectionCount(book), SOURCES + 1);
  for (let s = 0; s < sectionCount(book); s++) {
    const blocks = sectionBlocks(book, s);
    // Every place a line of this part has is one of its blocks.
    const own = new Set(blocks.map((b) => b.b));
    for (const p of pages.filter((pg) => pg.section === s)) for (const it of p.items) if (!it.rule && !(s === SECTION.title && it.type === 'small')) assert.ok(own.has(it.at[1]), `part ${s}: block ${it.at[1]}`);
    if (s >= SECTION.piece && s < SOURCES) {
      const piece = PIECES[s - SECTION.piece];
      const text = blocks.filter((b) => b.b >= 0).flatMap((b) => (b.lines ? b.lines.flatMap(words) : words(b.text)));
      assert.deepEqual(text, words(piece.text), piece.title);
      assert.deepEqual(blocks.slice(0, 2).map((b) => b.text ?? b.author), [piece.title, piece.author]);
    }
  }
  assert.deepEqual(sectionBlocks(book, SECTION.contents).filter((b) => b.kind === 'entry').map((b) => b.to), PIECES.map((_, i) => SECTION.piece + i));
});
