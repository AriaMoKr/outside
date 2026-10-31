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

/**
 * What is on a panel, as its type says: text, a button, a slider or a list. (The types are this
 * copy's; vrlbry's panel.js has none.)
 * @typedef {TextElement | ButtonElement | SliderElement | ListElement} PanelElement
 */
/**
 * Where an element is: x, y its top left and w × h, in its panel's canvas pixels; id, what get and
 * set find it by; hidden, neither drawn nor pointed at.
 * @typedef {{ id?: string, x: number, y: number, w: number, h: number, hidden?: boolean }} Box
 */
/**
 * What a pointer can use (a button, a slider or a list), unless it is disabled. pointerMove marks
 * where on it the pointer is: hoverRow a list's row, hoverValue a slider's value (null when not).
 * @typedef {ButtonElement | SliderElement | ListElement} Control
 */
/** A Box a pointer can use: a Control's fields. @typedef {Box & { disabled?: boolean, hoverRow?: number | null, hoverValue?: number | null }} Usable */
/**
 * Text in the lines that fit w (as many as fit h, or maxLines; the last with an ellipsis if it runs
 * over), size pixels high (34), from the top of h or in its middle.
 * @typedef {Box & { type: 'text', text: string, size?: number, weight?: string, serif?: boolean, color?: string, align?: CanvasTextAlign, valign?: 'middle', maxLines?: number }} TextElement
 */
/**
 * A button, its label on one line: lit while pointed at, drawn pressed while active; onClick(el)
 * when it is used.
 * @typedef {Usable & { type: 'button', label: string, size?: number, weight?: string, serif?: boolean, color?: string, radius?: number, active?: boolean, onClick?: (el: ButtonElement) => void }} ButtonElement
 */
/**
 * A slider, its value 0…1 from its left; used, it is set to the value there, and onClick(value, el).
 * @typedef {Usable & { type: 'slider', value?: number, onClick?: (value: number, el: SliderElement) => void }} SliderElement
 */
/**
 * A list, its items in rows rowH high (64), as many as fit h; what is used is an item.
 * @typedef {Usable & { type: 'list', items: ListItem[], rowH?: number, size?: number, serif?: boolean }} ListElement
 */
/**
 * A list's entry: its label, sub under it and right at the row's end; marked while active;
 * onClick(it) when it is used (unless disabled), or onClick() from a key.
 * @typedef {{ label: string, sub?: string, right?: string, weight?: string, active?: boolean, disabled?: boolean, onClick?: (it?: ListItem) => void }} ListItem
 */
/** How an element is drawn: Panel's method named _draw_ and its type (redraw finds it by name). @typedef {(g: CanvasRenderingContext2D, el: PanelElement) => void} Draw */

/**
 * A rectangle's path with its corners rounded (r, or less on a small one), to fill or stroke.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
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

/**
 * Text in lines that fit `width`; the last allowed line gets an ellipsis.
 * @param {CanvasRenderingContext2D} g
 * @param {string} text
 * @param {number} width
 * @param {number} [maxLines]
 */
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
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d')); // a new canvas always has one
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
    /** What is on it, drawn in this order. @type {PanelElement[]} */
    this.elements = [];
    /** What a pointer is on (pointerMove's), lit. @type {Control | null} */
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

  /**
   * Adds an element; returns it. Elements are drawn in the order they were added.
   * @param {PanelElement} el
   */
  add(el) {
    this.elements.push(el);
    this.markDirty();
    return el;
  }

  /** The element with this id, if there is one. @param {string} id */
  get(id) {
    return this.elements.find((e) => e.id === id);
  }

  /**
   * Changes fields of an element by id (redrawn only when one of them is new).
   * @param {string} id
   * @param {Record<string, unknown>} fields its fields' new values, by name
   */
  set(id, fields) {
    const el = this.get(id);
    if (!el) return el;
    for (const k in fields) {
      if (/** @type {Record<string, unknown>} */ (el)[k] !== fields[k]) {
        /** @type {Record<string, unknown>} */ (el)[k] = fields[k];
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
      const fn = /** @type {Draw | undefined} */ (this[`_draw_${el.type}`]); // the one for its type, so el is what it takes
      if (fn) fn.call(this, g, el);
    }
    this.texture.needsUpdate = true;
  }

  /**
   * An element's font, size pixels high: the serif face or the sans.
   * @param {{ serif?: boolean }} el
   * @param {number} size
   * @param {string} [weight]
   */
  _font(el, size, weight = '') {
    return `${weight} ${size}px ${el.serif ? SERIF : SANS}`.trim();
  }

  /**
   * @param {CanvasRenderingContext2D} g
   * @param {TextElement} el
   */
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

  /**
   * @param {CanvasRenderingContext2D} g
   * @param {ButtonElement} el
   */
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

  /**
   * @param {CanvasRenderingContext2D} g
   * @param {SliderElement} el
   */
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

  /**
   * @param {CanvasRenderingContext2D} g
   * @param {ListElement} el
   */
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

  /**
   * uv (0 to 1 from the bottom left) in the canvas's pixels; the same object each time.
   * @param {number} u
   * @param {number} v
   */
  _toPx(u, v) {
    this._p.x = u * this.w;
    this._p.y = (1 - v) * this.h;
    return this._p;
  }

  /**
   * The Control at p (in the canvas's pixels), disabled or not, the one added last on top; or null.
   * @param {{ x: number, y: number }} p
   * @returns {Control | null}
   */
  _hit(p) {
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (el.hidden || (el.type !== 'button' && el.type !== 'slider' && el.type !== 'list')) continue;
      if (p.x >= el.x && p.x <= el.x + el.w && p.y >= el.y && p.y <= el.y + el.h) return el;
    }
    return null;
  }

  /**
   * The element that can be used at (u, v), or null.
   * @param {number} u
   * @param {number} v
   * @returns {Control | null}
   */
  elementAt(u, v) {
    const el = this._hit(this._toPx(u, v));
    if (!el || el.disabled) return null;
    if (el.type === 'list') {
      const it = el.items?.[this._row(el, this._p)];
      return it && !it.disabled ? el : null;
    }
    return el;
  }

  /**
   * Which of a list's rows p (in the canvas's pixels) is in, from 0 at its top.
   * @param {ListElement} el
   * @param {{ x: number, y: number }} p
   */
  _row(el, p) {
    return Math.floor((p.y - el.y) / (el.rowH || 64));
  }

  /**
   * Hover feedback at (u, v); whether something usable is there.
   * @param {number} u
   * @param {number} v
   */
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

  /**
   * Uses the element at (u, v). Whether something did.
   * @param {number} u
   * @param {number} v
   */
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
