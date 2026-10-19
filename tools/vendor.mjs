// Copies the browser modules the page imports from node_modules into public/vendor/, so public/ is
// the whole site: served as it is by tools/serve.mjs and published as it is to GitHub Pages.
// Runs after `npm install` (postinstall). IWER (a devDependency, for ?xr=emulate) is copied when
// installed and skipped otherwise. The import map in index.html maps the bare names to the copies.
import { copyFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'vendor');

// `dir` copies every module of a folder (its modules import each other by relative path).
const FILES = [
  // three.module.js imports three.core.js.
  { from: 'three/build/three.module.js', to: 'three/build/three.module.js' },
  { from: 'three/build/three.core.js', to: 'three/build/three.core.js' },
  { from: 'three/LICENSE', to: 'three/LICENSE' },
  { from: 'iwer/build/iwer.module.js', to: 'iwer/iwer.module.js', optional: true },
  // The shared session (AriaMoKr/layersharedsession) and what it runs on: Trystero, whose default
  // strategy (Nostr) imports @trystero-p2p/core and @noble/secp256k1.
  { dir: 'layersharedsession/public/js', to: 'layersharedsession', ext: '.js' },
  { from: 'layersharedsession/LICENSE', to: 'layersharedsession/LICENSE' },
  { dir: '@trystero-p2p/core/dist', to: 'trystero-core', ext: '.mjs' },
  { from: '@trystero-p2p/core/LICENSE', to: 'trystero-core/LICENSE', optional: true },
  { from: '@trystero-p2p/nostr/dist/index.mjs', to: 'trystero-nostr/index.mjs' },
  { from: '@trystero-p2p/nostr/LICENSE', to: 'trystero-nostr/LICENSE', optional: true },
  { from: 'trystero/LICENSE', to: 'trystero-nostr/LICENSE.trystero', optional: true },
  { from: '@noble/secp256k1/index.js', to: 'noble-secp256k1/index.js' },
  { from: '@noble/secp256k1/LICENSE', to: 'noble-secp256k1/LICENSE', optional: true },
];

function copy(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

rmSync(out, { recursive: true, force: true });
for (const f of FILES) {
  const src = join(root, 'node_modules', f.dir || f.from);
  if (!existsSync(src)) {
    if (f.optional) continue;
    throw new Error(`vendor: ${f.dir || f.from} is missing; run npm install`);
  }
  if (f.dir) {
    for (const name of readdirSync(src)) if (name.endsWith(f.ext)) copy(join(src, name), join(out, f.to, name));
  } else {
    copy(src, join(out, f.to));
  }
}
console.log(`vendor: copied into ${out}`);
