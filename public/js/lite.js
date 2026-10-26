// The garden drawn lighter, for a TV's GPU (a Mali-G52 in the hallway's TV app): each part that
// costs a frame most, made cheaper. A TV has them all; any browser can have any of them with
// ?lite= (a list, or all), to see that the garden still looks right with it. Pure, tested in Node.

/** Each lighter version, by its name in ?lite=, and what it is. */
export const LITE = Object.freeze({
  ratio: 'drawn at a pixel ratio of 1 (main.js)',
  filter: 'textures filtered at 2x anisotropy, not 8x (main.js)',
  water: "the water's ripples read from a picture of their noise (water.js rippleTexture)",
  ground: "the trail's gravel and the banks' mud read only where they are, and the grass's large-scale variation once a vertex (scene.js GROUND_LITE)",
  card: 'no blur behind the card (style.css html.lite-card)',
});

/**
 * The lighter versions on: on a TV, all; else those ?lite= names (`all`, or a list:
 * `?lite=water,ground`), any other name passed over.
 * @param {string} search location.search
 * @param {boolean} tv the TV app's page (common's tv.js tvMode)
 * @returns {Set<string>}
 */
export function liteParts(search, tv) {
  if (tv) return new Set(Object.keys(LITE));
  const asked = (new URLSearchParams(search).get('lite') ?? '').split(',').map((s) => s.trim());
  if (asked.includes('all')) return new Set(Object.keys(LITE));
  return new Set(asked.filter((n) => Object.hasOwn(LITE, n)));
}
