// What a reader of the book chooses (public/js/reader.js, vrlbry's): the stored settings checked,
// one page or two, the text sizes, and the page themes the same in the 3D book and the text view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FONT_STEPS } from '../public/js/pages.js';
import { READ, THEMES, THEME_ORDER, fontStep, pageViewSetting, readerSettings, singlePage } from '../public/js/reader.js';

test('the stored settings: defaults for what is missing or wrong, the rest kept', () => {
  const defaults = { fontScale: 1, theme: 'paper', pageView: 'auto', readScale: 1, readDistance: null, textView: false, at: null };
  for (const raw of [null, undefined, 'x', 3, {}, []]) assert.deepEqual(readerSettings(raw), defaults);
  const kept = { fontScale: 1.25, theme: 'night', pageView: 'single', readScale: 1.4, readDistance: 0.7, textView: true, at: [3, 2, 41] };
  assert.deepEqual(readerSettings(JSON.parse(JSON.stringify(kept))), kept);
  const wrong = readerSettings({ fontScale: 'big', theme: 'toString', pageView: 'three', readScale: Infinity, readDistance: -1, textView: 'yes', at: [1, 'b', 0] });
  assert.deepEqual(wrong, { ...defaults, readDistance: READ.nearest });
  assert.equal(readerSettings({ readScale: 99 }).readScale, READ.maxScale);
  assert.equal(readerSettings({ readDistance: 9 }).readDistance, READ.farthest);
  assert.equal(readerSettings({ fontScale: 1.3 }).fontScale, 1.4, 'a size between the steps: the next one up');
  assert.equal(readerSettings({ fontScale: 7 }).fontScale, FONT_STEPS.at(-1));
});

test('text sizes step up and down, and stop at either end', () => {
  assert.equal(fontStep(1, 1), 1.1);
  assert.equal(fontStep(1, -1), 0.9);
  assert.equal(fontStep(FONT_STEPS.at(-1), 1), FONT_STEPS.at(-1));
  assert.equal(fontStep(FONT_STEPS[0], -1), FONT_STEPS[0]);
});

test('one page or two: upright screens one, headsets and wider screens two, unless chosen', () => {
  assert.equal(singlePage('auto', { aspect: 0.5 }), true);
  assert.equal(singlePage('auto', { aspect: 1.6 }), false);
  assert.equal(singlePage('auto', { xr: true, aspect: 0.5 }), false);
  assert.equal(singlePage('single', { xr: true }), true);
  assert.equal(singlePage('spread', { aspect: 0.5 }), false);
  // Kept as 'auto' when the choice is what 'auto' gives there.
  assert.equal(pageViewSetting(true, true), 'auto');
  assert.equal(pageViewSetting(true, false), 'single');
  assert.equal(pageViewSetting(false, true), 'spread');
});

test('the themes are vrlbry\'s, and the text view (style.css) has the same colours', () => {
  assert.deepEqual(THEME_ORDER, ['paper', 'sepia', 'night']);
  assert.deepEqual(Object.keys(THEMES), THEME_ORDER);
  const css = readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8');
  for (const name of THEME_ORDER) {
    const rule = name === 'paper' ? css.match(/\.tv \{([^}]*)\}/)[1] : css.match(new RegExp(`\\.tv\\[data-theme="${name}"\\] \\{([^}]*)\\}`))[1];
    const v = (k) => rule.match(new RegExp(`--tv-${k}: (#[0-9a-f]{6})`))[1];
    const t = THEMES[name];
    assert.deepEqual([v('paper'), v('ink'), v('link'), v('rule')], [t.paper, t.ink, t.link, t.rule], name);
  }
});
