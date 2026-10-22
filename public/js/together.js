// Sharing the garden: the hallway's shared session (its together.js; AriaMoKr/layersharedsession,
// peer to peer over WebRTC with Trystero), which the control panel starts and leaves. Its room is
// in the address (?room=), so the address is the invitation; the hallway's door carries it here
// and the door back carries it on, so the visitor stays in it. This page is `outside` in the
// session (the hallway is `hallway`). The others in it who are out here are drawn by the layer's
// avatars.js, as on the other sites: a head with a visor on its front, a hand per tracked
// controller, a ring on the ground (ground: the lawn's rises, the banks, the bridge's deck) and
// their name. A wave from anyone in the session (the hallway's Wave, or a grip in VR) is a toast,
// and bobs their avatar when they are out here.
//
// The session module (and Trystero under it, ~360 kB) loads only when a session starts, so a visit
// without one costs nothing; the avatars' geometry is made with the first one met.
import { loadIdentity } from 'layersharedsession/identity.js';
import { newRoom } from 'layersharedsession/room.js';
import { emptyPose } from 'layersharedsession/pose.js';
import { createAvatars, readPose } from 'layersharedsession/avatars.js';
import { OUTSIDE_ID as PAGE_ID } from './way.js';

/** The app id every site in the session uses (and layersharedsession's test page, which can watch). */
export const APP_ID = 'ariamokr-layersharedsession-test';
/** How soon the same visitor's next wave counts: anyone can send anything (as the hallway's). */
const WAVE_AGAIN_MS = 1000;

const storage = (name) => {
  try {
    return window[name];
  } catch {
    return null;
  }
};
/** Whether a visitor is out here, for avatars.place: made once, not every frame. */
const isHere = (peer) => peer.page === PAGE_ID;

export class Together {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {THREE.Camera} o.camera  the viewer's head
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {() => Array<{controller: THREE.Object3D, source: XRInputSource|null}>} o.hands  controls.js's hands
   * @param {(x: number, z: number) => number} o.ground  the ground's height, for the rings
   */
  constructor({ scene, camera, renderer, hands, ground }) {
    this.ground = ground;
    this.camera = camera;
    this.renderer = renderer;
    this.hands = hands;
    this.session = null;
    this.room = null; // the room joined, or kept while paused (going through a door)
    this.paused = false;
    this.onChange = () => {};
    this.onNotice = () => {};
    this.avatars = createAvatars({ parent: scene, ground: this.ground }); // its group: 'visitors'
    this._pose = emptyPose();
    this._waves = new Map(); // peer id → when its last wave counted
    this._joining = 0; // which join is current: a slow import must not join a room left since
  }

  /** In a session (joined, or joining). */
  get active() {
    return !!this.room && !this.paused;
  }

  /** The address that brings others into the session: this page with only ?room=. */
  get inviteLink() {
    if (!this.room) return '';
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', this.room);
    return url.href;
  }

  /** How many others are out here (here) and elsewhere in the session (away). */
  company() {
    let here = 0, away = 0;
    if (this.session) {
      for (const p of this.session.peers.values()) {
        if (p.page === PAGE_ID) here++;
        else if (p.page) away++;
      }
    }
    return { here, away };
  }

  /** Starts a session in `room` (a new one by default), and puts the room in the address. */
  start(room = newRoom()) {
    this._leave();
    this.room = room;
    this.paused = false;
    this._setAddress(room);
    this._join();
    this.onChange();
  }

  /** Leaves the session and takes the room out of the address. */
  stop() {
    this._leave();
    this.room = null;
    this.paused = false;
    this._setAddress(null);
    this.onChange();
  }

  /** Leaves for now, keeping the room: going through a door (the link carries the room on). */
  pause() {
    if (!this.active) return;
    this._leave();
    this.paused = true;
    this.onChange();
  }

  /** Back after a pause (the door's navigation didn't happen, or Back restored this page). */
  resume() {
    if (!this.paused || !this.room) return;
    this.paused = false;
    this._join();
    this.onChange();
  }

  async _join() {
    const ticket = ++this._joining;
    const { joinSession } = await import('layersharedsession/session.js');
    if (ticket !== this._joining || !this.active) return;
    const identity = loadIdentity(storage('sessionStorage'), storage('localStorage'));
    const s = joinSession({ appId: APP_ID, room: this.room, page: PAGE_ID, identity, storage: storage('sessionStorage') });
    this.session = s;
    s.channel('wave').on((_, p) => this._waved(p));
    s.on('join', (p) => {
      this.avatars.show(p);
      this.onNotice(p.page === PAGE_ID ? `${p.name} is here` : `${p.name} is in the session, in ${p.page}`);
      this.onChange();
    });
    s.on('update', (p) => {
      // show() keeps the page the avatar was made with, so a change of page shows here.
      const a = this.avatars.show(p);
      if (a.page !== p.page && p.page === PAGE_ID) this.onNotice(`${p.name} came out into the garden`);
      a.page = p.page;
      this.onChange();
    });
    s.on('leave', (p) => {
      this.avatars.drop(p.peerId);
      this._waves.delete(p.peerId);
      this.onNotice(`${p.name || 'Someone'} left the session`);
      this.onChange();
    });
    this.onChange();
  }

  _leave() {
    this._joining++;
    this._waves.clear();
    if (!this.session) return;
    this.session.leave();
    this.session = null;
    this.avatars.clear();
  }

  /** A wave from `peer`: a toast, and their avatar bobs when they're out here. At most once a second each. */
  _waved(peer) {
    const now = performance.now();
    if (now - (this._waves.get(peer.peerId) ?? -Infinity) < WAVE_AGAIN_MS) return;
    this._waves.set(peer.peerId, now);
    this.avatars.wave(peer.peerId, now);
    const name = peer.name || 'Someone';
    this.onNotice(!peer.page || peer.page === PAGE_ID ? `${name} waved` : `${name} waved, in ${peer.page}`);
  }

  _setAddress(room) {
    const url = new URL(location.href);
    if (room) url.searchParams.set('room', room);
    else url.searchParams.delete('room');
    history.replaceState(history.state, '', url.href);
  }

  /** Per frame: sends where the head and hands are (at most 15 times a second), and places the others. */
  update(now) {
    const s = this.session;
    if (!s) return;
    s.setPose(readPose(this.camera, this.renderer.xr.isPresenting ? this.hands() : null, this._pose));
    s.tick();
    this.avatars.place(now, s.peers, isHere);
  }
}
