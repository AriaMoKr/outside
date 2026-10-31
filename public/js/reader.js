// What a reader of the book chooses, as in vrlbry: the text size (pages.js FONT_STEPS), the page's
// theme (vrlbry's reader.js THEMES: paper, sepia, night; the text view's colours in style.css are
// the same, and a test keeps them so), one page at a time or two (vrlbry's spreads.js singlePage
// and pageViewSetting), how large the open book is and, in VR, how far away it is held, and where
// they are reading. Pure: book.js and main.js use it, and the tests run it in Node.
import { FONT_STEPS } from './pages.js';

export const THEMES = {
  paper: { paper: '#f6efdf', ink: '#231d16', light: '#8a7a62', rule: '#b9a78a', link: '#24508c', vignette: 'rgba(120,90,40,0.16)' },
  sepia: { paper: '#ecdcbc', ink: '#3b2a17', light: '#8c714b', rule: '#a68a5f', link: '#2c4c7c', vignette: 'rgba(110,70,20,0.22)' },
  night: { paper: '#24221f', ink: '#d9d0c0', light: '#8d8473', rule: '#5f574b', link: '#93b4dc', vignette: 'rgba(0,0,0,0.35)' },
};
export const THEME_ORDER = ['paper', 'sepia', 'night'];

/** @typedef {keyof typeof THEMES} ThemeName a page's theme: one of THEMES' names */
/** @typedef {'auto' | 'single' | 'spread'} PageView a page at a time, two, or as suits the view (singlePage) */

/**
 * How much smaller or larger than at first the open book can be made, and how near and far it can
 * be held (metres from the eyes): in VR not so near that it tires the eyes; on a screen, where
 * nearer is only larger, as near as a phone shows a page fitted to its width and then some.
 */
export const READ = { minScale: 0.6, maxScale: 2.5, nearest: 0.15, nearestScreen: 0.06, farthest: 1.6 };

/** Below this width-to-height ratio a screen gets a page at a time by default (a phone held upright). */
export const SINGLE_BELOW_ASPECT = 0.9;

/**
 * Whether the book shows a page at a time. `setting` (pageView): 'single', 'spread' or 'auto': one
 * page on a screen taller than wide, where a spread would be small; two in a headset and on wider
 * screens.
 * @param {PageView} setting
 * @param {{ xr?: boolean, aspect?: number }} [o] whether in a headset, and the view's width over its height
 */
export function singlePage(setting, { xr = false, aspect = 1 } = {}) {
  if (setting === 'single') return true;
  if (setting === 'spread') return false;
  return !xr && aspect < SINGLE_BELOW_ASPECT;
}

/** The setting that gives `single` where `auto` (what 'auto' gives here) is the default: 'auto' when they agree. @type {(single: boolean, auto: boolean) => PageView} */
export const pageViewSetting = (single, auto) => (single === auto ? 'auto' : single ? 'single' : 'spread');

/**
 * The next text size up (step 1) or down (-1) from `scale`, or the same at either end.
 * @param {number} scale
 * @param {number} step
 */
export function fontStep(scale, step) {
  let i = FONT_STEPS.findIndex((s) => s >= scale - 1e-6);
  if (i < 0) i = FONT_STEPS.length - 1;
  return FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, i + step))];
}

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** @type {(at: unknown) => boolean} */
const isPlace = (at) => Array.isArray(at) && at.length === 3 && at.every(Number.isInteger);

/** @typedef {{ fontScale: number, theme: ThemeName, pageView: PageView, readScale: number, readDistance: number | null, textView: boolean, at: import('./pages.js').At | null }} ReaderSettings the reader's choices (readerSettings) */

/**
 * The reader's choices as stored (main.js: localStorage outside.book), each one checked and the
 * defaults for what is missing or wrong: { fontScale, theme, pageView, readScale, readDistance
 * (null: as at first), textView (open the book as text), at (where they are reading, a place in
 * the book: pages.js, or null) }.
 * @param {any} raw what was stored, as JSON.parse gives it: anything (null when there is none)
 * @returns {ReaderSettings}
 */
export function readerSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  /** @type {(v: unknown) => boolean} */
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  return {
    fontScale: num(s.fontScale) ? fontStep(s.fontScale, 0) : 1,
    theme: Object.hasOwn(THEMES, s.theme) ? s.theme : 'paper',
    pageView: ['auto', 'single', 'spread'].includes(s.pageView) ? s.pageView : 'auto',
    readScale: num(s.readScale) ? clamp(s.readScale, READ.minScale, READ.maxScale) : 1,
    readDistance: num(s.readDistance) ? clamp(s.readDistance, READ.nearest, READ.farthest) : null,
    textView: s.textView === true,
    at: isPlace(s.at) ? s.at : null,
  };
}
