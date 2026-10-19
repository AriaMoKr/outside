#!/usr/bin/env node
// Renders the hallway as seen out of its door to this garden, for the doorway here to show until
// the hallway publishes that view itself (its README, "The view from your door"). It copies a
// checkout of the hallway (AriaMoKr/hallway, `npm install`ed) to a temporary folder, adds this
// garden's door to the copy's environments.js (public/js/way.js HALLWAY_DOOR; the checkout is not
// touched), serves the copy, and has the hallway render its door views in headless Chrome. It
// writes public/views/outside.jpg and public/views/views.json, in the hallway's own format.
// Run it again when the hallway changes; the files are committed.
//   node tools/hallway-view.mjs [--hallway ../hallway]
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PUBLIC, serve } from './serve.mjs';
import { launchChrome, sleep } from './lib/chrome.mjs';
import { HALLWAY_DOOR } from '../public/js/way.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const hallway = resolve(arg('--hallway', join(PUBLIC, '..', '..', 'hallway')));
const source = join(hallway, 'public');
if (!existsSync(join(source, 'js', 'environments.js')) || !existsSync(join(source, 'vendor', 'three'))) {
  console.error(`No installed hallway at ${hallway} (its public/js/environments.js and public/vendor/, after npm install). --hallway <path> names one.`);
  process.exit(1);
}

const copy = mkdtempSync(join(tmpdir(), 'outside-hallway-'));
cpSync(source, copy, { recursive: true });
// This garden's door, after the others.
const envs = join(copy, 'js', 'environments.js');
const text = readFileSync(envs, 'utf8');
const end = text.lastIndexOf('];');
writeFileSync(envs, `${text.slice(0, end)}  ${JSON.stringify(HALLWAY_DOOR)},\n${text.slice(end)}`);

const server = await serve(copy);
const chrome = await launchChrome();
try {
  const page = await chrome.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, 1500);
  for (let i = 0; i < 100 && !(await page.evaluate('!!window.__hallway')); i++) await sleep(200);
  const views = await page.evaluate('window.__hallway.doorViews(0.88)');
  const mine = views.find((v) => v.id === HALLWAY_DOOR.id);
  if (!mine) throw new Error(`the hallway rendered no view for ${HALLWAY_DOOR.id} (doors: ${views.map((v) => v.id).join(', ')})`);
  const dir = join(PUBLIC, 'views');
  mkdirSync(dir, { recursive: true });
  const bytes = Buffer.from(mine.jpeg.slice(mine.jpeg.indexOf(',') + 1), 'base64');
  writeFileSync(join(dir, `${mine.id}.jpg`), bytes);
  const json = {
    about: 'The view out of the hallway\'s door to this garden, rendered by tools/hallway-view.mjs from a copy of the hallway with that door added: the doorway here shows it until the hallway publishes its own (its README, "The view from your door").',
    views: { [mine.id]: { image: `${mine.id}.jpg`, ...mine.params } },
  };
  writeFileSync(join(dir, 'views.json'), `${JSON.stringify(json, null, 1)}\n`);
  console.log(`${join(dir, `${mine.id}.jpg`)}  ${(bytes.length / 1024).toFixed(0)} kB, ${JSON.stringify(mine.params)}`);
} finally {
  await chrome.close();
  server.close();
  rmSync(copy, { recursive: true, force: true });
}
