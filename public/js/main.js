// Outside: a small garden beyond one of the hallway's doors. Coming out of the door, the visitor
// carries on from how they went through it (the hallway's link: where in the doorway, which way
// they faced); behind them the doorway glows and shows the hall, and going back through it leads
// back to the hallway, in front of that door. In the garden: a lawn, a stream that runs under a
// foot bridge into a pond, a trail over the bridge to a bench, and on the bench a book to read.
// The shared session (together.js) comes out here too, and goes back in.
import * as THREE from 'three';
import { DOOR, doorCrossed, doorSpawn, layoutGarden, surfaceAt } from './garden.js';
import { HAZE, buildGarden } from './scene.js';
import { Controls } from './controls.js';
import { Fade } from './fade.js';
import { Overlay } from './overlay.js';
import { DEFAULT_GLOW, OUTSIDE_ID } from './way.js';
import { setAnisotropy } from './textures.js';
import { hallwayViews, keptWay, leaveUrl, readVisit, wayBack, withoutVisit } from 'common/door.js';
import { loadNav, saveNav } from 'common/nav.js';
import { Together } from './together.js';
import { Book } from './book.js';
import { renderPreview, previewView } from './preview.js';
import { roomFromUrl } from 'layersharedsession/room.js';

const params = new URLSearchParams(location.search);

// Dev: emulate a Quest 3 with IWER (before anything asks navigator.xr). Chromium has a native
// navigator.xr even without a headset, so it is replaced.
let xrDevice = null;
if (params.get('xr') === 'emulate') {
  try {
    const { XRDevice, metaQuest3 } = await import(new URL('../vendor/iwer/iwer.module.js', import.meta.url).href);
    xrDevice = new XRDevice(metaQuest3);
    xrDevice.installRuntime({ forceInstall: true });
    console.info('outside: IWER WebXR emulation installed (Meta Quest 3)');
  } catch (err) {
    console.warn(`outside: no WebXR emulation: ${err.message}`);
  }
}

// ── How the visitor came, and the way back ───────────────────────────────────
// What the door added to the address is read once and taken off it. The way back, and the
// doorway's size and glow, stay for this tab (a reload) in sessionStorage.

const VISIT_KEY = 'outside.visit';
const visit = readVisit(location.search);
const cameThrough = visit.from !== null || params.has('back');
function kept() {
  try {
    const k = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? 'null');
    const way = k && keptWay(JSON.stringify(k.way));
    return way ? { way, glow: /^#[0-9a-f]{6}$/.test(k.glow) ? k.glow : null, dw: k.dw ?? null, dh: k.dh ?? null } : null;
  } catch {
    return null; // no storage (a private window, blocked site data): the way back lasts this page only
  }
}
const before = cameThrough ? null : kept();
const way = before?.way ?? wayBack(location.search, OUTSIDE_ID, { origin: location.origin });
const glow = visit.glow ?? before?.glow ?? DEFAULT_GLOW;
const doorWidth = visit.dw ?? before?.dw ?? DOOR.width;
const doorHeight = visit.dh ?? before?.dh ?? DOOR.height;
try {
  sessionStorage.setItem(VISIT_KEY, JSON.stringify({ way, glow, dw: doorWidth, dh: doorHeight }));
} catch {
  // As above.
}
const unvisited = withoutVisit(location.href);
if (unvisited !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', unvisited);
// Another place: its host, or the name it gives itself (backname), as short as on the way's label.
const shortName = way.label.replace(/^← /, '');
const names = way.hallway
  ? { title: 'Hallway', subtitle: 'Doors to other places', sign: 'Hallway' }
  : { title: shortName, subtitle: 'The way you came', sign: shortName };

let together = null; // the shared session, made once the scene is (below)
const overlay = new Overlay(way, {
  href: () => leaveUrl(way, together?.room ?? null),
  onLeave: () => together?.pause(),
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  overlay.noWebGL('This browser cannot show the garden in 3D. The way back to the Hallway is above.');
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('app').append(renderer.domElement);
const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
setAnisotropy(anisotropy);

const scene = new THREE.Scene();
scene.background = new THREE.Color(HAZE);
scene.fog = new THREE.Fog(HAZE, 30, 130);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 150);
/** A tall screen (a phone held upright) gets a taller view, as in the hallway. */
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  const wide = (2 * Math.atan(Math.tan((60 / 2) * THREE.MathUtils.DEG2RAD) / camera.aspect)) * THREE.MathUtils.RAD2DEG;
  camera.fov = Math.min(100, Math.max(70, wide));
  camera.updateProjectionMatrix();
}
fitCamera();
const rig = new THREE.Group();
rig.name = 'rig';
rig.add(camera);
scene.add(rig);

const L = layoutGarden({ doorWidth, doorHeight });
const garden = buildGarden(L, { names, glow, anisotropy });
scene.add(garden.group);
// Through the doorway, the view the hallway publishes from its door to here; until it does, the
// one rendered from it with that door added (tools/hallway-view.mjs). Elsewhere, its glow and name.
const views = hallwayViews(way, OUTSIDE_ID);
if (views) garden.house.loadView([views, { views: new URL('views/views.json', location.href).href, id: views.id }]);

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L });
const nav = loadNav();
controls.setNav(nav);
const fade = new Fade(camera, 1);
const book = new Book({ scene, place: L.book, anisotropy, light: garden.lightColor });

