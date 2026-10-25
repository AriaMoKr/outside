// The dev server (common's tools/serve.mjs) for public/ on outside's port: node tools/serve.mjs
// [--port 8090] [--host 0.0.0.0]. WebXR needs a secure context: http://localhost counts as one. A
// headset on the LAN can reach it over `adb reverse tcp:8090 tcp:8090`. The tools that render in a
// browser (preview.mjs, hallway-view.mjs) import serve() and PUBLIC from here, to serve a folder on
// a free port of their own.
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, start } from 'common/tools/serve.mjs';

export { serve };
export const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  await start(process.argv.slice(2), { root: PUBLIC, port: 8090 });
}
