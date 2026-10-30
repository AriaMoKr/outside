// Sharing the garden: the sites' shared session, layersharedsession's together.js (createTogether:
// peer to peer over WebRTC with Trystero), which the control panel and the card start and leave.
// Its room is in the address (?room=), so the address is the invitation; the hallway's door carries
// it here and the door back carries it on, so the visitor stays in it. This page is `outside` in
// the session (the hallway is `hallway`). The others in it who are out here are drawn by the
// layer's avatars.js, as on the other sites, with a ring on the garden's ground (ground: the lawn's
// rises, the banks, the bridge's deck). A wave (the Wave button, or a grip in VR, here or in the
// hallway) goes to everyone in the session; one from someone else is a notice, and bobs their
// avatar when they are out here. The controller loads the session (and Trystero under it, ~360 kB)
// only when one starts, and words nothing: what the garden says is here (noticeText).
import { createTogether } from 'layersharedsession/together.js';
import { OUTSIDE_ID as PAGE_ID } from './way.js';

/** The app id every site in the session uses (and layersharedsession's test page, which can watch). */
export const APP_ID = 'ariamokr-layersharedsession-test';

/**
 * The shared session for this page.
 * @param {object} o
 * @param {import('three').Scene} o.scene where the others are drawn
 * @param {import('three').Camera} o.camera the viewer's head
 * @param {import('three').WebGLRenderer} o.renderer
 * @param {() => Array<{controller: import('three').Object3D, source: XRInputSource|null}>} o.hands controls.js's hands
 * @param {(x: number, z: number) => number} o.ground the ground's height, for the rings
 */
export function gardenTogether({ scene, camera, renderer, hands, ground }) {
  return createTogether({ appId: APP_ID, page: PAGE_ID, camera, renderer, hands, avatars: { parent: scene, ground } });
}

/** What the garden says for a notice of the session (together.js: join, arrive, leave, wave), or null. */
export function noticeText({ kind, peer }) {
  const name = peer.name || 'Someone';
  const here = !peer.page || peer.page === PAGE_ID;
  if (kind === 'join') return here ? `${name} is here` : `${name} is in the session, in ${peer.page}`;
  if (kind === 'arrive') return `${name} came out into the garden`;
  if (kind === 'leave') return `${name} left the session`;
  if (kind === 'wave') return here ? `${name} waved` : `${name} waved, in ${peer.page}`;
  return null;
}
