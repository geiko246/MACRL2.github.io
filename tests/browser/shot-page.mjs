// Screenshot any local dist page in light + dark. Dev-only; needs puppeteer.
// Usage: node tests/browser/shot-page.mjs <dist-path> <out-prefix>
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer';
const ROOT = process.cwd(), PORT = 8096;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json' };
const path = process.argv[2] || '/dist/cartpole/index.html';
const prefix = process.argv[3] || 'cartpole-page';
const server = await new Promise((res) => {
  const s = http.createServer(async (req, rs) => {
    try { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/favicon.ico') { rs.writeHead(204).end(); return; }
      if (p.endsWith('/')) p += 'index.html'; const fp = normalize(join(ROOT, p));
      if (!fp.startsWith(ROOT)) { rs.writeHead(403).end(); return; }
      const b = await readFile(fp); rs.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' }); rs.end(b);
    } catch { rs.writeHead(404).end('nf'); }
  }); s.listen(PORT, '127.0.0.1', () => res(s));
});
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 820, height: 700, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: `${prefix}-light.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); window.dispatchEvent(new CustomEvent('themechange')); });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${prefix}-dark.png`, fullPage: true });
  console.log('SHOTS_OK', `${prefix}-light.png`, `${prefix}-dark.png`);
} finally { await browser.close(); server.close(); }
