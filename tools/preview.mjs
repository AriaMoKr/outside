#!/usr/bin/env node
// Renders the picture the hallway's doorway to here shows (public/js/preview.js) with headless
// Chrome, to public/hallway-preview.jpg: the garden as one sees it coming out of the door. The
// door's entry (README, "A door in the hallway") names it as its `preview`. Run it again after
// changing the garden; the JPEG is committed.
//   node tools/preview.mjs [--out <file>]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC, serve } from './serve.mjs';
import { launchChrome, sleep } from './lib/chrome.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const out = arg('--out', join(PUBLIC, 'hallway-preview.jpg'));

const server = await serve(PUBLIC);
const chrome = await launchChrome();
try {
  const page = await chrome.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`, 1000);
  for (let i = 0; i < 100 && !(await page.evaluate('!!window.__outside')); i++) await sleep(200);
  const { jpeg, params } = await page.evaluate('window.__outside.preview(0.9)');
  const bytes = Buffer.from(jpeg.slice(jpeg.indexOf(',') + 1), 'base64');
  writeFileSync(out, bytes);
  console.log(`${out}  2048 x 1024, ${(bytes.length / 1024).toFixed(0)} kB, hung ${JSON.stringify(params)}`);
} finally {
  await chrome.close();
  server.close();
}
