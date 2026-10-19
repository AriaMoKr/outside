// Canvas textures painted at start-up: the ground (grass, the trail's gravel, the banks' mud),
// leaves, the house's bricks and window glass, the signs in the hallway's enamel, and a doorway's
// picture until the real one arrives. Seeded, so the garden looks the same on every visit; the
// repeating ones wrap without a seam.
import * as THREE from 'three';

export const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
export const GOLD = '#e0bb72';
const ENAMEL = '#14231f';

let anisotropy = 1;
export function setAnisotropy(n) {
  anisotropy = n;
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A seeded random number generator (mulberry32), as the hallway's. */
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function texture(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/** Draws something near the edge of a repeating canvas again on the other side, so it wraps. */
function wrapped(W, H, x, y, reach, draw) {
  for (const ox of [-W, 0, W]) {
    for (const oy of [-H, 0, H]) {
      if (x + ox < -reach || x + ox > W + reach || y + oy < -reach || y + oy > H + reach) continue;
      draw(x + ox, y + oy);
    }
  }
}

/** Soft blotches, wrapping. */
function clouds(g, r, W, H, count, rgb, alpha, size) {
  for (let k = 0; k < count; k++) {
    const x = r() * W, y = r() * H, rad = size * (0.3 + r()), a = alpha * (0.5 + r());
    wrapped(W, H, x, y, rad, (cx, cy) => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `rgba(${rgb},${a})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    });
  }
}

/** Small stones, lit from the top left, wrapping. */
function pebbles(g, r, W, H, count, size, tones) {
  for (let k = 0; k < count; k++) {
    const x = r() * W, y = r() * H, rx = size * (0.4 + r()), ry = rx * (0.55 + 0.4 * r()), rot = r() * Math.PI;
    const tone = tones[Math.floor(r() * tones.length)];
    wrapped(W, H, x, y, rx * 2, (cx, cy) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath();
      g.ellipse(rx * 0.25, ry * 0.3, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      const grad = g.createRadialGradient(-rx * 0.35, -ry * 0.4, 0, 0, 0, rx * 1.2);
      grad.addColorStop(0, tone[0]);
      grad.addColorStop(1, tone[1]);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
  }
}

/** The lawn: short blades and the odd clover leaf and dry stem, seen from above. 2.2 m square, repeating. */
export function grassTexture() {
  const S = 1024;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(31);
  g.fillStyle = '#4c7a2c';
  g.fillRect(0, 0, S, S);
  clouds(g, r, S, S, 40, '34,66,20', 0.25, 160);
  clouds(g, r, S, S, 30, '120,150,60', 0.16, 120);
  const greens = ['#3a6522', '#4a7c2a', '#5b8e34', '#6d9f3c', '#7fb046', '#4f8a31', '#93b257', '#a8a95c'];
  for (let k = 0; k < 26000; k++) {
    const x = r() * S, y = r() * S, len = 5 + r() * 12, a = r() * Math.PI * 2;
    const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
    g.strokeStyle = greens[Math.floor(r() * greens.length)];
    g.globalAlpha = 0.55 + 0.45 * r();
    g.lineWidth = 1 + r() * 1.6;
    wrapped(S, S, x, y, len, (px, py) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + ex, py + ey);
      g.stroke();
    });
  }
  // Clover: three round leaves.
  for (let k = 0; k < 160; k++) {
    const x = r() * S, y = r() * S, s = 3 + r() * 3;
    g.globalAlpha = 0.8;
    g.fillStyle = r() < 0.5 ? '#3f6f25' : '#5a8f35';
    wrapped(S, S, x, y, s * 3, (px, py) => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + k;
        g.beginPath();
        g.arc(px + Math.cos(a) * s, py + Math.sin(a) * s, s, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
  g.globalAlpha = 1;
  return texture(c, { repeat: true });
}

/** The trail: packed earth and fine gravel. 1.6 m square, repeating. */
export function pathTexture() {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(41);
  g.fillStyle = '#a08867';
  g.fillRect(0, 0, S, S);
  clouds(g, r, S, S, 50, '120,96,66', 0.28, 70);
  clouds(g, r, S, S, 40, '196,176,140', 0.2, 50);
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '70,54,36' : '210,192,160'},${0.25 * r()})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  pebbles(g, r, S, S, 700, 3.2, [['#d8cdb8', '#8f8170'], ['#c2b49b', '#7a6b58'], ['#b8b0a6', '#6f6a64'], ['#cfb79a', '#8c7257']]);
  return texture(c, { repeat: true });
}

/** The banks: wet dark earth, a few stones and a green film. 1.4 m square, repeating. */
export function mudTexture() {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(43);
  g.fillStyle = '#54432f';
  g.fillRect(0, 0, S, S);
  clouds(g, r, S, S, 50, '34,26,18', 0.35, 80);
  clouds(g, r, S, S, 30, '84,96,48', 0.22, 70);
  for (let k = 0; k < 5000; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '20,14,8' : '140,120,90'},${0.25 * r()})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  pebbles(g, r, S, S, 140, 4, [['#9a9286', '#4f4a44'], ['#8a7c68', '#4a3f32']]);
  return texture(c, { repeat: true });
}

/**
 * Leaves for crowns and hedges, in greys: each tree's own colour comes from its vertices, so the
 * same picture serves an oak, a birch and blossom. 1 m square, repeating.
 */
export function leafTexture() {
  const S = 512;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(53);
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, S, S);
  clouds(g, r, S, S, 30, '50,50,50', 0.3, 70);
  for (let k = 0; k < 2600; k++) {
    const x = r() * S, y = r() * S, len = 7 + r() * 9, wid = len * (0.35 + 0.2 * r()), a = r() * Math.PI * 2;
    const v = Math.floor(140 + r() * 115);
    wrapped(S, S, x, y, len, (px, py) => {
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(0,0,0,0.25)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-len * 0.9, 0);
      g.lineTo(len * 0.9, 0);
      g.stroke();
      g.restore();
    });
  }
  return texture(c, { repeat: true });
}

/** The house: red-brown bricks in stretcher bond, 0.225 × 0.075 m with their mortar; 2.025 m square, repeating. */
export const BRICK_TILE = 2.025;
export function brickTexture() {
  const S = 1024, courses = 27, perCourse = 9;
  const ch = S / courses, bw = S / perCourse, m = 4;
  const c = canvas(S, S), g = c.getContext('2d'), r = rng(61);
  g.fillStyle = '#b9a88e';
  g.fillRect(0, 0, S, S);
  for (let k = 0; k < 6000; k++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '80,70,60' : '230,220,200'},${0.3 * r()})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  const tones = ['#93452f', '#8a3f2b', '#a3553a', '#7d3a27', '#9d4b33', '#b0613f', '#6f3324', '#a14a30', '#8e4a36'];
  /** One brick at x0, painted from its own seed (so the one cut by the right edge goes on at the left). */
  const brick = (x0, y0, seed) => {
    const b = rng(seed);
    g.fillStyle = tones[Math.floor(b() * tones.length)];
    g.fillRect(x0 + m / 2, y0 + m / 2, bw - m, ch - m);
    // A brick's own variety: a little light along its top, a darker bottom edge, speckle, soot.
    const grad = g.createLinearGradient(0, y0, 0, y0 + ch);
    grad.addColorStop(0, 'rgba(255,220,190,0.16)');
    grad.addColorStop(0.3, 'rgba(255,220,190,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad;
    g.fillRect(x0 + m / 2, y0 + m / 2, bw - m, ch - m);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(${b() < 0.5 ? '40,16,8' : '220,150,110'},${0.25 * b()})`;
      g.fillRect(x0 + m / 2 + b() * (bw - m - 2), y0 + m / 2 + b() * (ch - m - 2), 1 + b() * 2, 1 + b() * 2);
    }
    if (b() < 0.12) {
      g.fillStyle = 'rgba(30,20,16,0.25)';
      g.fillRect(x0 + m / 2, y0 + m / 2, bw - m, ch - m);
    }
  };
  for (let row = 0; row < courses; row++) {
    const y0 = row * ch, shift = row % 2 ? bw / 2 : 0;
    for (let i = 0; i < perCourse; i++) {
      const x0 = i * bw + shift, seed = 1000 + row * 31 + i;
      brick(x0, y0, seed);
      if (x0 + bw > S) brick(x0 - S, y0, seed);
    }
  }
  return texture(c, { repeat: true });
}

/**
 * Window glass: the dim hall inside, warm with a lamp, and the sky caught on the glass. One pane
 * of a sash (0…1 across it), drawn for a whole window; the bars are geometry.
 */
export function windowTexture() {
  const W = 256, H = 512;
  const c = canvas(W, H), g = c.getContext('2d'), r = rng(71);
  const room = g.createLinearGradient(0, 0, 0, H);
  room.addColorStop(0, '#3b2a1c');
  room.addColorStop(0.55, '#24170f');
  room.addColorStop(1, '#170f0a');
  g.fillStyle = room;
  g.fillRect(0, 0, W, H);
  // A lamp's glow, high up, and the line of the wainscot's rail.
  const lamp = g.createRadialGradient(W * (0.3 + 0.4 * r()), H * 0.18, 4, W * 0.5, H * 0.2, W * 0.9);
  lamp.addColorStop(0, 'rgba(255,224,170,0.95)');
  lamp.addColorStop(0.15, 'rgba(255,196,120,0.5)');
  lamp.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = lamp;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(120,80,50,0.35)';
  g.fillRect(0, H * 0.66, W, 6);
  // The sky on the glass: pale above, the warm west lower down, and a sheen across.
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, 'rgba(170,196,230,0.32)');
  sky.addColorStop(0.6, 'rgba(240,200,150,0.18)');
  sky.addColorStop(1, 'rgba(120,130,110,0.25)');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.5);
  const sheen = g.createLinearGradient(-W, 0, W, 0);
  sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,250,235,0.16)');
  sheen.addColorStop(0.58, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(-W, -H, W * 2, H * 2);
  g.restore();
  return texture(c);
}