// Out of the door: where the visitor went through, turned as they were (and looking as high).
function arrivalPose() {
  return doorSpawn(L, visit.dx ?? 0, visit.yaw ?? 0);
}
{
  const s = arrivalPose();
  controls.setPose(s.x, s.z, s.yaw, visit.pitch ?? 0);
}

// ── Going back in ────────────────────────────────────────────────────────────

let leaving = false;
let leaveTimer = 0;
function go() {
  if (leaving) return;
  leaving = true;
  closeBook();
  const url = leaveUrl(way, together.room);
  // Leave the shared session now, so the others see the visitor go at once (the link carries its
  // room on); the fade gives the leaving message time to go out.
  together.pause();
  fade.to(1, renderer.xr.isPresenting ? 0.3 : 0.4, () => location.assign(url));
  // Still here a while later (the navigation was stopped or failed): come back out.
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(arrive, 12000);
}

/** Out here again (from the back/forward cache, or after a navigation that did not happen): at the door. */
function arrive() {
  leaving = false;
  clearTimeout(leaveTimer);
  const s = doorSpawn(L);
  controls.setPose(s.x, s.z, s.yaw);
  together.resume();
  fade.to(0, 0.6);
}

window.addEventListener('pageshow', (e) => {
  if (e.persisted) arrive();
});
// Leaving the page another way (a link, the address bar, closing it): leave the session too.
window.addEventListener('pagehide', () => together.pause());

controls.onDoor = (how) => {
  if (how === 'xr') go();
  else controls.walkInto();
};

// ── The bench and the book ───────────────────────────────────────────────────

let told = false;
controls.onBench = () => {
  // Sitting already: the bench again opens the book.
  if (controls.seated) {
    openBook();
    return;
  }
  controls.sit(() => {
    if (told) return;
    told = true;
    overlay.toast(renderer.xr.isPresenting ? 'Point at the book beside you to read it' : 'A book lies beside you: Read the book opens it. Moving gets you up.', 5);
  });
};
controls.onBook = () => controls.sit(() => openBook());
controls.onSeat = (seated) => {
  if (!seated) closeBook();
  overlay.setSeated(seated && !renderer.xr.isPresenting);
};
overlay.onRead = () => (book.isOpen ? closeBook() : controls.sit(() => openBook()));
function openBook() {
  if (book.isOpen) return;
  camera.updateMatrixWorld();
  const { pitch } = book.open(camera, { xr: renderer.xr.isPresenting, aspect: camera.aspect, fov: camera.fov });
  // On a screen, look down at it; in VR, one's head does.
  if (!renderer.xr.isPresenting) controls.pitch = pitch;
  controls.book = book;
  overlay.setReading(true);
}
function closeBook() {
  if (!book.isOpen) return;
  book.close();
  controls.book = null;
  overlay.setReading(false);
}
controls.onPage = (side) => book.turn(side);
controls.onCloseBook = closeBook;

