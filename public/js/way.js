// How the visitor came, and the way back: what the hallway's door added to the address (its
// README, "Going in"), read once, and where the door in the house's wall leads (its README,
// "Linking back"). Pure, for the tests.
//
// The hallway (https://ariamokr.github.io/hallway/, github.com/AriaMoKr/hallway) opens this garden
// as ?from=hallway&back=<the way back>&dx=…&yaw=…&pitch=…&dw=…&dh=…&glow=…[&room=…]. The door back
// leads to `back` when it is an http(s) address, and is called the Hallway only when it is one:
// from=hallway, on this page's origin or the hallway's (or, developing, both on this machine,
// as the two dev servers are on their own ports). Anywhere else is named by its host, so a
// link cannot send visitors somewhere unsaid. Without `back` it leads to the hallway: this garden
// is outside the hallway's door, however one got here.

/** This garden's id: the hallway's door here would be `outside`, and the way back is ?from=outside. */
export const OUTSIDE_ID = 'outside';
/** The hallway's id in `from`. */
export const HALLWAY_ID = 'hallway';
/** The hallway, in front of this garden's door. */
export const HALLWAY_URL = 'https://ariamokr.github.io/hallway/?from=outside';
/** What a door adds to the address, taken off once read. `room` stays: it names the shared session. */
export const VISIT_PARAMS = ['from', 'back', 'dx', 'yaw', 'pitch', 'dw', 'dh', 'glow'];
/** The door back's glow when the link gives none: the green of the hallway's door to here. */
export const DEFAULT_GLOW = '#9fd07a';

/**
 * This garden's door in the hallway: the entry the hallway's environments.js takes for it (its
 * README, "Adding a door"). tools/hallway-view.mjs renders the hall with it, to show through the
 * door back here; README.md, "A door in the hallway", gives it to copy.
 */
export const HALLWAY_DOOR = {
  id: OUTSIDE_ID,
  title: 'Outside',
  subtitle: 'A small garden: a lawn, a stream and a pond, a foot bridge, and a bench to read on',
  sign: 'Garden',
  url: 'https://ariamokr.github.io/outside/',
  preview: 'https://ariamokr.github.io/outside/hallway-preview.jpg',
  color: DEFAULT_GLOW,
};

const DEG = Math.PI / 180;

/** A number parameter, kept between lo and hi, or null when it is missing or not a number. */
function number(q, key, lo, hi) {
  const s = q.get(key);
  if (s === null || s.trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
}

/**
 * How the visitor came through the door, from the address: `dx` (m from the doorway's middle, + to
 * their right facing in, which is their right facing out here), `yaw` and `pitch` (radians from
 * straight through, + to the left and up), the doorway's `dw` and `dh` (m), its `glow`
 * ('#rrggbb'); each null when the link doesn't give it, or gives nonsense.
 */
export function readVisit(search) {
  const q = new URLSearchParams(search);
  const yaw = number(q, 'yaw', -90, 90);
  const pitch = number(q, 'pitch', -89, 89);
  const glow = q.get('glow');
  return {
    from: q.get('from'),
    dx: number(q, 'dx', -1.2, 1.2),
    yaw: yaw === null ? null : yaw * DEG,
    pitch: pitch === null ? null : pitch * DEG,
    dw: number(q, 'dw', 0.7, 2.4),
    dh: number(q, 'dh', 1.9, 3.2),
    glow: glow && /^[0-9a-f]{6}$/i.test(glow) ? `#${glow.toLowerCase()}` : null,
  };
}

/** Whether an origin is a development server on this machine (the hallway's and this garden's, on their own ports). */
function local(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

/**
 * Where the door back leads: { url, label (on the button and the link), title (where it leads),
 * name (on the door's plaque and sign), host, hallway (whether it is the hallway) }.
 * @param {string} search location.search
 * @param {string} origin this page's origin (location.origin)
 */
export function wayBack(search, origin) {
  const q = new URLSearchParams(search);
  let url = null;
  try {
    url = q.get('back') ? new URL(q.get('back')) : null;
  } catch {
    url = null;
  }
  if (url && url.protocol !== 'https:' && url.protocol !== 'http:') url = null;
  if (!url) {
    const host = new URL(HALLWAY_URL).host;
    return { url: HALLWAY_URL, label: '← Hallway', title: 'Back into the Hallway, whose doors lead to other places', name: 'Hallway', host, hallway: true };
  }
  const hallway = q.get('from') === HALLWAY_ID && (url.origin === origin || url.origin === new URL(HALLWAY_URL).origin || (local(url.origin) && local(origin)));
  return hallway
    ? { url: url.href, label: '← Hallway', title: `Back into the Hallway (${url.host})`, name: 'Hallway', host: url.host, hallway: true }
    : { url: url.href, label: `← ${url.host}`, title: `Back to ${url.href}`, name: url.host, host: url.host, hallway: false };
}

/** A way back kept for this tab (sessionStorage, as JSON), checked; null when it isn't one. */
export function keptWay(json) {
  let w;
  try {
    w = JSON.parse(json);
  } catch {
    return null;
  }
  if (!w || typeof w !== 'object') return null;
  if (typeof w.url !== 'string' || !/^https?:\/\//.test(w.url)) return null;
  for (const k of ['label', 'title', 'name', 'host']) if (typeof w[k] !== 'string' || !w[k]) return null;
  return { url: w.url, label: w.label, title: w.title, name: w.name, host: w.host, hallway: w.hallway === true };
}

/**
 * The address without what a door added: read once, so a reload, Back or a shared link doesn't
 * arrive again. The path, other parameters (?xr=emulate, ?room=) and the hash stay as written.
 */
export function withoutVisit(href) {
  const u = new URL(href);
  const kept = u.search.slice(1).split('&').filter((p) => p && !VISIT_PARAMS.includes(decodeURIComponent(p.split('=')[0])));
  return u.pathname + (kept.length ? `?${kept.join('&')}` : '') + u.hash;
}

/** The address the door back opens: the way back, in the shared session `room` (or out of any). */
export function leaveUrl(way, room) {
  const u = new URL(way.url);
  if (room) u.searchParams.set('room', room);
  else u.searchParams.delete('room');
  return u.href;
}

/**
 * Where the hallway publishes the view out of its door to here (its README, "The view from your
 * door"), for the way back to show it: { views (views.json's address), id (the door's) }, or null
 * when the way back is not the hallway.
 */
export function hallwayViews(way) {
  if (!way.hallway) return null;
  const u = new URL(way.url);
  return { views: new URL('views/views.json', u).href, id: u.searchParams.get('from') || OUTSIDE_ID };
}

/**
 * An entry of the hallway's views.json, checked: { image, depth, pictureHeight, eye, horizon,
 * aspect } with sizes in sensible ranges, else null (as vrlbry checks it).
 */
export function viewParams(entry) {
  if (!entry || typeof entry.image !== 'string' || !entry.image) return null;
  const n = (v, lo, hi) => (typeof v === 'number' && v >= lo && v <= hi ? v : null);
  const v = {
    image: entry.image,
    depth: n(entry.depth, 0.3, 30), pictureHeight: n(entry.pictureHeight, 0.5, 40), eye: n(entry.eye, 0, 3),
    horizon: n(entry.horizon, 0, 1), aspect: n(entry.aspect ?? 2, 0.25, 8),
  };
  return Object.values(v).every((x) => x !== null) ? v : null;
}
