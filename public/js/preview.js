// The picture the hallway's doorway to here shows (its README, "Adding a door": a preview, 2:1,
// "the room seen through the doorway", taken at eye height looking straight ahead, its horizon a
// little above the middle). It is the garden as one sees it coming out of the door: from where
// the visitor arrives (garden.js layout's spawn), at eye height, facing straight out, projected
// onto a picture hung as the hallway hangs its doorways' pictures (its hall.js PICTURE: 2.4 m
// behind the opening, 3 m high, the horizon at eye height and 56 % up), so through the doorway it
// looks like the garden with some parallax. tools/preview.mjs writes it to public/hallway-preview.jpg.
import * as THREE from 'three';

export const PREVIEW = { width: 2048, height: 1024, depth: 2.4, pictureHeight: 3.0, eye: 1.6, horizon: 0.56 };

/** Where the picture is taken from and how wide it looks (the frustum at 1 m), and how it is hung. Pure. */
export function previewView(p = PREVIEW, from = { x: 0, y: 0, z: -0.6 }) {
  const half = (p.pictureHeight * (p.width / p.height)) / 2;
  return {
    eye: { x: from.x, y: from.y + p.eye, z: from.z },
    frustum: { left: -half / p.depth, right: half / p.depth, top: (p.pictureHeight * (1 - p.horizon)) / p.depth, bottom: -(p.pictureHeight * p.horizon) / p.depth },
    params: { depth: p.depth, pictureHeight: p.pictureHeight, eye: p.eye, horizon: p.horizon, aspect: p.width / p.height },
  };
}

/**
 * Renders it into a canvas, as the screen would show it (tone mapped, sRGB): the renderer is
 * resized for it and drawn to its own canvas, read at once, then put back.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera the view's, drawn again afterwards
 * @param {{ hide?: THREE.Object3D[], from?: { x: number, y: number, z: number }, view?: typeof PREVIEW }} [o]
 *   what is left out of it, where it is taken from (previewView's, by default the door), and its size
 * @returns {HTMLCanvasElement}
 */
export function renderPreview(renderer, scene, camera, { hide = [], from, view = PREVIEW } = {}) {
  const f = previewView(view, from);
  const near = 0.05;
  const shot = new THREE.PerspectiveCamera();
  shot.position.set(f.eye.x, f.eye.y, f.eye.z);
  shot.updateMatrixWorld(true);
  const { left, right, top, bottom } = f.frustum;
  shot.projectionMatrix.makePerspective(left * near, right * near, top * near, bottom * near, near, 150);
  shot.projectionMatrixInverse.copy(shot.projectionMatrix).invert();
  const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
  const shown = hide.map((o) => o.visible);
  for (const o of hide) o.visible = false;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(view.width, view.height, false);
    renderer.render(scene, shot);
    const out = document.createElement('canvas');
    out.width = view.width;
    out.height = view.height;
    /** @type {CanvasRenderingContext2D} */ (out.getContext('2d')).drawImage(renderer.domElement, 0, 0); // a new canvas's: never null
    return out;
  } finally {
    hide.forEach((o, i) => { o.visible = shown[i]; });
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.x, size.y, false);
    renderer.render(scene, camera);
  }
}
