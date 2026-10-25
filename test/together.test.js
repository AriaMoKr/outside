// The garden's shared session (public/js/together.js): layersharedsession's controller for the page
// `outside`, its rings on the garden's ground, and the garden's words for its notices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { APP_ID, gardenTogether, noticeText } from '../public/js/together.js';
import { OUTSIDE_ID } from '../public/js/way.js';

test('the notices, in the garden\'s words', () => {
  const ann = (page) => ({ peerId: 'p1', name: 'Ann', page });
  assert.equal(noticeText({ kind: 'join', peer: ann(OUTSIDE_ID) }), 'Ann is here');
  assert.equal(noticeText({ kind: 'join', peer: ann('hallway') }), 'Ann is in the session, in hallway');
  assert.equal(noticeText({ kind: 'arrive', peer: ann(OUTSIDE_ID), from: 'hallway' }), 'Ann came out into the garden');
  assert.equal(noticeText({ kind: 'leave', peer: { peerId: 'p2', name: '', page: null } }), 'Someone left the session');
  assert.equal(noticeText({ kind: 'wave', peer: ann(OUTSIDE_ID) }), 'Ann waved');
  assert.equal(noticeText({ kind: 'wave', peer: ann('hallway') }), 'Ann waved, in hallway');
  assert.equal(noticeText({ kind: 'something new', peer: ann(OUTSIDE_ID) }), null);
});

test('the session for this page: the sites\' app id, out of a session until one starts', () => {
  assert.equal(APP_ID, 'ariamokr-layersharedsession-test');
  const scene = new THREE.Scene();
  const together = gardenTogether({ scene, camera: new THREE.PerspectiveCamera(), renderer: null, hands: () => [], ground: () => 0.2 });
  assert.equal(together.active, false);
  assert.equal(together.inviteLink, '');
  assert.equal(together.wave(), false, 'no one to wave to');
  assert.deepEqual(together.company(), { here: 0, nearby: 0, away: 0, connecting: 0 });
  assert.ok(together.avatars, 'the others are drawn');
  assert.ok(scene.children.includes(together.avatars.group), 'in the garden\'s scene');
});