let active = false;
controls.onActivity = () => {
  if (active) return;
  active = true;
  overlay.hideHint();
};
overlay.setHint(matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');

// ── Fullscreen, and the gamepad ──────────────────────────────────────────────

const root = document.documentElement;
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function toggleFullscreen() {
  const request = fullscreenElement()
    ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  Promise.resolve(request).catch((err) => overlay.toast(`Could not change fullscreen: ${err.message}`, 5));
}
function onFullscreenChange() {
  const on = !!fullscreenElement();
  overlay.setFullscreen(on);
  if (on) overlay.toast(controls.hasPad ? 'Esc or B leaves fullscreen' : 'Esc leaves fullscreen', 4);
}
// Browsers that cannot (an iPhone's) do not get the button.
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
  overlay.showFullscreen(toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}
// As in vrlbry and the hallway: the gamepad takes over when used (its hint, and a dot in the middle
// of the view to aim with), and the mouse takes it back. B or Back leaves fullscreen.
controls.onPadActive = (on) => {
  if (on) overlay.setHint('gamepad');
};
controls.onPadBack = () => {
  if (fullscreenElement()) toggleFullscreen();
};

// ── VR ───────────────────────────────────────────────────────────────────────

const SESSION_INIT = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
let entering = false;
async function enterVR() {
  if (renderer.xr.isPresenting) {
    await renderer.xr.getSession().end();
    return;
  }
  if (entering || !navigator.xr) return;
  entering = true;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', SESSION_INIT);
    await renderer.xr.setSession(session);
  } catch (err) {
    console.error(err);
    overlay.toast(`Could not start VR: ${err.message}`, 6);
  } finally {
    entering = false;
  }
}
let vrSupported = false;
renderer.xr.addEventListener('sessionstart', () => {
  overlay.vr.textContent = 'Exit VR';
  closeBook();
  showPanel();
});
renderer.xr.addEventListener('sessionend', () => {
  overlay.vr.textContent = 'Enter VR';
  closeBook();
  showPanel();
});
navigator.xr?.isSessionSupported?.('immersive-vr').then((ok) => {
  vrSupported = ok;
  showPanel();
  if (ok) overlay.showVR(enterVR);
}, () => {});
// Walking out of the hallway's VR (Quest Browser): the browser grants this page a session without a
// click, for about 5 s and only within one origin (the hallway's README, "Linking back"). The
// inline script in index.html notes a grant made before this module ran.
const takeGranted = () => {
  if (!renderer.xr.isPresenting) enterVR();
};
if (window.outsideXrGranted) takeGranted();
navigator.xr?.addEventListener?.('sessiongranted', takeGranted);

// ── The control panel on the wall ────────────────────────────────────────────

function showPanel() {
  const company = together ? together.company() : { here: 0, away: 0 };
  garden.panel.set({
    vr: renderer.xr.isPresenting ? 'exit' : vrSupported ? 'enter' : 'none',
    move: nav.move,
    turn: nav.turn,
    room: together?.room ?? null,
    link: together?.inviteLink.replace(/^https?:\/\//, '') ?? '',
    here: company.here,
    away: company.away,
  });
}
showPanel();
controls.onPanel = (id) => {
  if (id === 'vr') {
    if (renderer.xr.isPresenting || vrSupported) enterVR(); // enters, or exits when in VR
    return;
  }
  if (id === 'session') {
    if (together.room) {
      together.stop();
      overlay.toast('You left the shared session');
    } else {
      together.start();
      overlay.toast('Shared session started: Copy invite link to bring others out here', 5);
    }
    return;
  }
  const [key, value] = id.split(':');
  nav[key] = value;
  controls.setNav(nav);
  saveNav(nav);
  showPanel();
};
// A teleport in VR blinks: a moment of black hides the jump.
controls.onTeleport = (move) => {
  if (leaving || !renderer.xr.isPresenting) {
    move();
    return;
  }
  fade.to(1, 0.08, () => {
    move();
    fade.to(0, 0.2);
  });
};

// ── The shared session ───────────────────────────────────────────────────────

together = new Together({ scene, camera, renderer, hands: () => controls.hands, ground: (x, z) => surfaceAt(L, x, z) });
together.onChange = () => {
  showPanel();
  overlay.setInvite(together.active ? together.inviteLink : '');
  overlay.refreshLinks();
};
together.onNotice = (text) => overlay.toast(text, 4);
// An invite link, or the hallway's door, names the room: join it.
const invitedRoom = roomFromUrl(location.href);
if (invitedRoom) together.start(invitedRoom);

// ── The frame loop ───────────────────────────────────────────────────────────

const head = new THREE.Vector3();
let last = performance.now();
let time = 0;

function step(dt) {
  time += dt;
  controls.update(dt);
  camera.getWorldPosition(head);
  garden.update(time, dt, head, controls.hoverDoor);
  book.update(dt);
  together.update(performance.now());
  garden.panel.setHover(controls.hoverPanel);
  overlay.setAim(controls.padActive && !renderer.xr.isPresenting, !!controls.hover);
  if (!leaving && doorCrossed(L, head.x, head.z)) go();
  fade.update(dt);
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  step(Math.min(0.1, (now - last) / 1000));
  last = now;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

fade.to(0, 0.8);

// For scripted testing. A hidden page gets no animation frames: drive it with tick().
window.__outside = {
  THREE, renderer, scene, camera, rig, garden, layout: L, controls, overlay, fade, xrDevice, go, enterVR, together, book, way, visit,
  openBook, closeBook,
  /**
   * The picture the hallway's doorway to here shows (preview.js): the garden from the threshold,
   * as a data: URL, with how it is hung, for tools/preview.mjs.
   */
  preview(quality = 0.9) {
    return { jpeg: renderPreview(renderer, scene, camera, { hide: [fade.mesh] }).toDataURL('image/jpeg', quality), params: previewView().params };
  },
  tick(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) step(dt);
    renderer.render(scene, camera);
  },
};
