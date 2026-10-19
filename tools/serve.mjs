// A static file server for public/, for development: node tools/serve.mjs [--port 8090] [--host 0.0.0.0]
// WebXR needs a secure context: http://localhost counts as one. A headset on the LAN can reach it
// over `adb reverse tcp:8090 tcp:8090`. The tools that render in a browser (preview.mjs,
// hallway-view.mjs) import serve() to serve a folder on a free port of their own.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Serves the folder `root` on host:port (0: a free one); resolves to the listening server. */
export function serve(root, { port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    let file = normalize(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let stat;
    try {
      stat = statSync(file);
      if (stat.isDirectory()) {
        file = join(file, 'index.html');
        stat = statSync(file);
      }
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache',
      // As GitHub Pages does: the hallway reads this site's pictures, and this site the hallway's.
      'access-control-allow-origin': '*',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const port = Number(opt('port', 8090));
  const host = opt('host', 'localhost');
  await serve(PUBLIC, { port, host });
  console.log(`outside: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
}
