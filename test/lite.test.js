// The garden drawn lighter (public/js/lite.js): all of it on a TV, and any of it with ?lite= elsewhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LITE, liteParts } from '../public/js/lite.js';

const ALL = Object.keys(LITE);

test('a TV has every lighter version; a browser none, unless asked', () => {
  assert.deepEqual([...liteParts('', true)], ALL);
  assert.deepEqual([...liteParts('?lite=water', true)], ALL);
  assert.deepEqual([...liteParts('', false)], []);
  assert.deepEqual([...liteParts('?room=k3vd-q8hn', false)], []);
});

test('?lite= asks for some of them, or all, and passes over what it does not know', () => {
  assert.deepEqual([...liteParts('?lite=water,ground', false)], ['water', 'ground']);
  assert.deepEqual([...liteParts('?lite=all', false)], ALL);
  assert.deepEqual([...liteParts('?lite=card,%20ratio&tv=no', false)], ['card', 'ratio']);
  assert.deepEqual([...liteParts('?lite=toString,constructor,sky', false)], []);
  assert.deepEqual([...liteParts('?lite=', false)], []);
});

test('each lighter version is used where it is named', () => {
  const src = (f) => readFileSync(new URL(`../public/js/${f}`, import.meta.url), 'utf8');
  const main = src('main.js'), scene = src('scene.js');
  for (const name of ['ratio', 'filter', 'card']) assert.match(main, new RegExp(`lite\\.has\\('${name}'\\)`), name);
  for (const name of ['water', 'ground']) assert.match(scene, new RegExp(`lite\\.has\\('${name}'\\)`), name);
  assert.match(readFileSync(new URL('../public/css/style.css', import.meta.url), 'utf8'), /html\.lite-card \.card/);
});
