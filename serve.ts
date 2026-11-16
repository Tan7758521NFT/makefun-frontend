// Development-only static server for app/ (Node 22, standard library only).
// Usage: `node serve.ts` then open http://localhost:8080 (or --port <n>).
// It serves nothing outside app/ and is not part of the submission: main.ts
// copies only app/ and screenshots/ into the output directory.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

function mimeFor(file: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  };
  return types[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

const portArg = process.argv.indexOf('--port');
const port = portArg === -1 ? 8080 : Number(process.argv[portArg + 1]) || 8080;

createServer(async (req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  const target = resolve(join(appRoot, pathname === '/' ? 'index.html' : decodeURIComponent(pathname)));
  if (!target.startsWith(appRoot + '/') && target !== appRoot) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': mimeFor(target), 'content-length': body.length, 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`serving app/ at http://127.0.0.1:${port}`);
});
