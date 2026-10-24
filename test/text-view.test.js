// The text view (public/js/text-view.js, vrlbry's): each part of the book as DOM nodes (headings,
// author and source, paragraphs, stanzas, the contents as links), the place at the top of the
// view, and the places shared with the 3D book: every page's first words are where the view finds
// them, at every text size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeDocument, inner } from './helpers/fake-dom.js';
import { FONT_STEPS, SECTION, paginate } from '../public/js/pages.js';
import { firstWordBelow, partCount, partOf, partSections, renderPart, topBlock, wordStarts } from '../public/js/text-view.js';
import { BOOK_SUBTITLE, BOOK_TITLE, COLOPHON, PIECES } from '../public/js/reading.js';

const book = { title: BOOK_TITLE, subtitle: BOOK_SUBTITLE, pieces: PIECES, colophon: COLOPHON };
const measure = (text, font) => text.length * font.size * 0.5 + (font.spacing ?? 0) * text.length;
const words = (s) => s.split(/\s+/).filter(Boolean);

/** renderPart into a fresh container: the container, and the parts its links asked for. */
function render(part) {
  const doc = fakeDocument();
  const box = doc.createElement('div');
  const followed = [];
  renderPart(doc, box, book, part, { onLink: (s) => followed.push(s) });
  return { box, followed };
}

test('the parts: the title page with the contents, each piece, the sources', () => {
  assert.equal(partCount(book), PIECES.length + 2);
  assert.deepEqual(partSections(0), [SECTION.title, SECTION.contents]);
  assert.equal(partOf(SECTION.title), 0);
  assert.equal(partOf(SECTION.contents), 0);
  PIECES.forEach((_, i) => {
    assert.deepEqual(partSections(i + 1), [SECTION.piece + i]);
    assert.equal(partOf(SECTION.piece + i), i + 1);
  });
});

test('a piece: its title as a heading, its author and source, its paragraphs or stanzas in their lines', () => {
  const { box } = render(1); // The Ponds, prose
  const html = inner(box);
  assert.ok(html.startsWith(`<h2 data-s="2" data-b="-1" id="tv-2--1">The Ponds</h2><p class="tv-by" data-s="2" data-b="-1">${PIECES[0].author}</p>`));
  const all = box.childNodes.map((n) => n.textContent).join(' ');
  assert.deepEqual(words(all), [PIECES[0].title, PIECES[0].author, PIECES[0].source, PIECES[0].text].flatMap(words), 'every word, in order');
  const paras = box.findAll((e) => e.tagName === 'P' && Number(e.getAttribute('data-b')) >= 0);
  assert.deepEqual(paras.map((p) => p.textContent), PIECES[0].text.split(/\n\s*\n/).map((p) => words(p).join(' ')));
  // Verse: a stanza is a paragraph, its lines kept by <br>s.
  const brook = render(2).box.findAll((e) => e.getAttribute('class') === 'tv-verse');
  const stanzas = PIECES[1].text.split(/\n\s*\n/);
  assert.equal(brook.length, stanzas.length);
  assert.equal(inner(brook[0]), stanzas[0].split('\n').map((l) => words(l).join(' ')).join('<br>'));
  // Every element with a place, and the first of each place with its id.
  const ids = box.findAll((e) => e.getAttribute('id')).map((e) => e.getAttribute('id'));
  assert.equal(new Set(ids).size, ids.length);
});

test('the title page and the contents: the subtitle, then each piece as a link to it', () => {
  const { box, followed } = render(0);
  assert.equal(box.findAll((e) => e.tagName === 'H2').map((h) => h.textContent).join('|'), 'Contents', 'the book\'s title is the view\'s own h1');
  assert.equal(box.findAll((e) => e.getAttribute('class') === 'tv-sub')[0].textContent, BOOK_SUBTITLE);
  const links = box.findAll((e) => e.tagName === 'A');
  assert.deepEqual(links.map((a) => a.textContent), PIECES.map((p) => p.title));
  assert.deepEqual(links.map((a) => a.getAttribute('href')), PIECES.map((_, i) => `#tv-${SECTION.piece + i}--1`));
  const e = links[3].click();
  assert.ok(e.defaultPrevented);
  assert.deepEqual(followed, [SECTION.piece + 3]);
  assert.deepEqual(box.findAll((n) => n.tagName === 'LI').map((li) => li.textContent), PIECES.map((p) => `${p.title} · ${p.author}`));
});

test('the sources: a heading and the notes', () => {
  const { box } = render(partCount(book) - 1);
  assert.equal(box.findAll((e) => e.tagName === 'H2')[0].textContent, 'Sources');
  assert.deepEqual(box.findAll((e) => e.tagName === 'P').map((p) => p.textContent), COLOPHON.map((c) => words(c).join(' ')));
});

test('every page\'s first words are where the view finds the page\'s place, at every size', () => {
  const parts = Array.from({ length: partCount(book) }, (_, p) => render(p).box);
  for (const scale of FONT_STEPS) {
    for (const page of paginate(book, measure, { scale })) {
      const [s, b, w] = page.at;
      const first = page.items.find((it) => !it.rule);
      if (s === SECTION.title && b !== 0) continue; // the title page's heading is the view's own h1; its small print is left out
      const el = parts[partOf(s)].findAll((e) => e.getAttribute('data-s') === String(s) && e.getAttribute('data-b') === String(b))[0];
      assert.ok(el, `at ${scale}: no block for ${page.at}`);
      if (first.type !== 'body' && first.type !== 'small' && first.type !== 'bookSub') continue;
      const [node, offset] = wordStarts(el)[w];
      assert.equal(node.data.slice(offset).split(/\s/)[0], first.text.split(' ')[0], `at ${scale}: ${page.at}`);
    }
  }
});

test('the place at the top of the view: the first block reaching below it, and the first word in sight', () => {
  const rects = [{ s: 2, b: -1, top: 0, bottom: 40 }, { s: 2, b: 0, top: 40, bottom: 400 }, { s: 2, b: 1, top: 400, bottom: 900 }];
  assert.deepEqual(topBlock(rects, 20), [2, -1, 0]);
  assert.deepEqual(topBlock(rects, 100), [2, 0, 0]);
  assert.deepEqual(topBlock(rects, 2000), [2, 1, 0], 'past the end: the last');
  assert.deepEqual(topBlock([], 0), [SECTION.title, -1, 0]);
  // Ten words a line, lines 30 px: the first word whose line is below 95 is on the fourth line.
  const bottom = (i) => 30 * (Math.floor(i / 10) + 1);
  assert.equal(firstWordBelow(100, 95, bottom), 30);
  assert.equal(firstWordBelow(100, 0, bottom), 0);
  assert.equal(firstWordBelow(100, 5000, bottom), 99);
  assert.equal(firstWordBelow(0, 10, bottom), 0);
});
