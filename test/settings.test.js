import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_DEFAULTS, normalizeNav, loadNav } from '../public/js/settings.js';

test('navigation settings: valid values kept, anything else the defaults', () => {
  assert.deepEqual(normalizeNav({ move: 'teleport', turn: 'smooth' }), { move: 'teleport', turn: 'smooth' });
  assert.deepEqual(normalizeNav({ move: 'fly', turn: 'smooth', extra: 1 }), { move: NAV_DEFAULTS.move, turn: 'smooth' });
  assert.deepEqual(normalizeNav(null), NAV_DEFAULTS);
  assert.deepEqual(normalizeNav('teleport'), NAV_DEFAULTS);
});

test('without localStorage (Node, a blocked browser) the defaults load', () => {
  assert.deepEqual(loadNav(), NAV_DEFAULTS);
});
