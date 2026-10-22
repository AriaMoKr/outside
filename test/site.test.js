// The site as published: the page, its modules and imports, the door it would have in the
// hallway, the pictures either side of that door, and what a shared link shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINK_PARAMS, VISIT_PARAMS, hallwayUrl, viewParams } from 'common/door.js';
import { HALLWAY_DOOR, OUTSIDE_ID } from '../public/js/way.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(root, 'index.html'), 'utf8');

test('the page uses relative URLs only, so it works under any path (GitHub Pages: /<repo>/)', () => {
  const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:)/.test(u));
  const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  urls.push(...Object.values(map.imports));
  for (const u of urls) assert.ok(!u.startsWith('/'), `root-relative URL ${u}`);
});

test('without JavaScript, the page still leads back to the hallway', () => {
  const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
  assert.ok(noscript.includes(`href="${hallwayUrl(OUTSIDE_ID)}"`));
});

test('every client module parses', () => {
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const r = spawnSync(process.execPath, ['--check', join(root, 'js', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('client modules import only three, the shared packages and each other', () => {
  const shared = /^(common|layersharedsession)\/[a-z]+\.js$/;
  const { imports } = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  const installed = existsSync(join(root, 'vendor'));
  for (const f of readdirSync(join(root, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(root, 'js', f), 'utf8');
    for (const m of src.matchAll(/(?:^import\s.*?from\s+|import\()'([^']+)'/gms)) {
      assert.ok(m[1] === 'three' || shared.test(m[1]) || m[1].startsWith('./'), `${f} imports ${m[1]}`);
      if (shared.test(m[1]) && installed) {
        const [name, file] = m[1].split('/');
        assert.ok(existsSync(join(root, imports[`${name}/`], file)), `${f} imports ${m[1]}, which is not in vendor/`);
      }
      if (m[1].startsWith('./')) assert.ok(existsSync(join(root, 'js', m[1])), `${f} imports ${m[1]}, which is not there`);
    }
  }
});

test('the import map maps what the page and the shared session load to their copies in vendor/', () => {
  const { imports } = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]);
  assert.deepEqual(Object.keys(imports).sort(), ['@noble/secp256k1', '@trystero-p2p/core', 'common/', 'layersharedsession/', 'three', 'trystero']);
  for (const url of Object.values(imports)) assert.match(url, /^\.\/vendor\//);
  if (!existsSync(join(root, 'vendor'))) return; // not installed yet
  for (const [name, url] of Object.entries(imports)) assert.ok(existsSync(join(root, url)), `${name}: ${url} missing (npm install)`);
});

test('the door the hallway would have to here is a complete entry of its environments.js', () => {
  const e = HALLWAY_DOOR;
  assert.match(e.id, /^[a-z0-9-]+$/);
  assert.ok(e.title && e.subtitle && e.sign);
  assert.equal(new URL(e.url).protocol, 'https:');
  assert.equal(new URL(e.preview).protocol, 'https:');
  assert.match(e.color, /^#[0-9a-f]{6}$/);
  for (const k of new Set([...LINK_PARAMS, ...VISIT_PARAMS])) assert.ok(!new URL(e.url).searchParams.has(k), `its url uses ${k}, which a door adds`);
  // The preview it names is this site's own picture.
  assert.ok(e.preview.startsWith(e.url));
  assert.ok(existsSync(join(root, e.preview.slice(e.url.length))), `${e.preview} is not in public/`);
});

/** A JPEG's width and height, from its start-of-frame marker. */
function jpegSize(file) {
  const b = readFileSync(file);
  for (let i = 2; i < b.length;) {
    const marker = b[i + 1], length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + length;
  }
  return null;
}

test('the pictures either side of the door: the garden for the hallway, 2:1; the hallway for here, with how to hang it', () => {
  const preview = jpegSize(join(root, 'hallway-preview.jpg'));
  assert.equal(preview.width, 2 * preview.height);
  const views = JSON.parse(readFileSync(join(root, 'views', 'views.json'), 'utf8')).views;
  const v = viewParams(views[HALLWAY_DOOR.id]);
  assert.ok(v, 'views.json has a good entry for this door');
  const size = jpegSize(join(root, 'views', v.image));
  assert.ok(Math.abs(size.width / size.height - v.aspect) < 0.01);
});

test('a shared link shows the garden: its address, and the hallway\'s picture of it at the size the page says', () => {
  const meta = (p) => html.match(new RegExp(`<meta (?:property|name)="${p}" content="([^"]*)">`))?.[1];
  assert.equal(meta('og:url'), HALLWAY_DOOR.url);
  assert.equal(meta('og:image'), HALLWAY_DOOR.preview);
  const size = jpegSize(join(root, HALLWAY_DOOR.preview.slice(HALLWAY_DOOR.url.length)));
  assert.equal(Number(meta('og:image:width')), size.width);
  assert.equal(Number(meta('og:image:height')), size.height);
  for (const p of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image:alt', 'twitter:card']) assert.ok(meta(p), `no ${p}`);
});
