// Outside: a small garden beyond one of the hallway's doors. Coming out of the door, the visitor
// carries on from how they went through it (the hallway's link: where in the doorway, which way
// they faced); behind them the doorway glows and shows the hall, and going back through it leads
// back to the hallway, in front of that door. In the garden: a lawn, a stream that runs under a
// foot bridge into a pond, a trail over the bridge to a bench, and on the bench a book to read,
// with vrlbry's book controls (book.js), its text view (text-view.js) and the browser's Back
// along its links (back-history.js). The shared session (together.js) comes out here too, and
// goes back in. In the hallway's Android TV app (common's tv.js) it is the 10-foot view, walked and
// read with the remote.
import * as THREE from 'three';
import { DOOR, doorCrossed, doorSpawn, layoutGarden, surfaceAt } from './garden.js';
import { HAZE, buildGarden } from './scene.js';
import { Controls } from './controls.js';
import { Overlay } from './overlay.js';
import { DEFAULT_GLOW, OUTSIDE_ID } from './way.js';
import { setAnisotropy } from './textures.js';
import { hallwayViews, keptWay, leaveUrl, readVisit, wayBack, withoutVisit } from 'common/door.js';
import { Fade } from 'common/fade.js';
import { NAV_KEY, loadNav, saveNav } from 'common/nav.js';
import { ACCESS_KEY, Vignette, eyeLift, loadAccess, motionQuery, reduceMotion, saveAccess, watchMotion } from 'common/access.js';
import { gardenTogether, noticeText } from './together.js';
import { Book } from './book.js';
import { readingText } from './pages.js';
import { readerSettings } from './reader.js';
import { TextView } from './text-view.js';
import { BackHistory } from 'common/back-history.js';
import { BOOK_SUBTITLE, BOOK_TITLE, COLOPHON, PIECES } from './reading.js';
import { renderPreview, previewView } from './preview.js';
import { roomFromUrl } from 'layersharedsession/room.js';
import { Remote, tvMode } from 'common/tv.js';
import { backStep } from './remote.js';
import { liteParts } from './lite.js';

const params = new URLSearchParams(location.search);
// The TV app's page (HallwayApp's WebView; ?tv=emulate, as if, in any browser): larger text, focus
// rings seen across a room, no Enter VR or Fullscreen, the remote's keys (below).
const tv = tvMode();
document.documentElement.classList.toggle('tv', tv);
// The garden drawn lighter (lite.js): on a TV all of it, in any browser what ?lite= asks for. On the
// TV (a Mali-G52 driving 1920 x 1080 from a 960 x 540 page) it is drawn at the page's size: at 2 it
// held 31 fps at the way in and 23 by the pond, at 1 about 60 (README); and its textures are
// filtered less, as the ground, read at a grazing angle, costs most of what is left.
const lite = liteParts(location.search, tv);
const LITE_PIXEL_RATIO = 1, LITE_ANISOTROPY = 2;
document.documentElement.classList.toggle('lite-card', lite.has('card'));
// The remote can't look up or down: on a TV the view rests a little down (controls.js restPitch).
const TV_PITCH = -0.25;

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
  tv,
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  overlay.noWebGL('This browser cannot show the garden in 3D. The way back to the Hallway is above.');
  throw err;
}
renderer.setPixelRatio(lite.has('ratio') ? LITE_PIXEL_RATIO : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
// The view, to a screen reader: a picture of the garden (what can be done in it is in the overlay).
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', 'A small garden: a lawn, a stream and a pond, a foot bridge, and a bench');
document.getElementById('app').append(renderer.domElement);
const anisotropy = Math.min(lite.has('filter') ? LITE_ANISOTROPY : 8, renderer.capabilities.getMaxAnisotropy());
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
const garden = buildGarden(L, { names, glow, anisotropy, lite });
scene.add(garden.group);
// Through the doorway, the view the hallway publishes from its door to here; when that can't be
// had, the one rendered from it here (tools/hallway-view.mjs). Elsewhere, its glow and name.
const views = hallwayViews(way, OUTSIDE_ID);
if (views) garden.house.loadView([views, { views: new URL('views/views.json', location.href).href, id: views.id }]);

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L });
if (tv) {
  controls.aimMiddle = true; // the dot in the middle, which OK uses (below)
  controls.restPitch = TV_PITCH;
}
const nav = loadNav();
controls.setNav(nav);
// The accessibility settings every site on the origin shares (common/access.js, hallway.access):
// less motion (the system's, or the visitor's own), the comfort vignette, seated mode. Applied
// below (applyAccess), once everything they touch is made.
let access = loadAccess();
const motion = motionQuery();
let reduce = reduceMotion(access, motion);
/** With less motion, a fade of a few tenths of a second is a blink. */
const blink = (seconds) => (reduce ? 0.08 : seconds);
const fade = new Fade(camera, 1);
const vignette = new Vignette(camera, access.vignette);
// The reader's choices for the book (reader.js): its text size, theme, one page or two, its size
// and distance in VR, whether it opens as text, and where they are reading. This page's own.
const BOOK_KEY = 'outside.book';
function loadBook() {
  try {
    return readerSettings(JSON.parse(localStorage.getItem(BOOK_KEY) ?? 'null'));
  } catch {
    return readerSettings(null); // no storage (a private window, blocked site data): they last this visit
  }
}
const book = new Book({ scene, place: L.book, anisotropy, light: garden.lightColor, settings: loadBook() });
book.onSettings = () => {
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify(book.settings));
  } catch {
    // As above.
  }
};

