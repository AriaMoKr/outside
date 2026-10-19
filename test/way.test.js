// How the visitor came, and the way back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HALLWAY_URL, OUTSIDE_ID, hallwayViews, keptWay, leaveUrl, readVisit, viewParams, wayBack, withoutVisit } from '../public/js/way.js';

const ORIGIN = 'https://ariamokr.github.io';
const BACK = 'https://ariamokr.github.io/hallway/?from=outside';
const door = (extra = '') => `?from=hallway&back=${encodeURIComponent(BACK)}&dx=0.12&yaw=-8&pitch=-3&dw=1.1&dh=2.25&glow=9FD07A${extra}`;

test('a door\'s link: where the visitor went through, which way they faced, the doorway', () => {
  const v = readVisit(door());
  assert.equal(v.from, 'hallway');
  assert.equal(v.dx, 0.12);
  assert.ok(Math.abs(v.yaw - (-8 * Math.PI) / 180) < 1e-12);
  assert.ok(Math.abs(v.pitch - (-3 * Math.PI) / 180) < 1e-12);
  assert.equal(v.dw, 1.1);
  assert.equal(v.dh, 2.25);
  assert.equal(v.glow, '#9fd07a');
});

test('what a link leaves out, or gets wrong, is null or kept in range', () => {
  const v = readVisit('?from=hallway&yaw=abc&pitch=&dx=7&dw=0.1&glow=red');
  assert.equal(v.yaw, null);
  assert.equal(v.pitch, null);
  assert.equal(v.dx, 1.2);
  assert.equal(v.dw, 0.7);
  assert.equal(v.dh, null);
  assert.equal(v.glow, null);
  assert.equal(readVisit('').from, null);
});

test('the way back is the hallway\'s own link, and called the Hallway', () => {
  const w = wayBack(door(), ORIGIN);
  assert.equal(w.url, BACK);
  assert.equal(w.label, '← Hallway');
  assert.equal(w.hallway, true);
  // The dev servers: the hallway's, on another port of this machine, counts too.
  const dev = wayBack(`?from=hallway&back=${encodeURIComponent('http://localhost:8088/?from=outside')}`, 'http://localhost:8090');
  assert.equal(dev.hallway, true);
  // But not a page on this machine linked from the published garden.
  const mixed = wayBack(`?from=hallway&back=${encodeURIComponent('http://localhost:8088/?from=outside')}`, ORIGIN);
  assert.equal(mixed.hallway, false);
});

test('with no link, or a broken one, the door leads to the hallway', () => {
  for (const search of ['', '?from=hallway', '?back=javascript%3Aalert(1)', '?back=%3A%3A']) {
    const w = wayBack(search, ORIGIN);
    assert.equal(w.url, HALLWAY_URL, search);
    assert.equal(w.hallway, true);
  }
});

test('anywhere else is named by its host, never as the hallway', () => {
  const w = wayBack(`?from=hallway&back=${encodeURIComponent('https://example.org/elsewhere/')}`, ORIGIN);
  assert.equal(w.hallway, false);
  assert.equal(w.label, '← example.org');
  assert.equal(w.url, 'https://example.org/elsewhere/');
  const notFromHallway = wayBack(`?back=${encodeURIComponent(BACK)}`, ORIGIN);
  assert.equal(notFromHallway.hallway, false);
});

test('a kept way back is checked before it is used', () => {
  const w = wayBack(door(), ORIGIN);
  assert.deepEqual(keptWay(JSON.stringify(w)), w);
  assert.equal(keptWay('{"url":"javascript:alert(1)","label":"x","title":"x","name":"x","host":"x"}'), null);
  assert.equal(keptWay('not json'), null);
  assert.equal(keptWay('null'), null);
  assert.equal(keptWay(JSON.stringify({ ...w, label: '' })), null);
});

test('the address loses what the door added, and keeps the rest', () => {
  assert.equal(withoutVisit(`https://ariamokr.github.io/outside/${door('&room=k3vd-q8hn')}#x`), '/outside/?room=k3vd-q8hn#x');
  assert.equal(withoutVisit('https://ariamokr.github.io/outside/?xr=emulate&dx=1'), '/outside/?xr=emulate');
  assert.equal(withoutVisit('https://ariamokr.github.io/outside/'), '/outside/');
});

test('going back carries the shared session, or leaves it', () => {
  const w = wayBack(door(), ORIGIN);
  assert.equal(leaveUrl(w, 'k3vd-q8hn'), `${BACK}&room=k3vd-q8hn`);
  const inRoom = { ...w, url: `${BACK}&room=old1-old2` };
  assert.equal(leaveUrl(inRoom, null), BACK);
  assert.equal(leaveUrl(inRoom, 'new1-new2'), `${BACK}&room=new1-new2`);
});

test('the hallway\'s view from its door to here: its views.json beside the way back, under this garden\'s id', () => {
  assert.deepEqual(hallwayViews(wayBack(door(), ORIGIN)), { views: 'https://ariamokr.github.io/hallway/views/views.json', id: 'outside' });
  assert.deepEqual(hallwayViews(wayBack('', ORIGIN)), { views: 'https://ariamokr.github.io/hallway/views/views.json', id: OUTSIDE_ID });
  assert.equal(hallwayViews(wayBack(`?back=${encodeURIComponent('https://example.org/')}`, ORIGIN)), null);
});

test('a view\'s parameters are checked', () => {
  const ok = { image: 'outside.jpg', depth: 2.94, pictureHeight: 6.5, eye: 1.6, horizon: 0.6154, aspect: 2 };
  assert.deepEqual(viewParams(ok), ok);
  assert.equal(viewParams({ ...ok, depth: 500 }), null);
  assert.equal(viewParams({ ...ok, image: '' }), null);
  assert.equal(viewParams(null), null);
  assert.deepEqual(viewParams({ ...ok, aspect: undefined }), ok);
});
