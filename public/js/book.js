// The book on the bench (reading.js, set in pages by pages.js). Closed, it lies on the seat beside
// where one sits: a green cloth hardback, its title in gold. Opened, it is held in front of the
// reader, a little below their eyes and turned up to them: two pages and the leaf that turns over
// between them, at its spine, when a page is pressed (or the arrow keys, or a stick). On a narrow
// screen (a phone held upright) one page at a time is shown, the book sliding across to the other.
// Pages are painted when they are first needed, and a few are kept.
import * as THREE from 'three';
import { BOOK } from './garden.js';
import { BOOK_SUBTITLE, BOOK_TITLE, COLOPHON, PIECES } from './reading.js';
import { PAGE, TEXT_WIDTH, TYPE, paginate, spreadCount, spreadPages } from './pages.js';
import { GOLD, SERIF, canvas } from './textures.js';

const PAGE_W = 0.15, PAGE_H = (PAGE_W * PAGE.height) / PAGE.width;
const PAPER = '#f4ecd9', INK = '#2b2219', CLOTH = '#2f4a37';
const TURN = 0.5; // seconds a page takes to turn
const SLIDE = 0.3; // to slide across, one page at a time

const font = (type) => `${TYPE[type].style} ${TYPE[type].size}px ${SERIF}`.trim();

