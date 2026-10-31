// The book on the bench (reading.js, set in pages by pages.js). Closed, it lies on the seat beside
// where one sits: a green cloth hardback, its title in gold. Opened, it is held in front of the
// reader, a little below their eyes and turned up to them: two pages and the leaf that turns over
// between them, at its spine, when a page is pressed (or the arrow keys, or a stick); or a page at
// a time (a phone held upright, or chosen), the book sliding across to the other.
// It reads as a book does in vrlbry, with vrlbry's controls: a toolbar under the pages (where one
// is, a slider to go anywhere, ◀ ▶, Contents, A− A+, one page or two, Theme, ✕, and ↩ Back once a
// link has been followed), the contents beside them (or over them, on a narrow screen), the
// contents page's entries as links, the text in any of vrlbry's sizes (set in pages again, at the
// same words) and themes, the book's distance and size (and, in VR, moved with a grip), and
// brought back in front of the eyes. Pages are painted when they are first needed, and a few are
// kept. Per frame nothing is allocated.
import * as THREE from 'three';
import { BOOK } from './garden.js';
import { BOOK_SUBTITLE, BOOK_TITLE, COLOPHON, PIECES } from './reading.js';
import {
  PAGE, SECTION, TEXT_WIDTH, TYPE, folioLabel, linkAt, pageAt, pageAtProgress, paginate, progressOf, sectionStart, sideOf,
  spreadCount, spreadOf, spreadPages, typeAt,
} from './pages.js';
import { READ, THEMES, THEME_ORDER, fontStep, pageViewSetting, singlePage } from './reader.js';
import { Panel, UI } from './canvas-panel.js';
import { GOLD, SERIF, canvas } from './textures.js';

const PAGE_W = 0.15, PAGE_H = (PAGE_W * PAGE.height) / PAGE.width;
const CLOTH = '#2f4a37';
const TURN = 0.5; // seconds a page takes to turn
const SLIDE = 0.3; // to slide across, one page at a time
const XR_DISTANCE = 0.42, XR_SCALE = 1.35; // held in VR: metres from the eyes, and larger than on a screen
/** The toolbar under the pages and the contents beside them: vrlbry's, in proportion (its pages are twice as large). */
const TOOLBAR = { width: 0.36, height: 0.065, gap: 0.008, px: 936 };
const CONTENTS = { width: 0.2, height: 0.26, px: 546 };
const TEXT = { title: BOOK_TITLE, subtitle: BOOK_SUBTITLE, pieces: PIECES, colophon: COLOPHON };
const TRAIL = 100; // places kept to go back to

const font = (t) => `${t.style} ${t.size}px ${SERIF}`.trim();
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** A page's picture in a theme (reader.js THEMES), at a text size's type (pages.js typeAt): paper, its text, its running head and number. */
function paintPage(page, theme, T) {
  const c = canvas(PAGE.width, PAGE.height), g = c.getContext('2d');
  g.fillStyle = theme.paper;
  g.fillRect(0, 0, c.width, c.height);
  // A little shading toward the spine, which is on the left of a right-hand page.
  const toSpine = page && page.side === 'verso' ? 1 : 0;
  const grad = g.createLinearGradient(toSpine ? c.width : 0, 0, toSpine ? c.width - 140 : 140, 0);
  grad.addColorStop(0, theme.vignette);
  grad.addColorStop(1, theme.vignette.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  if (!page) return c;
  const x0 = page.side === 'recto' ? PAGE.inner : PAGE.outer;
  g.fillStyle = theme.ink;
  g.strokeStyle = theme.rule;
  g.textBaseline = 'alphabetic';
  for (const it of page.items) {
    if (it.rule) {
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x0 + it.x0, it.y);
      g.lineTo(x0 + it.x1, it.y);
      g.stroke();
      continue;
    }
    const t = T[it.type];
    g.font = font(t);
    if (t.spacing && 'letterSpacing' in g) g.letterSpacing = `${t.spacing}px`;
    if (it.justify && it.text.includes(' ')) {
      // Spread the words to the line's full width.
      const words = it.text.split(' ');
      const inked = words.reduce((s, w) => s + g.measureText(w).width, 0);
      const gap = (it.justify - inked) / (words.length - 1);
      let x = x0 + it.x;
      g.textAlign = 'left';
      for (const w of words) {
        g.fillText(w, x, it.y);
        x += g.measureText(w).width + gap;
      }
    } else {
      g.textAlign = it.align;
      g.fillText(it.text, x0 + it.x, it.y);
    }
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }
  // The running head and the page number keep their size.
  g.fillStyle = theme.light;
  if (page.head) {
    g.font = font(TYPE.head);
    g.textAlign = 'center';
    g.fillText(page.side === 'verso' ? BOOK_TITLE : page.head, x0 + TEXT_WIDTH / 2, PAGE.top - 74);
  }
  if (page.folio) {
    g.font = font(TYPE.folio);
    g.textAlign = 'center';
    g.fillText(String(page.folio), x0 + TEXT_WIDTH / 2, PAGE.bottom + 74);
  }
  return c;
}

/** The cover: green cloth, a gold rule round it, the title and a small ornament. */
function coverCanvas() {
  const W = 512, H = Math.round((512 * BOOK.length) / BOOK.width);
  const c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = CLOTH;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.04)`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 1);
  }
  g.strokeStyle = GOLD;
  g.lineWidth = 4;
  g.strokeRect(28, 28, W - 56, H - 56);
  g.lineWidth = 1.5;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.fillStyle = GOLD;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 64px ${SERIF}`;
  g.fillText('By the', W / 2, H * 0.36);
  g.fillText('Water', W / 2, H * 0.36 + 76);
  // Three small waves.
  g.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    const y = H * 0.66 + k * 16;
    for (let x = W / 2 - 60; x <= W / 2 + 60; x += 4) {
      const v = y + Math.sin((x - W / 2) / 9) * 4;
      if (x === W / 2 - 60) g.moveTo(x, v);
      else g.lineTo(x, v);
    }
    g.stroke();
  }
  return c;
}

