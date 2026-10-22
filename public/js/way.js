// This garden in the Hallway's door contract: its id there, the glow of its door, and the door
// the hallway has to here. The contract itself (reading a visit, the way back, the view from the
// hallway's door) is AriaMoKr/common's door.js. Pure, for the tests.

/** This garden's id: the hallway's door here is `outside`, and the way back is ?from=outside. */
export const OUTSIDE_ID = 'outside';
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
