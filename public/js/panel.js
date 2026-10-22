// The control panel on the house's wall beside the door (garden.js PANEL), as the hallway has it:
// Enter / Exit VR, how to move and turn in VR, and the shared session (together.js): Start / Leave,
// who else is in it, and its invite link to read out. Its canvas is redrawn only when what it
// shows changes (a setting, a session, the button pointed at, someone coming or going), never per
// frame.
import * as THREE from 'three';
import { PANEL, PANEL_PX, PANEL_BUTTONS } from './garden.js';
import { GOLD, SANS, SERIF, enamel } from './textures.js';

const LABELS = { 'move:teleport': 'Teleport', 'move:smooth': 'Smooth', 'turn:snap': 'Snap', 'turn:smooth': 'Smooth' };
const VR_LABELS = { exit: 'Exit VR', enter: 'Enter VR', none: 'No VR in this browser' };
const HINTS = {
  teleport: 'Left stick forward, aim, let go: teleport',
  smooth: 'Left stick: walk · trigger at the floor: teleport',
};
const SESSION_LABELS = { on: 'Leave shared session', off: 'Start shared session' };
const KEYS = ['vr', 'move', 'turn', 'room', 'link', 'here', 'away'];

/** Who else is in the session, in a few words. */
export function companyText(here, away) {
  if (!here && !away) return 'Nobody else yet';
  const parts = [];
  if (here) parts.push(`${here} here`);
  if (away) parts.push(`${away} elsewhere`);
  return parts.join(' · ');
}

export class ControlPanel {
  /** @param {{ color: THREE.Color, anisotropy?: number }} o */
  constructor({ color, anisotropy = 1 }) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PANEL_PX.width;
    this.canvas.height = PANEL_PX.height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL.width, PANEL.height), new THREE.MeshBasicMaterial({ map: this.texture, color }));
    this.mesh.name = 'control panel';
    // On the wall (z = 0), facing the garden (-z).
    this.mesh.position.set(PANEL.x, PANEL.y, -PANEL.depth);
    this.mesh.rotation.y = Math.PI;
    this.state = { vr: 'none', move: 'smooth', turn: 'snap', room: null, link: '', here: 0, away: 0 };
    this.hover = null;
    this._draw();
  }

  /**
   * What it shows, all or part of it: vr is 'exit' (in VR), 'enter' (VR available) or 'none'; move
   * and turn as in common/nav.js; room is the shared session's (null when not in one), link its
   * invite link, here and away how many others are in the hallway and elsewhere in it.
   */
  set(state) {
    const next = { ...this.state, ...state };
    if (KEYS.every((k) => next[k] === this.state[k])) return;
    this.state = next;
    this._draw();
  }

  /** The button pointed at, or null. */
  setHover(id) {
    if (id === this.hover) return;
    this.hover = id;
    this._draw();
  }

  _draw() {
    const g = this.ctx, W = PANEL_PX.width, H = PANEL_PX.height;
    enamel(g, W, H, 10);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = GOLD;
    g.font = `600 30px ${SERIF}`;
    g.fillText('Controls', 32, 58);
    g.fillStyle = '#b9a98d';
    g.font = `24px ${SANS}`;
    g.textBaseline = 'middle';
    g.fillText('Move', 34, 189);
    g.fillText('Turn', 34, 265);
    for (const [id, x0, y0, x1, y1] of PANEL_BUTTONS) {
      let label, selected = false, disabled = false;
      if (id === 'vr') {
        label = VR_LABELS[this.state.vr];
        disabled = this.state.vr === 'none';
      } else if (id === 'session') {
        label = SESSION_LABELS[this.state.room ? 'on' : 'off'];
      } else {
        const [group, value] = id.split(':');
        label = LABELS[id];
        selected = this.state[group] === value;
      }
      const hover = this.hover === id && !disabled;
      g.beginPath();
      g.roundRect(x0, y0, x1 - x0, y1 - y0, 12);
      g.fillStyle = selected ? (hover ? '#f0cf8a' : GOLD) : hover ? 'rgba(224,187,114,0.32)' : 'rgba(255,255,255,0.06)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = disabled ? 'rgba(224,187,114,0.3)' : GOLD;
      g.stroke();
      g.fillStyle = selected ? '#1a1208' : disabled ? 'rgba(239,229,207,0.45)' : '#efe5cf';
      g.font = `600 ${id === 'vr' && disabled ? 22 : 26}px ${SANS}`;
      g.textAlign = 'center';
      g.fillText(label, (x0 + x1) / 2, (y0 + y1) / 2 + 1);
    }
    g.fillStyle = '#b9a98d';
    g.font = `18px ${SANS}`;
    g.textAlign = 'center';
    g.fillText(HINTS[this.state.move], W / 2, 330);

    // The shared session.
    g.fillStyle = 'rgba(224,187,114,0.35)';
    g.fillRect(32, 354, W - 64, 2);
    g.textAlign = 'left';
    g.fillStyle = GOLD;
    g.font = `600 26px ${SERIF}`;
    g.fillText('Together', 32, 384);
    if (this.state.room) {
      g.textAlign = 'right';
      g.fillStyle = '#efe5cf';
      g.font = `20px ${SANS}`;
      g.fillText(companyText(this.state.here, this.state.away), W - 32, 385);
    }
    g.textAlign = 'center';
    g.fillStyle = '#b9a98d';
    const note = this.state.room ? this.state.link : 'Start one, share its link, and see each other here';
    fitText(g, note, W - 64, 18);
    g.fillText(note, W / 2, 486);
    this.texture.needsUpdate = true;
  }
}

/** Sets the largest font, from `size` px down, at which `text` fits `width`. */
function fitText(g, text, width, size) {
  for (let s = size; s >= 12; s--) {
    g.font = `${s}px ${SANS}`;
    if (g.measureText(text).width <= width) return;
  }
}