function sideCanvas(spine) {
  const c = canvas(256, 64), g = c.getContext('2d');
  if (spine) {
    g.fillStyle = CLOTH;
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = GOLD;
    g.font = `600 26px ${SERIF}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(BOOK_TITLE, 128, 33);
  } else {
    // The page edges.
    g.fillStyle = '#efe3c8';
    g.fillRect(0, 0, 256, 64);
    for (let y = 8; y < 56; y += 2) {
      g.fillStyle = 'rgba(120,100,70,0.18)';
      g.fillRect(0, y, 256, 1);
    }
    g.fillStyle = CLOTH;
    g.fillRect(0, 0, 256, 6);
    g.fillRect(0, 58, 256, 6);
  }
  return c;
}

const tex = (c, anisotropy) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
};

/** How far a page rises off the book, u of the way from the spine (0) to its edge (1). */
const rise = (u) => 0.012 * Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.15))) ** 0.7;

/** A page, curved a little up from the spine: its origin on the spine, reaching `dir` (+1 right, -1 left). */
function pageGeometry(dir) {
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 16, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + PAGE_W / 2) / PAGE_W; // 0 at the spine … 1 at the edge
    p.setX(i, dir * u * PAGE_W);
    p.setZ(i, rise(u) + 0.002);
  }
  if (dir < 0) {
    // Mirrored: keep it facing +z, and its picture the right way round.
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    g.index.array.reverse();
  }
  return g;
}

/**
 * The turning leaf's front (facing +z) or back (facing -z, its picture reversed so it reads the
 * right way once turned over), on the spine, reaching right. bendLeaf curves it as it turns.
 */
function leafGeometry(back) {
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 16, 1).translate(PAGE_W / 2, 0, 0);
  if (back) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    g.index.array.reverse();
  }
  return g;
}

/** Curves the leaf by k (1: as the right page; -1, turned over: as the left one), a side a little off it. */
function bendLeaf(g, k, off) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, k * rise(p.getX(i) / PAGE_W) + off);
  p.needsUpdate = true;
}

/** Boxes ([geometry, colour]) as one geometry, coloured by vertex: one draw call. */
function mergeBoxes(boxes) {
  const parts = boxes.map(([g]) => g.toNonIndexed());
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const position = new Float32Array(n * 3), color = new Float32Array(n * 3);
  let at = 0;
  parts.forEach((g, k) => {
    const c = new THREE.Color(boxes[k][1]);
    position.set(g.attributes.position.array, at * 3);
    for (let i = 0; i < g.attributes.position.count; i++) color.set([c.r, c.g, c.b], (at + i) * 3);
    at += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return out;
}

/** One side of the open book: its board and the pages under the open one (one mesh), and the page (dir -1 left, 1 right). */
function bookHalf(dir, coverMaterial, pageMaterial) {
  const group = new THREE.Group();
  const board = new THREE.BoxGeometry(PAGE_W + 0.006, PAGE_H + 0.012, 0.004).translate((dir * (PAGE_W + 0.006)) / 2, 0, -0.004);
  // The pages under the open one, between it and the board (its face just behind the page's).
  const block = new THREE.BoxGeometry(PAGE_W - 0.002, PAGE_H - 0.002, 0.006).translate((dir * (PAGE_W - 0.002)) / 2, 0, -0.0035);
  const page = new THREE.Mesh(pageGeometry(dir), pageMaterial);
  group.add(new THREE.Mesh(mergeBoxes([[board, CLOTH], [block, '#e9dcc0']]), coverMaterial), page);
  return { group, page };
}

export class Book {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {{ x: number, y: number, z: number, yaw: number }} o.place where it lies closed (garden.js layout's book)
   * @param {number} [o.anisotropy] its textures' anisotropic filtering (main.js's)
   * @param {(p: number[], n: number[]) => THREE.Color} o.light the light at a point
   * @param {ReturnType<import('./reader.js').readerSettings>} o.settings the reader's choices (main.js keeps them)
   */
  constructor({ scene, place, anisotropy = 1, light, settings }) {
    this.anisotropy = anisotropy;
    /** The reader's choices (reader.js readerSettings), changed here; onSettings when they have (main.js stores them). */
    this.settings = settings;
    this.pages = null; // set when it is first opened (setting it takes a few tens of milliseconds)
    this.spreads = 0;
    this.spread = 0;
    this.focus = 1; // one page at a time, the page shown: -1 left, 1 right
    this.single = false;
    this.isOpen = false;
    this.xr = false; // held in VR
    this.camera = null; // the eyes it was opened in front of
    /** Less motion (common/access.js): a page turns, and a narrow screen goes to the other page, at once. */
    this.reduceMotion = false;
    /**
     * (indices) the pages open to read, in reading order (the spread's two, or a page at a time the
     * one in view; none inside a cover): when it opens, and as soon as a page turns or the text
     * changes size. main.js puts their words where a screen reader reads them (pages.js
     * readingText), and the text view follows.
     * @type {(pages: number[]) => void}
     */
    this.onShow = () => {};
    /** A setting or the place being read changed: main.js stores them (reader.js readerSettings). */
    this.onSettings = () => {};
    /** The toolbar's ✕. */
    this.onClose = () => {};
    /** (pitch) on a screen, it was held in front of the eyes again: main.js looks down at it. @type {(pitch: number) => void} */
    this.onHold = () => {};
    /** (depth) a link was followed, `depth` deep: main.js adds an entry to the browser's history (back-history.js). @type {(depth: number) => void} */
    this.onTrail = () => {};
    /** back-history.js, when main.js has one: Back goes back through the browser's history. */
    this.history = null;
    /** The places a link was followed from (pages.js `at`), to go back to; the first dropped ones, counted. */
    this.trail = [];
    this._trailBase = 0;
    this._cache = new Map(); // page index → texture
    this._turning = null; // { t, side, to }
    this._slide = 0; // the open book's offset, while sliding
    this._slideTo = 0;
    this._saveIn = 0; // seconds until the settings are stored (the size and distance change every frame while a stick is held)
    this._grabbed = null; // the controller moving it
    this._sized = null; // the words the last change of text size kept to, and the place it showed: { at, shown }
    this._paged = null; // the page the last change to one page or two kept to: { i, shown }
    this._grabOffset = new THREE.Matrix4();
    /** The eyes _fit projects the book's corners as, made when first needed. @type {THREE.PerspectiveCamera | null} */
    this._fitCamera = null;
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    this._pick = { t: 0, kind: 'page', side: 0, panel: null, el: null, u: 0, v: 0, page: -1, link: null };
    this._pointerOn = { toolbar: false, contents: false };
    this._marked = { page: -1, link: null };
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._e = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._inverse = new THREE.Matrix4();

    // Closed, on the bench.
    const lit = light([place.x, place.y + 0.05, place.z], [0, 1, 0]);
    const tint = (c) => new THREE.MeshBasicMaterial({ map: tex(c, anisotropy), color: lit });
    const edge = tint(sideCanvas(false)), spine = tint(sideCanvas(true)), cover = tint(coverCanvas());
    const board = new THREE.MeshBasicMaterial({ color: new THREE.Color(CLOTH).multiply(lit) });
    // BoxGeometry's faces: +x, -x, +y, -y, +z, -z. Its x across the cover, z along it, y up.
    this.closed = new THREE.Mesh(new THREE.BoxGeometry(BOOK.width, BOOK.thickness, BOOK.length), [edge, spine, cover, board, edge, edge]);
    this.closed.name = 'book (closed)';
    this.closed.position.set(place.x, place.y + BOOK.thickness / 2 + 0.003, place.z);
    this.closed.rotation.y = place.yaw + 0.12;
    scene.add(this.closed);

    // Open: the two halves (a page at a time shows one), and the leaf that turns.
    this.group = new THREE.Group();
    this.group.name = 'book (open)';
    this.group.visible = false;
    this.inner = new THREE.Group(); // slides, a page at a time
    this.group.add(this.inner);
    const paper = () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const covers = new THREE.MeshBasicMaterial({ vertexColors: true });
    const L = bookHalf(-1, covers, paper()), R = bookHalf(1, covers, paper());
    this.leftHalf = L.group;
    this.rightHalf = R.group;
    this.left = L.page;
    this.right = R.page;
    this.leaf = new THREE.Group();
    this.leafFront = new THREE.Mesh(leafGeometry(false), paper());
    this.leafBack = new THREE.Mesh(leafGeometry(true), paper());
    this.leaf.add(this.leafFront, this.leafBack);
    this.leaf.visible = false;
    // A contents entry pointed at: a band over it, curved with its page.
    this.mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 16, 1), new THREE.MeshBasicMaterial({ color: THEMES[settings.theme].link, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
    this.mark.name = 'book (link)';
    this.mark.visible = false;
    this.mark.renderOrder = 5;
    this.inner.add(L.group, R.group, this.leaf, this.mark);

    this.toolbar = new Panel({ width: TOOLBAR.width, height: TOOLBAR.height, px: TOOLBAR.px, anisotropy });
    this.toolbar.mesh.name = 'book (toolbar)';
    this.contents = new Panel({ width: CONTENTS.width, height: CONTENTS.height, px: CONTENTS.px, anisotropy });
    this.contents.mesh.name = 'book (contents)';
    this.contents.visible = false;
    this.group.add(this.toolbar.mesh, this.contents.mesh);
    this._buildToolbar();
    scene.add(this.group);
  }

  // ── The toolbar and the contents (vrlbry's) ────────────────────────────────

  _buildToolbar() {
    const p = this.toolbar, W = p.w, pad = 18;
    p.add({ id: 'slider', type: 'slider', x: pad + 10, y: 10, w: W - 2 * pad - 230, h: 48, value: 0, onClick: (v) => this.jumpToProgress(v) });
    p.add({ id: 'back', type: 'button', x: pad, y: 8, w: 132, h: 52, label: '↩ Back', size: 26, hidden: true, onClick: () => this.goBack() });
    p.add({ id: 'label', type: 'text', x: W - pad - 210, y: 16, w: 210, h: 40, text: '', size: 26, align: 'right', color: UI.muted });
    const by = 68, bh = 84;
    /** The buttons along it: [id, label, width, what it does]. @type {[string, string, number, () => void][]} */
    const defs = [
      ['prev', '◀', 88, () => this.turn(-1)],
      ['next', '▶', 88, () => this.turn(1)],
      ['toc', 'Contents', 146, () => this.toggleContents()],
      ['smaller', 'A−', 84, () => this.changeFont(-1)],
      ['larger', 'A+', 84, () => this.changeFont(1)],
      ['pages', '1 page', 136, () => this.togglePages()], // the other view (_showPagesButton)
      ['theme', 'Theme', 108, () => this.cycleTheme()],
      ['close', '✕', 84, () => this.onClose()],
    ];
    const total = defs.reduce((s, d) => s + d[2], 0);
    const gap = (W - 2 * pad - total) / (defs.length - 1);
    let x = pad;
    for (const [id, label, w, fn] of defs) {
      p.add({ id, type: 'button', x, y: by, w, h: bh, label, size: ['toc', 'pages', 'theme'].includes(id) ? 28 : 34, onClick: fn });
      x += w + gap;
    }
  }

  /** The toolbar as things are now: where one is, the slider, what ◀ ▶ can do, the other view, Back, Contents. */
  _updateToolbar() {
    const p = this.toolbar;
    const spread = this._target();
    const last = spread === this.spreads - 1;
    p.set('label', { text: folioLabel(this.pages, this._reading(spread)) });
    p.set('slider', { value: progressOf(this.pages, this._readingIndex()) });
    p.set('prev', { disabled: spread === 0 });
    p.set('next', { disabled: last && (!this.single || this.focus > 0 || spreadPages(this.pages, spread)[1] === null) });
    p.set('pages', { label: this.single ? '2 pages' : '1 page' });
    p.set('toc', { active: this.contents.visible });
    const back = this.trail.length > 0, pad = 18;
    p.set('back', { hidden: !back });
    p.set('slider', back ? { x: pad + 146, w: p.w - 2 * pad - 230 - 136 } : { x: pad + 10, w: p.w - 2 * pad - 230 });
  }

  /** The contents, the piece being read marked: each piece, its author and its page. */
  _fillContents() {
    const p = this.contents;
    p.clear();
    p.add({ type: 'text', x: 30, y: 24, w: p.w - 140, h: 50, text: 'Contents', size: 40, weight: '600', serif: true, color: UI.accent });
    p.add({ id: 'close', type: 'button', x: p.w - 100, y: 18, w: 70, h: 60, label: '✕', size: 32, onClick: () => this.toggleContents(false) });
    const here = this.pages[this._readingIndex()].section;
    p.add({
      id: 'list', type: 'list', x: 20, y: 96, w: p.w - 40, h: p.h - 110, rowH: 84, size: 28, serif: true,
      items: PIECES.map((piece, i) => ({
        label: piece.title, sub: piece.author, right: String(this.pages[sectionStart(this.pages, SECTION.piece + i)].folio),
        active: here === SECTION.piece + i, onClick: () => this.goTo(SECTION.piece + i),
      })),
    });
  }

  /** Shows the contents beside the pages (or hides it). */
  toggleContents(show = !this.contents.visible) {
    if (show && !this.isOpen) return;
    if (show) this._fillContents();
    this.contents.visible = show;
    this._pointerOn.contents = false;
    this._placePanels();
    this._updateToolbar();
  }

  /** The keys, in the contents (↑ ↓): the entry marked moves; whether the contents is open to take them. */
  moveContents(dir) {
    if (!this.contents.visible) return false;
    const list = /** @type {import('./canvas-panel.js').ListElement} */ (this.contents.get('list')); // _fillContents's
    const n = list.items.length;
    const from = Number.isInteger(list.hoverRow) ? list.hoverRow : list.items.findIndex((it) => it.active);
    list.hoverRow = clamp((from < 0 ? (dir > 0 ? -1 : n) : from) + dir, 0, n - 1);
    this.contents.hover = list;
    this.contents.markDirty();
    return true;
  }

  /** Enter, in the contents: goes to the entry marked; whether there was one. */
  chooseContents() {
    if (!this.contents.visible) return false;
    const list = /** @type {import('./canvas-panel.js').ListElement} */ (this.contents.get('list')); // _fillContents's
    const it = Number.isInteger(list.hoverRow) ? list.items[list.hoverRow] : null;
    if (!it) return false;
    it.onClick();
    return true;
  }

  /**
   * The toolbar under the pages, scaled to a screen's width there (it is wider than a page); the
   * contents beside them, turned to the reader, or over them when that would be off the screen.
   */
  _placePanels() {
    const ts = this._toolbarScale();
    const bar = this.toolbar.mesh;
    bar.scale.setScalar(ts);
    bar.position.set(0, -PAGE_H / 2 - TOOLBAR.gap - (TOOLBAR.height * ts) / 2, 0.012);
    bar.rotation.set(-0.35, 0, 0);
    const toc = this.contents.mesh;
    const half = this._viewHalfWidth();
    const beside = (this.single ? -PAGE_W / 2 : -PAGE_W - 0.006) - 0.012 - CONTENTS.width / 2;
    if (beside - CONTENTS.width / 2 >= -0.98 * half) {
      toc.position.set(beside, 0, 0.03);
      toc.rotation.set(0, 0.45, 0);
      toc.scale.setScalar(1);
    } else {
      toc.position.set(0, 0, 0.03);
      toc.rotation.set(0, 0, 0);
      toc.scale.setScalar(Math.min(1, (0.96 * this._viewHalfWidth(0.03)) / (CONTENTS.width / 2), (0.96 * PAGE_H) / CONTENTS.height));
    }
    this.group.updateMatrixWorld(true);
  }

  /** Half the width a screen shows at the open book (or `z` in front of it), in its own units; Infinity in VR. */
  _viewHalfWidth(z = 0) {
    if (this.xr || !this.camera) return Infinity;
    const d = this.camera.getWorldPosition(this._e).distanceTo(this.group.position) / this.group.scale.x;
    return (d - z) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
  }

  _toolbarScale() {
    return Math.min(1, (0.96 * this._viewHalfWidth(0.03)) / (TOOLBAR.width / 2));
  }

  // ── Pages ──────────────────────────────────────────────────────────────────

  /** Sets it in pages at the text size chosen (the first time it is needed, and again at another size). */
  _layout() {
    const g = canvas(8, 8).getContext('2d');
    this.pages = paginate(TEXT, (text, t) => {
      g.font = font(t);
      return g.measureText(text).width + (t.spacing ?? 0) * text.length;
    }, { scale: this.settings.fontScale });
    this._type = typeAt(this.settings.fontScale);
    this.spreads = spreadCount(this.pages);
  }

  /** Sets it in pages, the first time, open where the reader was last time. */
  _set() {
    if (this.pages) return;
    this._layout();
    if (this.settings.at) this._at(pageAt(this.pages, this.settings.at));
  }

  /** Spread and side of page i (without showing it). */
  _at(i) {
    this.spread = spreadOf(i);
    this.focus = sideOf(i);
    this._slide = this._slideTo = this.single ? -this.focus * (PAGE_W / 2) : 0;
    this.inner.position.x = this._slide;
  }

  /** The texture of page i (painted the first time), or of a blank one for null. */
  _page(i) {
    const key = i ?? -1;
    if (!this._cache.has(key)) {
      this._cache.set(key, tex(paintPage(i === null ? null : this.pages[i], THEMES[this.settings.theme], this._type), this.anisotropy));
      // Keep a few: this one's spread, and the spreads either side of the one open (a turn to a far
      // spread paints its pages before it is the one open).
      if (this._cache.size > 10) {
        for (const [k, t] of this._cache) {
          if (k === -1 || spreadOf(k) === spreadOf(key) || Math.abs(k - 2 * this.spread) <= 4) continue;
          t.dispose();
          this._cache.delete(k);
          if (this._cache.size <= 8) break;
        }
      }
    }
    return this._cache.get(key);
  }

  /** All pages to be painted again (another theme, another size). */
  _forget() {
    for (const t of this._cache.values()) t.dispose();
    this._cache.clear();
  }

  _setMap(mesh, i) {
    mesh.material.map = this._page(i);
    mesh.material.needsUpdate = true;
  }

  /** Shows spread `this.spread` on the two pages. */
  _show() {
    const [l, r] = spreadPages(this.pages, this.spread);
    this._setMap(this.left, l);
    this._setMap(this.right, r);
  }

  /** The pages open to read at `spread`: both, or a page at a time the one in view (onShow). */
  _reading(spread) {
    const [l, r] = spreadPages(this.pages, spread);
    return (this.single ? [this.focus < 0 ? l : r] : [l, r]).filter((i) => i !== null);
  }

  /** The spread open, or the one a turn under way goes to. */
  _target() {
    return this._turning ? this._turning.to : this.spread;
  }

  /** The page being read (vrlbry's): the left one of two, else the right; a page at a time, the one in view. */
  _readingIndex(spread = this._target()) {
    const [l, r] = spreadPages(this.pages, spread);
    return this.single ? (this.focus < 0 ? l : r) ?? r ?? l : l ?? r;
  }

  /** The pages open to read now (as onShow said them), and the page being read. */
  readingPages() {
    return this._reading(this._target());
  }

  readingIndex() {
    return this._readingIndex();
  }

  /** Where the reader is: the place (pages.js `at`) of the page being read. */
  get place() {
    return this.pages ? this.pages[this._readingIndex()].at : this.settings.at;
  }

  /** The pages now open (or a turn under way goes to), said (onShow), on the toolbar, and kept as the place being read. */
  _shown() {
    this.settings.at = this.pages[this._readingIndex()].at;
    this._updateToolbar();
    if (this.contents.visible) this._fillContents();
    this._markLink(-1, null);
    this._saveIn = 0.4;
    this.onShow(this.readingPages());
  }

  /**
   * Opens it in front of the camera: at reading distance a little below the eyes, turned up to
   * them, its toolbar under it. On a screen it is as near as fills most of the view; on a narrow
   * one (or when chosen), a page at a time. In VR, as far and as large as it was last held.
   */
  open(camera, { xr = false, aspect = 1, fov = 70 } = {}) {
    this.xr = xr;
    this.single = singlePage(this.settings.pageView, { xr, aspect });
    this._set();
    this.camera = camera;
    this.isOpen = true;
    this.closed.visible = false;
    this.group.visible = true;
    if (this.spread === 0) this.focus = 1;
    const { pitch } = this._hold({ aspect, fov });
    this._show();
    this._shown();
    return { pitch };
  }

  /**
   * Puts it in front of the eyes (as when it opens): the way they face, held low, looked down at.
   * On a screen, as near as the pages and the toolbar under them fill most of the view; in VR, as
   * far as it was last held there.
   */
  _hold({ aspect = this.camera.aspect, fov = this.camera.fov } = {}) {
    const camera = this.camera;
    camera.updateMatrixWorld();
    camera.getWorldPosition(this._o);
    camera.getWorldDirection(this._d);
    const yaw = Math.atan2(-this._d.x, -this._d.z);
    const down = this.xr ? 0.5 : 0.36; // radians below level: held low, looked down at
    const scale = (this.xr ? XR_SCALE : 1) * this.settings.readScale;
    this.group.scale.setScalar(scale);
    // Facing back up the line to the eyes: its face (+z) turned toward them, its top away.
    this.group.rotation.set(-down, yaw, 0, 'YXZ');
    this._slide = this._slideTo = this.single ? -this.focus * (PAGE_W / 2) : 0;
    this.inner.position.x = this._slide;
    const eye = this._o.clone();
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(down), -Math.sin(down), -Math.cos(yaw) * Math.cos(down));
    const put = (distance, lift) => {
      this.group.position.copy(eye).addScaledVector(dir, distance);
      if (lift) this.group.translateY(lift);
      this.group.updateMatrixWorld(true);
      this._placePanels();
    };
    if (this.xr) put(this.settings.readDistance ?? XR_DISTANCE, 0);
    else this._fit(put, eye, yaw, down, { aspect, fov });
    return { pitch: -down };
  }

  /**
   * On a screen: as near as the pages, and the toolbar under them, fill the view between a margin
   * at its top and a strip at its foot (the hint and the buttons there), as vrlbry's fitOnePage
   * does. Their corners are projected as the eyes will see them (looking down at it), since the
   * pages' curve and the toolbar come nearer than the book's middle; a few rounds settle it.
   */
  _fit(put, eye, yaw, down, { aspect, fov }) {
    const TOP = 0.96, FOOT = -0.8, SIDE = 0.95; // the view's extent the book may fill (-1 to 1)
    const cam = (this._fitCamera ??= new THREE.PerspectiveCamera());
    cam.fov = fov;
    cam.aspect = aspect;
    cam.near = 0.01;
    cam.updateProjectionMatrix();
    cam.position.copy(eye);
    cam.rotation.set(-down, yaw, 0, 'YXZ');
    cam.updateMatrixWorld(true);
    const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const v = new THREE.Vector3();
    let distance = (PAGE_H * this.group.scale.x) / tv, lift = 0;
    for (let round = 0; round < 8; round++) {
      put(distance, lift);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const see = (obj, x, y, z, wide = true) => {
        v.set(x, y, z);
        obj.localToWorld(v).project(cam);
        if (wide) {
          x0 = Math.min(x0, v.x);
          x1 = Math.max(x1, v.x);
        }
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      };
      // The pages shown (a page at a time, the one in front), their edges and where they rise most;
      // the toolbar's height under them (it narrows itself to the screen: _placePanels).
      for (const side of this.single ? [this.focus] : [-1, 1]) {
        for (const u of [0, 0.43, 1]) for (const y of [-PAGE_H / 2 - 0.006, PAGE_H / 2 + 0.006]) see(this.inner, side * (u * PAGE_W + (u === 1 ? 0.006 : 0)), y, rise(u) + 0.002);
      }
      for (const y of [-TOOLBAR.height / 2, TOOLBAR.height / 2]) see(this.toolbar.mesh, 0, y, 0, false);
      const k = Math.max((y1 - y0) / (TOP - FOOT), (x1 - x0) / (2 * SIDE));
      // Up or down so the block's middle is the space's: NDC times the half-height seen there.
      lift += ((TOP + FOOT) / 2 - (y0 + y1) / 2) * distance * tv;
      distance *= k;
      if (Math.abs(k - 1) < 0.002 && Math.abs((TOP + FOOT) / 2 - (y0 + y1) / 2) < 0.004) break;
    }
    put(distance, lift);
  }

  /** F, a thumbstick pressed, or the overlay's button: the book back in front of the eyes, as when it opened. */
  toFront() {
    if (!this.isOpen) return;
    this._grabbed = null;
    const { pitch } = this._hold();
    if (!this.xr) this.onHold(pitch);
  }

  /** The screen changed shape: one page or two again ('auto'), held where it fits. */
  refit() {
    if (!this.isOpen || this.xr) return;
    const single = singlePage(this.settings.pageView, { aspect: this.camera.aspect });
    if (single !== this.single) this.setSingle(single);
    else this.toFront();
  }

  close() {
    this.isOpen = false;
    this.group.visible = false;
    this.closed.visible = true;
    this._finishTurn();
    this._grabbed = null;
    this.contents.visible = false;
    this.setHover(null);
    this.trail = [];
    this._trailBase = 0;
  }

  /** On a page (side 1) or back one (side -1). */
  turn(side) {
    if (!this.isOpen) return;
    if (this._turning) this._finishTurn();
    if (this.single) {
      // A page at a time: across the spread, then over the leaf.
      const across = side > 0 ? this.focus < 0 : this.focus > 0 && this.spread > 0;
      if (across) {
        if (side > 0 && spreadPages(this.pages, this.spread)[1] === null) return; // the inside of the back cover
        this._focus(side);
        this._shown();
        return;
      }
    }
    this._turnTo(this.spread + side);
  }

  /** Over to spread `to` with the leaf, from either side; a page at a time, to the side `focus` (or as a turn leaves it). */
  _turnTo(to, focus = null) {
    if (to < 0 || to >= this.spreads) return;
    if (this._turning) this._finishTurn();
    if (to === this.spread) {
      if (this.single && focus !== null && focus !== this.focus) this._focus(focus);
      this._shown();
      return;
    }
    const side = to > this.spread ? 1 : -1;
    const [ol, or] = spreadPages(this.pages, this.spread);
    const [nl, nr] = spreadPages(this.pages, to);
    if (side > 0) {
      // The right page lifts and goes over to the left; the next right is under it.
      this._setMap(this.right, nr);
      this._setMap(this.leafFront, or);
      this._setMap(this.leafBack, nl);
      this._setMap(this.left, ol);
    } else {
      this._setMap(this.left, nl);
      this._setMap(this.leafFront, nr);
      this._setMap(this.leafBack, ol);
      this._setMap(this.right, or);
    }
    this.leaf.visible = true;
    this._leafAt(side > 0 ? 0 : 1);
    this._turning = { t: 0, side, to };
    if (this.single) this._focus(focus ?? (side > 0 ? -1 : 1));
    this._shown();
  }

  /** To page i with a turn (the contents, a link, the slider, Back). */
  _jumpTo(i) {
    this._turnTo(spreadOf(i), sideOf(i));
  }

  /** Shows page i at once, without a turn (another size, one page or two, the text view's place). */
  _showAt(i) {
    this._finishTurn();
    this._at(i);
    this._show();
    this._shown();
  }

  /** The leaf e of the way over (0 lying on the right, 1 on the left), bending as it goes and lifting a little. */
  _leafAt(e) {
    const angle = -Math.PI * e, k = Math.cos(angle);
    this.leaf.rotation.y = angle;
    this.leaf.position.z = 0.012 * Math.sin(Math.PI * e);
    bendLeaf(this.leafFront.geometry, k, 0.003);
    bendLeaf(this.leafBack.geometry, k, -0.003);
  }

  _focus(f) {
    this.focus = f;
    this._slideTo = -f * (PAGE_W / 2);
  }

  _finishTurn() {
    const t = this._turning;
    if (!t) return;
    this._turning = null;
    this.spread = t.to;
    this.leaf.visible = false;
    this._show();
  }

  // ── What the reader chooses ────────────────────────────────────────────────

  /**
   * A step larger (1) or smaller (-1) text (+ −, A+ A−): set in pages again, open at the same
   * words. Steps one after another keep to the words the first started from (the page with them
   * may come on the right, and the left one, read first, is earlier), until a page is turned.
   */
  changeFont(step) {
    if (!this.isOpen) return;
    const next = fontStep(this.settings.fontScale, step);
    if (next === this.settings.fontScale) return;
    const at = this._sized?.shown === this.place ? this._sized.at : this.place;
    this.settings.fontScale = next;
    this._finishTurn();
    this._forget();
    this._layout();
    this._showAt(pageAt(this.pages, at));
    this._sized = { at, shown: this.place };
  }

  /** A theme by name (paper, sepia or night): the pages painted again, the text and its place as they were. */
  setTheme(name) {
    if (!Object.hasOwn(THEMES, name) || name === this.settings.theme) return;
    this.settings.theme = name;
    this.mark.material.color.set(THEMES[name].link);
    this._forget();
    if (this.isOpen) {
      this._finishTurn();
      this._show();
      this._shown();
    } else this.onSettings();
  }

  /** N, Theme: the next theme. */
  cycleTheme() {
    this.setTheme(THEME_ORDER[(THEME_ORDER.indexOf(this.settings.theme) + 1) % THEME_ORDER.length]);
  }

  /**
   * P, "1 page" / "2 pages": the other view, at the page being read. Kept as the setting, or as
   * 'auto' when it is what 'auto' gives here.
   */
  togglePages() {
    if (!this.isOpen) return;
    const single = !this.single;
    this.settings.pageView = pageViewSetting(single, singlePage('auto', { xr: this.xr, aspect: this.camera.aspect }));
    this.setSingle(single);
  }

  /**
   * Shows it a page at a time (single) or two, at the page being read; on a screen, where that
   * fits. Back and forth without a turn, it keeps to the page it started from (two pages are read
   * from the left one).
   */
  setSingle(single) {
    if (!this.isOpen || single === this.single) return;
    this._finishTurn();
    const i = this._paged?.shown === this.place ? this._paged.i : this._readingIndex();
    this.single = single;
    this._showAt(i);
    this._paged = { i, shown: this.place };
    if (this.xr) this._placePanels();
    else this.toFront();
  }

  // ── Where the book is held ─────────────────────────────────────────────────

  /** Nearer (delta < 0) or farther, in metres: the wheel, a pinch, a gamepad's triggers, the right stick in VR. */
  adjustDistance(delta) {
    if (!this.isOpen) return;
    const eye = this.camera.getWorldPosition(this._e);
    const to = this._w.copy(this.group.position).sub(eye);
    const d = clamp(to.length() + delta, this.xr ? READ.nearest : READ.nearestScreen, READ.farthest);
    this.group.position.copy(eye).addScaledVector(to.normalize(), d);
    // Only the distance in VR is kept; a screen fits the book to itself each time.
    if (this.xr) {
      this.settings.readDistance = d;
      this._saveIn = 0.4;
    }
    this._placePanels();
  }

  /** Larger (delta > 0) or smaller, by that fraction: the left stick in VR. */
  adjustScale(delta) {
    if (!this.isOpen) return;
    this.settings.readScale = clamp(this.settings.readScale * (1 + delta), READ.minScale, READ.maxScale);
    this.group.scale.setScalar((this.xr ? XR_SCALE : 1) * this.settings.readScale);
    this._placePanels();
    this._saveIn = 0.4;
  }

  /** A grip squeezed in VR: the book moves with that controller (object) until it is let go. */
  grab(object) {
    if (!this.isOpen) return;
    object.updateMatrixWorld(true);
    this._grabbed = object;
    this._grabOffset.copy(object.matrixWorld).invert().multiply(this.group.matrixWorld);
  }

  release(object) {
    if (this._grabbed === object) this._grabbed = null;
  }

  /** As it first was: as large, and (in VR) as far away (main.js: Home, Reset view). */
  resetHold() {
    this.settings.readScale = 1;
    this.settings.readDistance = null;
    this.onSettings();
  }

  // ── Links and Back ─────────────────────────────────────────────────────────

  /** The contents (the panel's): to the start of part `section`, with a turn. */
  goTo(section) {
    if (!this.isOpen) return;
    this.toggleContents(false);
    const i = sectionStart(this.pages, section);
    if (i >= 0) this._jumpTo(i);
  }

  /** A contents entry on the page: there, where one was going on the trail, for Back. */
  followLink(section) {
    if (!this.isOpen) return;
    this.trail.push(this.place);
    if (this.trail.length > TRAIL) {
      this.trail.shift();
      this._trailBase++;
    }
    this.goTo(section);
    this.onTrail(this._trailBase + this.trail.length); // the browser's Back comes back here too
    this._updateToolbar();
  }

  /** Back along the links followed (the toolbar's ↩ Back, Backspace, B): through the browser's history when it has the link's entry. */
  goBack() {
    if (!this.isOpen || !this.trail.length) return;
    if (this.history?.back()) return; // its popstate comes back as backTo
    this._jumpTo(pageAt(this.pages, this.trail.pop()));
    this._updateToolbar();
  }

  /**
   * Back to where the trail was `depth` links deep (the browser's Back: back-history.js); false
   * when it has no such place (the book was closed meanwhile).
   */
  backTo(depth) {
    const i = depth - this._trailBase;
    if (!this.isOpen || i < 0 || i >= this.trail.length) return false;
    const at = this.trail[i];
    this.trail.length = i;
    this._jumpTo(pageAt(this.pages, at));
    this._updateToolbar();
    return true;
  }

  /** One step back (B, Y, Backspace): the contents closed, else back along the links; false when there is nothing (main.js puts the book down). */
  back() {
    if (this.contents.visible) {
      this.toggleContents(false);
      return true;
    }
    if (this.trail.length) {
      this.goBack();
      return true;
    }
    return false;
  }

  /** The slider: that far into the book, with a turn. */
  jumpToProgress(v) {
    if (this.isOpen) this._jumpTo(pageAtProgress(this.pages, v));
  }

  /** Whether the pages open hold a place of the book (pages.js `at`: [section, block, word]). */
  showsPlace(at) {
    return this.readingPages().includes(pageAt(this.pages, at));
  }

  /**
   * To the page of a place (the text view's): with a turn, or at once (inPlace: the text view
   * covers the book), unless the pages open show it already. Whether it moved.
   */
  jumpToPlace(at, { inPlace = false } = {}) {
    if (!this.isOpen || this.showsPlace(at)) return false;
    const i = pageAt(this.pages, at);
    if (inPlace) this._showAt(i);
    else this._jumpTo(i);
    return true;
  }

  // ── Pointing at it ─────────────────────────────────────────────────────────

  /**
   * A ray (world space) at the open book: what it meets first, its contents, its toolbar or a
   * page: { t, kind: 'bookui', panel, el (what can be used there, or null), u, v } or { t, kind:
   * 'page', side (-1 the left page, 1 the right, as one turns back or on), page (its index, -1
   * inside a cover), link (a contents entry there, or null) }, or null. A page at a time, the page
   * shown: its left half back, right on. The same object each time.
   */
  pick(ox, oy, oz, dx, dy, dz) {
    if (!this.isOpen) return null;
    const out = this._pick;
    let best = Infinity;
    if (this.contents.visible) best = this._pickPanel(this.contents, ox, oy, oz, dx, dy, dz, best);
    best = this._pickPanel(this.toolbar, ox, oy, oz, dx, dy, dz, best);
    this._inverse.copy(this.group.matrixWorld).invert();
    const o = this._o.set(ox, oy, oz).applyMatrix4(this._inverse);
    const d = this._d.set(dx, dy, dz).transformDirection(this._inverse);
    if (Math.abs(d.z) > 1e-6) {
      const s = (0.006 - o.z) / d.z;
      const x = o.x + d.x * s - this._slide, y = o.y + d.y * s;
      // Back in world units: the group may be scaled.
      const t = s * this.group.scale.x;
      let side = 0;
      if (s > 0 && t < best && Math.abs(y) <= PAGE_H / 2 + 0.01 && Math.abs(x) <= PAGE_W + 0.01) {
        if (this.single) {
          const centre = this.focus * (PAGE_W / 2);
          if (Math.abs(x - centre) <= PAGE_W / 2 + 0.01) side = x < centre ? -1 : 1;
        } else side = x < 0 ? -1 : 1;
      }
      if (side) {
        best = t;
        const [l, r] = spreadPages(this.pages, this.spread);
        const onLeft = this.single ? this.focus < 0 : x < 0;
        const page = (onLeft ? l : r) ?? -1;
        out.t = t;
        out.kind = 'page';
        out.side = side;
        out.page = page;
        out.panel = out.el = null;
        out.link = null;
        if (page >= 0 && this.pages[page].links.length && !this._turning) {
          // Where on the page, in its pixels from the text block's left (pages.js).
          const px = ((onLeft ? x + PAGE_W : x) / PAGE_W) * PAGE.width - (this.pages[page].side === 'recto' ? PAGE.inner : PAGE.outer);
          out.link = linkAt(this.pages[page], px, ((PAGE_H / 2 - y) / PAGE_H) * PAGE.height);
        }
      }
    }
    return best < Infinity ? out : null;
  }

  /** The ray against one of its panels: nearer than `best`, it is the pick's. */
  _pickPanel(panel, ox, oy, oz, dx, dy, dz, best) {
    const mesh = panel.mesh;
    this._inverse.copy(mesh.matrixWorld).invert();
    const o = this._o.set(ox, oy, oz).applyMatrix4(this._inverse);
    const d = this._d.set(ox + dx, oy + dy, oz + dz).applyMatrix4(this._inverse).sub(o);
    if (Math.abs(d.z) < 1e-9) return best;
    const s = -o.z / d.z;
    if (s <= 0) return best;
    const x = o.x + d.x * s, y = o.y + d.y * s;
    if (Math.abs(x) > panel.width / 2 || Math.abs(y) > panel.height / 2) return best;
    // d was the unit world direction carried into the panel's space: s is in world units.
    if (s >= best) return best;
    const out = this._pick;
    out.t = s;
    out.kind = 'bookui';
    out.panel = panel;
    out.u = x / panel.width + 0.5;
    out.v = y / panel.height + 0.5;
    out.el = panel.elementAt(out.u, out.v);
    out.side = 0;
    out.page = -1;
    out.link = null;
    return s;
  }

  /**
   * What is pointed at now (a pick's fields, or null): its panel's button lights, or a contents
   * entry gets its band. Called every frame; nothing is redrawn unless what is pointed at changed.
   */
  setHover(hit) {
    const ui = hit && hit.kind === 'bookui' ? hit.panel : null;
    this._hoverPanel(this.toolbar, 'toolbar', ui === this.toolbar, hit);
    this._hoverPanel(this.contents, 'contents', ui === this.contents, hit);
    const link = hit && hit.kind === 'page' ? hit.link : null;
    this._markLink(link ? hit.page : -1, link);
  }

  _hoverPanel(panel, key, on, hit) {
    if (on) panel.pointerMove(hit.u, hit.v);
    else if (this._pointerOn[key]) panel.pointerLeave();
    this._pointerOn[key] = on;
  }

  /** Uses what a pick is on: a button or entry of a panel, a contents entry on the page, or turns the page. */
  press(hit) {
    if (!this.isOpen) return;
    if (hit.kind === 'bookui') hit.panel.click(hit.u, hit.v);
    else if (hit.link) this.followLink(hit.link.section);
    else this.turn(hit.side);
  }

  /** The band over a contents entry (link, on page i), or none. */
  _markLink(i, link) {
    const m = this._marked;
    if (m.page === i && m.link === link) return;
    m.page = i;
    m.link = link;
    this.mark.visible = !!link;
    if (!link) return;
    const page = this.pages[i];
    const margin = page.side === 'recto' ? PAGE.inner : PAGE.outer;
    const left = sideOf(i) < 0;
    const p = this.mark.geometry.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const a = (k % 17) / 16, top = k < 17; // PlaneGeometry(1, 1, 16, 1): the top row, then the bottom
      const X = margin + link.x0 + a * (link.x1 - link.x0);
      const u = X / PAGE.width; // across the canvas, from its left
      const x = left ? (u - 1) * PAGE_W : u * PAGE_W;
      const y = PAGE_H / 2 - ((top ? link.y0 : link.y1) / PAGE.height) * PAGE_H;
      p.setXYZ(k, x, y, rise(Math.abs(x) / PAGE_W) + 0.004);
    }
    p.needsUpdate = true;
    this.mark.geometry.computeBoundingSphere();
  }

  update(dt) {
    if (this._saveIn > 0 && (this._saveIn -= dt) <= 0) this.onSettings();
    if (!this.isOpen) return;
    if (this._grabbed) {
      this._m.multiplyMatrices(this._grabbed.matrixWorld, this._grabOffset);
      this._m.decompose(this.group.position, this.group.quaternion, this._s);
      this.group.updateMatrixWorld(true);
    }
    const t = this._turning;
    if (t) {
      t.t = this.reduceMotion ? 1 : Math.min(1, t.t + dt / TURN);
      const e = t.t * t.t * (3 - 2 * t.t);
      this._leafAt(t.side > 0 ? e : 1 - e);
      if (t.t >= 1) this._finishTurn();
    }
    if (this._slide !== this._slideTo) {
      const step = this.reduceMotion ? Infinity : (PAGE_W / SLIDE) * dt;
      const d = this._slideTo - this._slide;
      this._slide = Math.abs(d) <= step ? this._slideTo : this._slide + Math.sign(d) * step;
      this.inner.position.x = this._slide;
      this.group.updateMatrixWorld(true);
    }
    // A page at a time, once still, only its half of the book.
    const both = !this.single || !!this._turning || this._slide !== this._slideTo;
    this.leftHalf.visible = both || this.focus < 0;
    this.rightHalf.visible = both || this.focus > 0;
    this.toolbar.update();
    this.contents.update();
  }
}
