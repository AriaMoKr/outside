// Canvas-texture panels: buttons, text, sliders and lists drawn onto a canvas that textures a
// plane, hit by the uv where a ray meets it, so the same panel works with a mouse, a finger, a
// gamepad's dot and a VR controller. This is vrlbry's public/js/ui/panel.js (its Panel), cut to
// what the open book's toolbar and contents use: no pictures, and a list without scroll bars (the
// contents fits). It is redrawn only when something on it changes, never per frame, and a ray
// over it allocates nothing.
import * as THREE from 'three';
import { SANS, SERIF } from './textures.js';

export const UI = {
  text: '#f1e6d0',
  muted: '#b6a487',
  accent: '#d9b26a',
  button: '#3a2e22',
  buttonHover: '#5b4630',
  buttonActive: '#8f6c34',
  border: 'rgba(217,178,106,0.45)',
};

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** Text in lines that fit `width`; the last allowed line gets an ellipsis. */
function wrapText(g, text, width, maxLines = Infinity) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (g.measureText(t).width <= width || !cur) cur = t;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return out;
}

export class Panel {
  /**
   * @param {object} o
   * @param {number} o.width its size where it is put (the open book's units)
   * @param {number} o.height
   * @param {number} o.px its canvas's width, in pixels (its height in proportion)
   * @param {string} [o.background] behind what is on it, a CSS colour
   * @param {number} [o.radius] its corners', in canvas pixels
   * @param {number} [o.anisotropy] its texture's anisotropic filtering
   */
  constructor({ width, height, px, background = 'rgba(25,20,16,0.93)', radius = 28, anisotropy = 4 }) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(px);
    this.canvas.height = Math.round((px * height) / width);
    this.ctx = this.canvas.getContext('2d');
    this.background = background;
    this.radius = radius;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    // forceSinglePass (vrlbry's finding): three draws a transparent double-sided material in two
    // passes, rebuilding its program parameters around each every frame; one pass looks the same.
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.mesh.userData.panel = this;
    this.mesh.renderOrder = 10;
    this.elements = [];
    this.hover = null;
    this.dirty = true;
    this._p = { x: 0, y: 0 };
  }

  get w() { return this.canvas.width; }
  get h() { return this.canvas.height; }

  get visible() { return this.mesh.visible; }
  set visible(v) {
    this.mesh.visible = v;
    if (!v) this.pointerLeave();
  }

  clear() {
    this.elements = [];
    this.hover = null;
    this.markDirty();
  }

  /** Adds an element; returns it. Elements are drawn in the order they were added. */
  add(el) {
    this.elements.push(el);
    this.markDirty();
    return el;
  }

  get(id) {
    return this.elements.find((e) => e.id === id);
  }

  /** Changes fields of an element by id (redrawn only when one of them is new). */
  set(id, fields) {
    const el = this.get(id);
    if (!el) return el;
    for (const k in fields) {
      if (el[k] !== fields[k]) {
        el[k] = fields[k];
        this.markDirty();
      }
    }
    return el;
  }

  markDirty() {
    this.dirty = true;
  }

  /** Repaints if anything changed. Once a frame (nothing done when nothing did). */
  update() {
    if (this.dirty) this.redraw();
  }

  redraw() {
    this.dirty = false;
    const g = this.ctx;
    g.clearRect(0, 0, this.w, this.h);
    if (this.background) {
      roundRect(g, 2, 2, this.w - 4, this.h - 4, this.radius);
      g.fillStyle = this.background;
      g.fill();
      g.strokeStyle = UI.border;
      g.lineWidth = 3;
      g.stroke();
    }
    for (const el of this.elements) {
      if (el.hidden) continue;
      const fn = this[`_draw_${el.type}`];
      if (fn) fn.call(this, g, el);
    }
    this.texture.needsUpdate = true;
  }

  _font(el, size, weight = '') {
    return `${weight} ${size}px ${el.serif ? SERIF : SANS}`.trim();
  }

  _draw_text(g, el) {
    const size = el.size || 34;
    g.font = this._font(el, size, el.weight || '');
    g.fillStyle = el.color || UI.text;
    g.textBaseline = 'top';
    g.textAlign = el.align || 'left';
    const lines = wrapText(g, el.text, el.w, el.maxLines ?? Math.max(1, Math.floor(el.h / (size * 1.25))));
    const lh = size * 1.25;
    let y = el.y;
    if (el.valign === 'middle') y = el.y + (el.h - lines.length * lh) / 2;
    const x = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
    for (const line of lines) {
      g.fillText(line, x, y);
      y += lh;
    }
  }

  _draw_button(g, el) {
    const hover = this.hover === el && !el.disabled;
    roundRect(g, el.x, el.y, el.w, el.h, el.radius ?? 16);
    g.fillStyle = el.disabled ? 'rgba(80,70,60,0.5)' : el.active ? UI.buttonActive : hover ? UI.buttonHover : (el.color || UI.button);
    g.fill();
    if (hover || el.active) {
      g.strokeStyle = UI.accent;
      g.lineWidth = 3;
      g.stroke();
    }
    const size = el.size || Math.min(40, el.h * 0.45);
    g.font = this._font(el, size, el.weight || '600');
    g.fillStyle = el.disabled ? '#857868' : UI.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(wrapText(g, el.label, el.w - 16, 1)[0], el.x + el.w / 2, el.y + el.h / 2 + 1);
  }

  _draw_slider(g, el) {
    const v = Math.max(0, Math.min(1, el.value || 0));
    const hover = this.hover === el;
    const barH = Math.max(8, el.h * 0.22);
    const y = el.y + (el.h - barH) / 2;
    roundRect(g, el.x, y, el.w, barH, barH / 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fill();
    roundRect(g, el.x, y, Math.max(barH, el.w * v), barH, barH / 2);
    g.fillStyle = UI.accent;
    g.fill();
    g.beginPath();
    g.arc(el.x + el.w * v, el.y + el.h / 2, hover ? barH * 1.3 : barH, 0, Math.PI * 2);
    g.fillStyle = '#f6e7c4';
    g.fill();
    if (hover && el.hoverValue != null) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(el.x + el.w * el.hoverValue - 1, el.y, 2, el.h);
    }
  }

  _draw_list(g, el) {
    const rowH = el.rowH || 64;
    const items = el.items || [];
    for (let i = 0; i < items.length && (i + 1) * rowH <= el.h; i++) {
      const it = items[i];
      const y = el.y + i * rowH;
      const hover = this.hover === el && el.hoverRow === i;
      if (hover || it.active) {
        roundRect(g, el.x, y + 2, el.w - 8, rowH - 4, 10);
        g.fillStyle = it.active ? 'rgba(143,108,52,0.55)' : 'rgba(255,255,255,0.10)';
        g.fill();
      }
      if (hover) {
        g.strokeStyle = UI.accent;
        g.lineWidth = 2;
        g.stroke();
      }
      const size = el.size || Math.min(32, rowH * 0.42);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.font = this._font(el, size, it.weight || '');
      g.fillStyle = UI.text;
      const textW = el.w - 28 - (it.right ? 90 : 0);
      if (it.sub) {
        g.fillText(wrapText(g, it.label, textW, 1)[0], el.x + 14, y + rowH * 0.36);
        g.font = this._font({}, size * 0.66);
        g.fillStyle = UI.muted;
        g.fillText(wrapText(g, it.sub, textW, 1)[0], el.x + 14, y + rowH * 0.72);
      } else {
        g.fillText(wrapText(g, it.label, textW, 1)[0], el.x + 14, y + rowH / 2);
      }
      if (it.right) {
        g.font = this._font(el, size * 0.8);
        g.fillStyle = UI.muted;
        g.textAlign = 'right';
        g.fillText(it.right, el.x + el.w - 18, y + rowH * (it.sub ? 0.36 : 0.5));
      }
    }
  }

  /** uv (0 to 1 from the bottom left) in the canvas's pixels; the same object each time. */
  _toPx(u, v) {
    this._p.x = u * this.w;
    this._p.y = (1 - v) * this.h;
    return this._p;
  }

  _hit(p) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.hidden || (el.type !== 'button' && el.type !== 'slider' && el.type !== 'list')) continue;
      if (p.x >= el.x && p.x <= el.x + el.w && p.y >= el.y && p.y <= el.y + el.h) return el;
    }
    return null;
  }

  /** The element that can be used at (u, v), or null. */
  elementAt(u, v) {
    const el = this._hit(this._toPx(u, v));
    if (!el || el.disabled) return null;
    if (el.type === 'list') {
      const it = el.items?.[this._row(el, this._p)];
      return it && !it.disabled ? el : null;
    }
    return el;
  }

  _row(el, p) {
    return Math.floor((p.y - el.y) / (el.rowH || 64));
  }

  /** Hover feedback at (u, v); whether something usable is there. */
  pointerMove(u, v) {
    const p = this._toPx(u, v);
    const el = this._hit(p);
    const row = el?.type === 'list' ? this._row(el, p) : null;
    const hv = el?.type === 'slider' ? Math.max(0, Math.min(1, (p.x - el.x) / el.w)) : null;
    if (el !== this.hover || (el && (el.hoverRow !== row || el.hoverValue !== hv))) {
      if (this.hover && this.hover !== el) {
        this.hover.hoverRow = null;
        this.hover.hoverValue = null;
      }
      this.hover = el;
      if (el) {
        el.hoverRow = row;
        el.hoverValue = hv;
      }
      this.markDirty();
    }
    return !!el && !el.disabled;
  }

  pointerLeave() {
    if (this.hover) {
      this.hover.hoverRow = null;
      this.hover.hoverValue = null;
      this.hover = null;
      this.markDirty();
    }
  }

  /** Uses the element at (u, v). Whether something did. */
  click(u, v) {
    const p = this._toPx(u, v);
    const el = this._hit(p);
    if (!el || el.disabled) return false;
    if (el.type === 'button') el.onClick?.(el);
    else if (el.type === 'slider') {
      const value = Math.max(0, Math.min(1, (p.x - el.x) / el.w));
      el.value = value;
      this.markDirty();
      el.onClick?.(value, el);
    } else if (el.type === 'list') {
      const it = el.items?.[this._row(el, p)];
      if (!it || it.disabled) return false;
      it.onClick?.(it);
    }
    return true;
  }
}
