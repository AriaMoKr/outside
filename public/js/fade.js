// A fade to and from black around the viewer's head: a small sphere on the camera, drawn over
// everything. It works the same on a screen and in a headset.
import * as THREE from 'three';

export class Fade {
  constructor(camera, value = 1) {
    this.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false, opacity: value });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), this.material);
    this.mesh.renderOrder = 1e6;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'fade';
    camera.add(this.mesh);
    this.value = value;
    this.target = value;
    this.rate = 1;
    this.done = null;
    this._apply();
  }

  /** Fades to target (0 clear, 1 black) over seconds, then calls done. */
  to(target, seconds, done = null) {
    this.target = target;
    this.rate = Math.abs(target - this.value) / Math.max(seconds, 1e-3);
    this.done = done;
    if (target === this.value) this._finish();
  }

  /** Sets it at once. */
  set(value) {
    this.value = this.target = value;
    this.done = null;
    this._apply();
  }

  update(dt) {
    if (this.value === this.target) return;
    const step = this.rate * dt;
    if (Math.abs(this.target - this.value) <= step) this.value = this.target;
    else this.value += Math.sign(this.target - this.value) * step;
    this._apply();
    if (this.value === this.target) this._finish();
  }

  _finish() {
    const done = this.done;
    this.done = null;
    done?.();
  }

  _apply() {
    this.material.opacity = this.value;
    this.mesh.visible = this.value > 0.001;
  }
}