// Out of the door: where the visitor went through, turned as they were (and looking as high).
function arrivalPose() {
  return doorSpawn(L, visit.dx ?? 0, visit.yaw ?? 0);
}
{
  const s = arrivalPose();
  controls.setPose(s.x, s.z, s.yaw, tv ? TV_PITCH : visit.pitch ?? 0);
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
  // room on): the fade, and then until it is left (half a second at most), give the leaving message
  // time to go out.
  const left = Promise.race([together.pause(), new Promise((r) => setTimeout(r, 500))]);
  fade.to(1, blink(renderer.xr.isPresenting ? 0.3 : 0.4), () => left.then(() => location.assign(url)));
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
  fade.to(0, blink(0.6));
}

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  rereadSettings(); // changed elsewhere on the origin while this page was away
  arrive();
});
// Leaving the page another way (a link, the address bar, closing it): leave the session too.
window.addEventListener('pagehide', () => together.pause());

// On a screen, choosing the door walks up to it and through; with less motion, straight through.
controls.onDoor = (how) => {
  if (how === 'xr' || reduce) go();
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
    overlay.toast(renderer.xr.isPresenting ? 'Point at the book beside you to read it' : tv ? 'A book lies beside you: OK opens it. Moving gets you up.' : 'A book lies beside you: Read the book opens it. Moving gets you up.', 5);
  });
};
controls.onBook = () => controls.sit(() => openBook());
controls.onSeat = (seated) => {
  if (!seated) closeBook();
  overlay.setSeated(seated);
};
// The overlay's buttons do as the bench and the book do in 3D: on a screen, one walks there first.
// On a TV, Sit on the bench and Read the book give the focus back to the view, as Back from the
// card does, so the arrows walk, or turn the pages, at once.
overlay.onBench = (sit) => {
  if (!sit) {
    controls.stand();
    return;
  }
  remote?.walk();
  controls.onBench();
};
overlay.onRead = () => {
  if (book.isOpen) {
    closeBook();
    return;
  }
  remote?.walk();
  controls.sit(() => openBook());
};
// The browser's Back, with the book open, goes back along the contents' links, then puts it down
// (common's back-history.js). The prefix keeps the names this site's own copy gave its fields in an
// entry's state (outsideBook…), so entries already in a visitor's tab are still the book's.
const backHistory = new BackHistory({
  history,
  prefix: 'outside',
  load: performance.timeOrigin,
  onBack: (depth) => book.backTo(depth),
  onAway: () => closeBook({ away: true }),
});
addEventListener('popstate', (e) => backHistory.popstate(e.state));
book.history = backHistory;
book.onTrail = (depth) => backHistory.pushed(depth);
// Whether the open book's entry is one a TV app's Back will come to: Chromium passes over the
// entries of a page nobody has pressed a key on or clicked (a book taken out with a gamepad alone).
// Then Back puts it down itself (stepBack).
let bookEntry = false;
function openBook() {
  if (book.isOpen) return;
  camera.updateMatrixWorld();
  const { pitch } = book.open(camera, { xr: renderer.xr.isPresenting, aspect: camera.aspect, fov: camera.fov });
  // On a screen, look down at it; in VR, one's head does.
  if (!renderer.xr.isPresenting) controls.pitch = pitch;
  controls.book = book;
  // The dot is walking's: reading, a TV's OK is the book's Enter (useMiddle), so nothing is aimed at.
  controls.aimMiddle = false;
  overlay.setReading(true);
  // On a TV, Menu goes to the book's buttons now (the remote's first, below), not back to the
  // control last left in the card, such as Read the book.
  remote?.forget();
  backHistory.bookOut();
  bookEntry = navigator.userActivation?.hasBeenActive ?? true;
  if (book.settings.textView) textView.open(); // "Open it as text" (a screen only)
}
/** Puts the book down; away: by the browser's Back, whose entries are gone already. */
function closeBook({ away = false } = {}) {
  if (!book.isOpen) return;
  book.close();
  controls.book = null;
  controls.aimMiddle = tv; // a TV's dot again
  overlay.setReading(false);
  overlay.hideBookText();
  textView.close({ keepPlace: false }); // focus back to Read the book
  if (!away) backHistory.cleared();
  // The remote can't look up from where the book was held: the view as it rests.
  if (tv && !renderer.xr.isPresenting) controls.pitch = controls.restPitch;
}
/** B, Y, Backspace: one step back in the book (its contents, the links followed), else it is put down. */
function back() {
  if (!book.back()) closeBook();
}
// On a TV the remote leaves the focus on the view while the text view is open (below): its keys
// read it, ← → a page from the reader's place, ↑ ↓ on or back, Esc or T back to the book in 3D.
controls.onPage = (side) => (textView.isOpen ? textView.turn(side) : book.turn(side));
controls.onCloseBook = closeBook;
controls.onBookPress = (hit) => book.press(hit);
controls.onBookAction = (action, value) => {
  if (textView.isOpen && (action === 'contents-move' || action === 'enter' || action === 'escape' || action === 'textView')) {
    if (action === 'contents-move') textView.scrollStep(value);
    else if (action !== 'enter') textView.close();
    return;
  }
  if (action === 'font') book.changeFont(value);
  else if (action === 'theme') book.cycleTheme();
  else if (action === 'contents') book.toggleContents();
  else if (action === 'contents-move') book.moveContents(value);
  else if (action === 'enter') {
    // A TV's OK: the contents, then the entry marked in it (↑ ↓).
    if (!book.chooseContents() && tv) book.toggleContents(true);
  }
  else if (action === 'pages') book.togglePages();
  else if (action === 'textView') textView.toggle();
  else if (action === 'front') book.toFront();
  else if (action === 'back') back();
  else if (action === 'escape') {
    if (book.contents.visible) book.toggleContents(false);
    else closeBook();
  } else if (action === 'distance') book.adjustDistance(value);
  else if (action === 'scale') book.adjustScale(value);
};
controls.onGrab = (hand, on) => (on ? book.grab(hand.controller) : book.release(hand.controller));
book.onClose = closeBook;
book.onHold = (pitch) => {
  if (!renderer.xr.isPresenting) controls.pitch = pitch;
};
/** The open book's pages, as words a screen reader reaches (and says as they turn), unless the text view shows them. */
function showBookText() {
  if (book.isOpen && !textView.isOpen) overlay.showBookText(BOOK_TITLE, readingText(book.pages, book.readingPages()));
}
book.onShow = () => {
  showBookText();
  textView.follow();
};
// The text view (T, or the overlay's Text view): the book's words as a page of text, on a screen.
const textView = new TextView({
  root: document.getElementById('view-overlay'),
  reader: book,
  text: { title: BOOK_TITLE, subtitle: BOOK_SUBTITLE, pieces: PIECES, colophon: COLOPHON },
  putDown: () => closeBook(),
  back,
  presenting: () => renderer.xr.isPresenting,
  onOpen: () => {
    overlay.hideBookText(); // the view has them now
    overlay.setTextView(true);
    // On a TV, the remote's arrows read it (controls.onBookAction) and Menu goes to its toolbar:
    // the focus back on the view once the view has opened (it takes it, to its title).
    if (remote) queueMicrotask(() => remote.walk());
  },
  onClose: showBookText,
  returnFocus: () => {
    overlay.setTextView(false);
    if (!remote) return book.isOpen ? overlay.textView : overlay.read;
    remote.walk();
    return null;
  },
});
overlay.onTextView = () => textView.toggle();
overlay.onFront = () => book.toFront();
overlay.onBook = (action, value) => controls.onBookAction(action, value);
overlay.onReset = resetView;
overlay.onTextViewPref = (on) => {
  book.settings.textView = on;
  book.onSettings();
};
overlay.setTextViewPref(book.settings.textView);