/** A page's picture: paper, its text, its running head and number. */
function paintPage(page) {
  const c = canvas(PAGE.width, PAGE.height), g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, c.width, c.height);
  // A little shading toward the spine, which is on the left of a right-hand page.
  const toSpine = page && page.side === 'verso' ? 1 : 0;
  const grad = g.createLinearGradient(toSpine ? c.width : 0, 0, toSpine ? c.width - 140 : 140, 0);
  grad.addColorStop(0, 'rgba(90,70,40,0.22)');
  grad.addColorStop(1, 'rgba(90,70,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  if (!page) return c;
  const x0 = page.side === 'recto' ? PAGE.inner : PAGE.outer;
  g.fillStyle = INK;
  g.strokeStyle = INK;
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
    g.font = font(it.type);
    const spacing = TYPE[it.type].spacing ?? 0;
    if (spacing && 'letterSpacing' in g) g.letterSpacing = `${spacing}px`;
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
  g.fillStyle = 'rgba(43,34,25,0.7)';
  if (page.head) {
    g.font = font('head');
    g.textAlign = 'center';
    g.fillText(page.side === 'verso' ? BOOK_TITLE : page.head, x0 + TEXT_WIDTH / 2, PAGE.top - 74);
  }
  if (page.folio) {
    g.font = font('folio');
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

export class Book {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {{ x: number, y: number, z: number, yaw: number }} o.place where it lies closed (garden.js layout's book)
   * @param {(p: number[], n: number[]) => THREE.Color} o.light the light at a point
   */
  constructor({ scene, place, anisotropy = 1, light }) {
    this.anisotropy = anisotropy;
    this.pages = null; // set when it is first opened (setting it takes a few tens of milliseconds)
    this.spreads = 0;
    this.spread = 0;
    this.focus = 1; // on a narrow screen, the page shown: -1 left, 1 right
    this.single = false;
    this.isOpen = false;
    this._cache = new Map(); // page index → texture
    this._turning = null; // { t, dir, from, to }
    this._slide = 0; // the open book's offset, while sliding
    this._slideTo = 0;
    this._pick = { t: 0, side: 0 };
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
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

    // Open: boards, the pages, and the leaf that turns.
    this.group = new THREE.Group();
    this.group.name = 'book (open)';
    this.group.visible = false;
    this.inner = new THREE.Group(); // slides, on a narrow screen
    this.group.add(this.inner);
    const paper = () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const boards = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 2 + 0.012, PAGE_H + 0.012, 0.004), new THREE.MeshBasicMaterial({ color: CLOTH }));
    boards.position.z = -0.004;
    // The pages under the open ones, between them and the boards (its face just behind theirs).
    const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 2 - 0.004, PAGE_H - 0.002, 0.006), new THREE.MeshBasicMaterial({ color: '#e9dcc0' }));
    block.position.z = -0.0035;
    this.left = new THREE.Mesh(pageGeometry(-1), paper());
    this.right = new THREE.Mesh(pageGeometry(1), paper());
    this.leaf = new THREE.Group();
    this.leafFront = new THREE.Mesh(leafGeometry(false), paper());
    this.leafBack = new THREE.Mesh(leafGeometry(true), paper());
    this.leaf.add(this.leafFront, this.leafBack);
    this.leaf.visible = false;
    this.inner.add(boards, block, this.left, this.right, this.leaf);
    scene.add(this.group);
  }

  /** Sets it in pages, the first time it is needed. */
  _set() {
    if (this.pages) return;
    const g = canvas(8, 8).getContext('2d');
    this.pages = paginate({ title: BOOK_TITLE, subtitle: BOOK_SUBTITLE, pieces: PIECES, colophon: COLOPHON }, (text, type) => {
      g.font = font(type);
      return g.measureText(text).width + (TYPE[type].spacing ?? 0) * text.length;
    });
    this.spreads = spreadCount(this.pages);
  }

  /** The texture of page i (painted the first time), or of a blank one for null. */
  _page(i) {
    const key = i ?? -1;
    if (!this._cache.has(key)) {
      this._cache.set(key, tex(paintPage(i === null ? null : this.pages[i]), this.anisotropy));
      // Keep a few: the spreads either side of this one.
      if (this._cache.size > 10) {
        for (const [k, t] of this._cache) {
          if (k === -1 || Math.abs(k - 2 * this.spread) <= 4) continue;
          t.dispose();
          this._cache.delete(k);
          if (this._cache.size <= 8) break;
        }
      }
    }
    return this._cache.get(key);
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

  /**
   * Opens it in front of the camera: at reading distance a little below the eyes, turned up to
   * them. On a screen it is as near as fills most of the view; on a narrow one, a page at a time.
   */
  open(camera, { xr = false, aspect = 1, fov = 70 } = {}) {
    this._set();
    this.isOpen = true;
    this.closed.visible = false;
    this.group.visible = true;
    this.single = !xr && aspect < 0.9;
    camera.getWorldPosition(this._o);
    camera.getWorldDirection(this._d);
    const yaw = Math.atan2(-this._d.x, -this._d.z);
    const down = xr ? 0.5 : 0.36; // radians below level: held low, looked down at
    const scale = xr ? 1.35 : 1;
    let distance;
    if (xr) distance = 0.42;
    else {
      const v = THREE.MathUtils.degToRad(fov) / 2, h = Math.atan(Math.tan(v) * aspect);
      const width = (this.single ? PAGE_W : PAGE_W * 2 + 0.012) * scale;
      distance = Math.max(width / 2 / Math.tan(h) / 0.9, (PAGE_H * scale) / 2 / Math.tan(v) / 0.86);
    }
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(down), -Math.sin(down), -Math.cos(yaw) * Math.cos(down));
    this.group.position.copy(this._o).addScaledVector(dir, distance);
    this.group.scale.setScalar(scale);
    // Facing back up that line to the eyes: its face (+z) turned toward them, its top away.
    this.group.rotation.set(-down, yaw, 0, 'YXZ');
    this._slide = this._slideTo = this.single ? -this.focus * (PAGE_W / 2) : 0;
    this.inner.position.x = this._slide;
    this.group.updateMatrixWorld(true);
    this._inverse.copy(this.group.matrixWorld).invert();
    this._show();
    return { pitch: -down };
  }

  close() {
    this.isOpen = false;
    this.group.visible = false;
    this.closed.visible = true;
    this._finishTurn();
  }

  /** On a page (side -1) or back one (side -1). */
  turn(side) {
    if (!this.isOpen) return;
    if (this._turning) this._finishTurn();
    if (this.single) {
      // A page at a time: across the spread, then over the leaf.
      if (side > 0 && this.focus < 0) return this._focus(1);
      if (side < 0 && this.focus > 0 && this.spread > 0) return this._focus(-1);
    }
    const to = this.spread + side;
    if (to < 0 || to >= this.spreads) return;
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
    if (this.single) this._focus(side > 0 ? -1 : 1);
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

  update(dt) {
    if (!this.isOpen) return;
    const t = this._turning;
    if (t) {
      t.t = Math.min(1, t.t + dt / TURN);
      const e = t.t * t.t * (3 - 2 * t.t);
      this._leafAt(t.side > 0 ? e : 1 - e);
      if (t.t >= 1) this._finishTurn();
    }
    if (this._slide !== this._slideTo) {
      const step = (PAGE_W / SLIDE) * dt;
      const d = this._slideTo - this._slide;
      this._slide = Math.abs(d) <= step ? this._slideTo : this._slide + Math.sign(d) * step;
      this.inner.position.x = this._slide;
      this.group.updateMatrixWorld(true);
    }
  }

  /**
   * A ray (world space) at the open book: { t, side } (-1 the left page, 1 the right, as one
   * turns back or on), or null. On a narrow screen, the page shown: its left half back, right on.
   */
  pick(ox, oy, oz, dx, dy, dz) {
    if (!this.isOpen) return null;
    this._inverse.copy(this.group.matrixWorld).invert();
    const o = this._o.set(ox, oy, oz).applyMatrix4(this._inverse);
    const d = this._d.set(dx, dy, dz).transformDirection(this._inverse);
    if (Math.abs(d.z) < 1e-6) return null;
    const s = (0.006 - o.z) / d.z;
    if (s <= 0) return null;
    const x = o.x + d.x * s - this._slide, y = o.y + d.y * s;
    if (Math.abs(y) > PAGE_H / 2 + 0.01 || Math.abs(x) > PAGE_W + 0.01) return null;
    if (this.single) {
      const centre = this.focus * (PAGE_W / 2);
      if (Math.abs(x - centre) > PAGE_W / 2 + 0.01) return null;
      this._pick.side = x < centre ? -1 : 1;
    } else this._pick.side = x < 0 ? -1 : 1;
    // Back in world units: the group may be scaled.
    this._pick.t = s * this.group.scale.x;
    return this._pick;
  }
}
