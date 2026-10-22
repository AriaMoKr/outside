// This garden in the Hallway's door contract (common/door.js, which has the contract's own tests):
// the hallway's door to here, as the hallway makes its link, read back here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorLink, hallwayUrl, hallwayViews, readVisit, wayBack, withoutVisit } from 'common/door.js';
import { HALLWAY_DOOR, OUTSIDE_ID } from '../public/js/way.js';

const HALL = { doorWidth: 1.1, doorHeight: 2.25 };
const pose = { across: 0.12, yaw: (-8 * Math.PI) / 180, pitch: (-3 * Math.PI) / 180 };
/** The hallway's door to here, walked through, as the visitor arrives here. */
const arrive = (here, room = null) => new URL(doorLink(HALLWAY_DOOR, { here, hall: HALL, pose, room }));

test('through the hallway\'s door: the visit, and the way back to that door, with the hall seen out of it', () => {
  const url = arrive('https://ariamokr.github.io/hallway/', 'k3vd-q8hn');
  assert.equal(url.origin + url.pathname, HALLWAY_DOOR.url);
  const v = readVisit(url.search);
  assert.equal(v.dx, 0.12);
  assert.equal(v.glow, HALLWAY_DOOR.color);
  const way = wayBack(url.search, OUTSIDE_ID, { origin: url.origin });
  assert.equal(way.hallway, true);
  assert.equal(way.url, 'https://ariamokr.github.io/hallway/?from=outside&room=k3vd-q8hn');
  assert.deepEqual(hallwayViews(way, OUTSIDE_ID), { views: 'https://ariamokr.github.io/hallway/views/views.json', id: OUTSIDE_ID });
  assert.equal(withoutVisit(url.href), '/outside/?room=k3vd-q8hn');
});

test('from the dev servers, the hallway\'s (8088) to this garden\'s (8090), the way back is the hallway too', () => {
  const url = arrive('http://localhost:8088/');
  const way = wayBack(url.search, OUTSIDE_ID, { origin: 'http://localhost:8090' });
  assert.equal(way.hallway, true);
  assert.equal(way.url, 'http://localhost:8088/?from=outside');
});

test('without a door\'s link, the way back is the hallway, in front of the door to here', () => {
  const way = wayBack('', OUTSIDE_ID, { origin: 'https://ariamokr.github.io' });
  assert.equal(way.url, hallwayUrl(OUTSIDE_ID));
  assert.equal(way.url, 'https://ariamokr.github.io/hallway/?from=outside');
  assert.equal(hallwayViews(way, OUTSIDE_ID).id, OUTSIDE_ID);
});