/**
 * Back to the start (Home, Reset view, as in vrlbry): the book put down, as large and (in VR) as
 * far as at first, and the visitor at the door, looking out.
 */
function resetView() {
  closeBook();
  book.resetHold();
  const s = doorSpawn(L);
  controls.resetTo(s.x, s.z, s.yaw);
}
controls.onHome = resetView;

let active = false;
controls.onActivity = () => {
  if (active) return;
  active = true;
  overlay.hideHint();
};
overlay.setHint(tv ? 'tv' : matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');

// ── The TV's remote (common's tv.js) ─────────────────────────────────────────
// Walking, the view holds the focus: the arrows walk and turn, and OK uses what the dot in the
// middle is on (the bench, the book, the door, the panel, the ground); sitting, it opens the book
// beside one; reading, it is the book's Enter, as the arrows are its pages and contents
// (controls.js). Menu moves the focus into the card (Sit, Read, the book's controls, Settings),
// and Back goes one step back (stepBack). The app asks window.hallwayTV what Back and Menu do.
let remote = null;
if (tv) {
  renderer.domElement.setAttribute('aria-describedby', overlay.hint.id);
  // The card, the buttons at the foot and the text view are all the remote's to reach (and what is
  // covered by the text view while it is open isn't shown: style.css).
  // Menu with no control to come back to: while reading, the book's buttons (Contents first);
  // else the card's first stop.
  remote = new Remote({ root: document.body, view: renderer.domElement, use: useMiddle, step: stepBack, first: () => (book.isOpen ? overlay.bookTools : null) });
  remote.onMode = (inCard) => overlay.setInCard(inCard);
  remote.answerApp(tv);
}
/** OK, walking (the remote has used the key: controls.js leaves it alone). */
function useMiddle() {
  if (book.isOpen) controls.onBookAction('enter'); // the contents, then the entry marked in it
  else if (controls.seated) openBook(); // the book lies beside one, out of the dot's way
  else controls.useMiddle();
}
/**
 * Back, walking: one step back (remote.js backStep), as Esc and Backspace take them; false leaves
 * it to the app, which goes back a page through the page's history: back along a link, the book
 * put down (back-history.js), then back to the hallway's door.
 */
function stepBack() {
  const s = backStep({
    textView: textView.isOpen, toc: textView.contentsOpen, book: book.isOpen, contents: book.contents.visible,
    trail: book.trail.length > 0, entry: bookEntry && backHistory.level > 0, seated: !!controls.seated,
  });
  if (s === 'toc') textView.closeContents();
  else if (s === 'text') textView.close();
  else if (s === 'contents') book.toggleContents(false);
  else if (s === 'link') book.goBack();
  else if (s === 'book') closeBook();
  else if (s === 'stand') controls.stand();
  return s !== null;
}

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
// Browsers that cannot (an iPhone's) do not get the button, nor does the TV app, which is full screen.
if (!tv && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
  overlay.showFullscreen(toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}
// As in vrlbry and the hallway: the gamepad takes over when used (its hint, and a dot in the middle
// of the view to aim with), and the mouse takes it back. B or Back leaves fullscreen; on a TV it is
// the remote's Back.
controls.onPadActive = (on) => {
  if (on) overlay.setHint('gamepad');
};
controls.onPadBack = () => {
  if (remote) remote.padBack();
  else if (fullscreenElement()) toggleFullscreen();
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
// Not on a TV, which has no headset (nor, so far, a WebXR in its WebView).
if (!tv) navigator.xr?.isSessionSupported?.('immersive-vr').then((ok) => {
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
if (!tv) {
  if (window.outsideXrGranted) takeGranted();
  navigator.xr?.addEventListener?.('sessiongranted', takeGranted);
}

// ── The control panel on the wall (and the same choices in the overlay) ──────

function showPanel() {
  const company = together ? together.company() : { here: 0, away: 0 };
  garden.panel.set({
    vr: renderer.xr.isPresenting ? 'exit' : vrSupported ? 'enter' : 'none',
    move: nav.move,
    turn: nav.turn,
    motion: access.motion,
    vignette: access.vignette,
    seated: access.seated,
    room: together?.room ?? null,
    link: together?.inviteLink.replace(/^https?:\/\//, '') ?? '',
    here: company.here,
    away: company.away,
  });
  overlay.setChoices(nav, access);
  overlay.setSession(!!together?.room);
}
showPanel();
/** Starts a shared session, or leaves the one this is in. */
function toggleSession() {
  if (together.room) {
    together.stop();
    overlay.toast('You left the shared session');
  } else {
    together.start();
    overlay.toast(tv ? 'Shared session started: the card shows the link that brings others out here' : 'Shared session started: Copy invite link to bring others out here', 5);
  }
}
/** A VR movement choice ('move' or 'turn'), kept for here and the hallway (common/nav.js). */
function choose(key, value) {
  nav[key] = value;
  controls.setNav(nav);
  saveNav(nav);
  showPanel();
}
controls.onPanel = (id) => {
  if (id === 'vr') {
    if (renderer.xr.isPresenting || vrSupported) enterVR(); // enters, or exits when in VR
    return;
  }
  if (id === 'session') {
    toggleSession();
    return;
  }
  const [key, value] = id.split(':');
  if (key === 'motion') setAccess({ motion: value });
  else if (key === 'vignette' || key === 'seated') setAccess({ [key]: value === 'on' });
  else choose(key, value);
};
overlay.onSession = toggleSession;
overlay.onNav = choose;
overlay.onAccess = (change) => setAccess(change);
// A teleport in VR blinks: a moment of black hides the jump.
controls.onTeleport = (move) => {
  if (leaving || !renderer.xr.isPresenting) {
    move();
    return;
  }
  fade.to(1, 0.08, () => {
    move();
    fade.to(0, blink(0.2));
  });
};

// ── The shared session ───────────────────────────────────────────────────────

together = gardenTogether({ scene, camera, renderer, hands: () => controls.hands, ground: (x, z) => surfaceAt(L, x, z) });
together.on('change', () => {
  showPanel();
  overlay.setInvite(together.active ? together.inviteLink : '');
  overlay.setTogether(together.active);
  overlay.refreshLinks();
});
// The session's notices (someone joined, came out here, left, waved), in the garden's words.
together.on('notice', (notice) => {
  const text = noticeText(notice);
  if (text) overlay.toast(text, 4);
});
// A wave: the Wave button, or a controller's grip in VR (which pulses, so the waver feels it go).
overlay.onWave = () => {
  if (together.wave()) overlay.toast('You waved', 2);
};
controls.onSqueeze = (hand) => {
  if (together.wave()) hand.source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.6, 60);
};
// An invite link, or the hallway's door, names the room: join it.
const invitedRoom = roomFromUrl(location.href);
if (invitedRoom) together.start(invitedRoom);

// ── Accessibility (common/access.js) ─────────────────────────────────────────

/**
 * The settings as they are now: with less motion the walks jump (controls), the fades blink
 * (blink), the book's leaf and its slide on a narrow screen are cut, a wave doesn't bob, and the
 * water, the grass and the doorway's veil hold still (the frame loop's time); the vignette as the
 * visitor wants it; seated mode's lift in VR.
 */
function applyAccess() {
  reduce = reduceMotion(access, motion);
  controls.reduceMotion = book.reduceMotion = together.reduceMotion = reduce;
  document.documentElement.classList.toggle('reduce-motion', reduce);
  vignette.enabled = access.vignette;
  controls.setEyeLift(eyeLift(access));
  showPanel();
}
/** A setting changed, on the panel or in the overlay: applied, and kept for every site on the origin. */
function setAccess(change) {
  access = { ...access, ...change };
  saveAccess(access); // false when storage is blocked: they then last this visit
  applyAccess();
}
/** The settings and the movement choice again, as another page on the origin (the hallway) left them. */
function rereadSettings() {
  access = loadAccess();
  Object.assign(nav, loadNav());
  controls.setNav(nav);
  applyAccess();
}
applyAccess();
watchMotion(applyAccess, motion); // the system's setting, followed with motion 'system'
addEventListener('storage', (e) => {
  if (e.key === ACCESS_KEY || e.key === NAV_KEY || e.key === null) rereadSettings();
});

// ── The frame loop ───────────────────────────────────────────────────────────

const head = new THREE.Vector3();
let last = performance.now();
let time = 0; // what moves on its own (the water, the grass, the doorway's veil) goes by this

function step(dt) {
  if (!reduce) time += dt;
  controls.update(dt);
  vignette.update(dt, controls.moveSpeed, controls.turnRate, renderer.xr.isPresenting);
  camera.getWorldPosition(head);
  garden.update(time, dt, head, controls.hoverDoor);
  book.update(dt);
  together.update(performance.now());
  garden.panel.setHover(controls.hoverPanel);
  // The dot: a gamepad's, and a TV remote's while walking (reading, its OK is the book's).
  overlay.setAim((controls.padActive || (remote !== null && !remote.inCard && !book.isOpen)) && !renderer.xr.isPresenting, !!controls.hover);
  if (book.isOpen) overlay.setBook(book.contents.visible, book.single, book.settings.theme);
  if (!leaving && doorCrossed(L, head.x, head.z)) go();
  fade.update(dt);
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  step(Math.min(0.1, (now - last) / 1000));
  last = now;
  // The text view covers the view: it is drawn again once that closes.
  if (!textView.isOpen || renderer.xr.isPresenting) renderer.render(scene, camera);
});

let refitTimer = 0;
addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
  // An open book follows a while later: one page upright, two across ('auto'), held where it fits.
  clearTimeout(refitTimer);
  refitTimer = setTimeout(() => book.refit(), 300);
});

fade.to(0, blink(0.8));

// For scripted testing. A hidden page gets no animation frames: drive it with tick().
window.__outside = {
  THREE, renderer, scene, camera, rig, garden, layout: L, controls, overlay, fade, vignette, xrDevice, go, enterVR, together, book, way, visit,
  textView, backHistory, openBook, closeBook, resetView, setAccess, tv, remote, stepBack,
  /** The accessibility settings now, and whether motion is reduced. */
  get access() {
    return { ...access, reduce };
  },
  /**
   * The picture the hallway's doorway to here shows (preview.js): the garden from the threshold,
   * as a data: URL, with how it is hung, for tools/preview.mjs.
   */
  preview(quality = 0.9) {
    return { jpeg: renderPreview(renderer, scene, camera, { hide: [fade.mesh, vignette.mesh] }).toDataURL('image/jpeg', quality), params: previewView().params };
  },
  tick(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) step(dt);
    renderer.render(scene, camera);
  },
};
