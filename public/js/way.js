// This garden in the Hallway's door contract: its id there, the glow of its door, and the door
// the hallway has to here. The contract itself (reading a visit, the way back, the view from the
// hallway's door) is AriaMoKr/common's door.js. Pure, for the tests.

/** This garden's id: the hallway's door here is `outside`, and the way back is ?from=outside. */
export const OUTSIDE_ID = 'outside';
/** The door back's glow when the link gives none: the green of the hallway's door to here. */
export const DEFAULT_GLOW = '#9fd07a';

/**
 * This garden's door in the hallway: the same as its entry in the hallway's environments.js (its
 * README, "Adding a door": the title the repository's name, the subtitle the page's description
 * word for word). tools/hallway-view.mjs renders the hall with it, to show through the door back
 * here; README.md, "The door in the hallway", shows it.
 */
export const HALLWAY_DOOR = {
  id: OUTSIDE_ID,
  title: 'outside',
  subtitle: "A small garden outside one of the hallway's doors: a lawn, a stream and a pond, a foot bridge, and a bench to sit and read on. Walk it in VR on a Meta Quest, on a desktop or on a phone.",
  sign: 'Garden',
  url: 'https://ariamokr.github.io/outside/',
  preview: 'https://ariamokr.github.io/outside/hallway-preview.jpg',
  color: DEFAULT_GLOW,
};
