// server.js — local dev server (no Vercel login required)
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// Load .env.local
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// Add Express-style helpers to raw Node res object
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json   = (data) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  res.end = res.end.bind(res);
  return res;
}

const server = http.createServer(async (req, res) => {
  wrapRes(res);
  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname.replace(/\/$/, '') || '/';

  // ── API routes ──────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // /api/orders/:id
    const idMatch = pathname.match(/^\/api\/orders\/(.+)$/);
    if (idMatch) {
      req.query = { id: decodeURIComponent(idMatch[1]) };
      try {
        const handler = require('./api/orders/[id].js');
        return handler(req, res);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // /api/orders
    if (pathname === '/api/orders') {
      try {
        const handler = require('./api/orders.js');
        return handler(req, res);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  // ── Static files ─────────────────────────────────────────────
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

  // If path has no extension, try .html
  if (!path.extname(filePath)) filePath += '.html';

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found: ' + pathname);
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(fs.readFileSync(filePath));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  App running at http://localhost:${PORT}\n`);
  // Also show local network IP for phone testing
  try {
    const os      = require('os');
    const ifaces  = os.networkInterfaces();
    Object.values(ifaces).flat().forEach(i => {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`  On your phone:  http://${i.address}:${PORT}\n`);
      }
    });
  } catch {}
});
