// How the viewer moves in VR, chosen on the control panel and kept in this browser.

const KEY = 'hallway.nav';
const CHOICES = { move: ['smooth', 'teleport'], turn: ['snap', 'smooth'] };
export const NAV_DEFAULTS = { move: 'smooth', turn: 'snap' };

/** A complete, valid setting from whatever was stored (unknown or missing values: the defaults). */
export function normalizeNav(value) {
  const out = { ...NAV_DEFAULTS };
  if (value && typeof value === 'object') {
    for (const k of Object.keys(CHOICES)) if (CHOICES[k].includes(value[k])) out[k] = value[k];
  }
  return out;
}

export function loadNav() {
  try {
    return normalizeNav(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return { ...NAV_DEFAULTS };
  }
}

export function saveNav(nav) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizeNav(nav)));
  } catch {
    // Storage blocked (a private window): the choice lasts this visit.
  }
}
