// Serves the app. Everything else runs in the browser, so no API keys or costs.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // HOST=0.0.0.0 to open it from your phone on the same Wi-Fi
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  const file = path.join(root, path.normalize(pathname === '/' ? '/index.html' : pathname));
  const data = file.startsWith(root) && await fs.readFile(file).catch(() => null);
  if (!data) return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
}).listen(PORT, HOST, () => console.log(`FORGE running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