// ── Signs, in the hallway's look ─────────────────────────────────────────────

/** Lines of text no wider than maxWidth, at most maxLines (the last cut short with an ellipsis). */
export function wrapText(g, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && g.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** The largest font (from size down) at which text fits maxWidth. */
export function fit(g, text, maxWidth, size, style) {
  for (; size > 10; size -= 2) {
    g.font = `${style} ${size}px ${SERIF}`;
    if (g.measureText(text).width <= maxWidth) break;
  }
  return size;
}

/** A sign's ground: a wooden edge, dark green enamel and a gold line. */
export function enamel(g, w, h, inset) {
  g.fillStyle = '#2b1b10';
  g.fillRect(0, 0, w, h);
  const e = g.createLinearGradient(0, 0, 0, h);
  e.addColorStop(0, '#1b2e28');
  e.addColorStop(1, ENAMEL);
  g.fillStyle = e;
  g.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.strokeRect(inset + 8, inset + 8, w - (inset + 8) * 2, h - (inset + 8) * 2);
}

/** The plaque beside the door: where it leads, and a line about it. 0.60 × 0.34 m. */
export function plaqueTexture(title, subtitle) {
  const W = 512, H = 290;
  const c = canvas(W, H), g = c.getContext('2d');
  enamel(g, W, H, 12);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = GOLD;
  fit(g, title, W - 90, 84, '600');
  g.fillText(title, W / 2, 124);
  g.fillStyle = 'rgba(224,187,114,0.6)';
  g.fillRect(W / 2 - 60, 148, 120, 2);
  g.fillStyle = '#efe5cf';
  g.font = `28px ${SANS}`;
  const lines = wrapText(g, subtitle, W - 90, 2);
  lines.forEach((l, i) => g.fillText(l, W / 2, 196 + i * 34 - (lines.length - 1) * 10));
  return texture(c);
}

/** The sign over the door. 0.84 × 0.27 m. */
export function signTexture(text) {
  const W = 640, H = 206;
  const c = canvas(W, H), g = c.getContext('2d');
  enamel(g, W, H, 9);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = GOLD;
  fit(g, text, W - 80, 104, '600');
  g.fillText(text, W / 2, H / 2 + 5);
  return texture(c);
}

/** What the doorway shows until the view through it arrives, or for good when there is none: its glow and its name. 2:1. */
export function previewFallback(name, color) {
  const W = 1024, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.6);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#050403');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,248,235,0.9)';
  // A doorway shows only the middle of the picture, less from further off: the name fits there.
  fit(g, name, W * 0.13, 64, '600');
  g.fillText(name, W / 2, H * 0.5);
  return texture(c);
}
