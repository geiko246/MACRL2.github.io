// Screenshot the cart-pole chapter (light + dark), with demos populated.
// Dev-only; needs node_modules/puppeteer. Serves repo root.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PORT = 8097;
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf' };

const server = await new Promise((resolve) => {
  const s = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
      if (p.endsWith('/')) p += 'index.html';
      const fp = normalize(join(ROOT, p));
      if (!fp.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(fp);
      res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end('nf'); }
  });
  s.listen(PORT, '127.0.0.1', () => resolve(s));
});

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 880, height: 1200, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${PORT}/dist/02-cartpole/index.html`, { waitUntil: 'networkidle0' });
  // Scroll through to mount every demo.
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 250) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); }
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 900));
  // Populate the learning curve: click its "run 30" button a couple times.
  await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('button')].filter(b => /run 30/i.test(b.textContent));
    for (const b of btns) { b.click(); await new Promise(r => setTimeout(r, 50)); b.click(); }
  });
  // Render one sim frame (step a few times for a slightly leaned pose).
  await page.evaluate(async () => {
    const play = [...document.querySelectorAll('button')].find(b => /^play$/i.test(b.textContent.trim()));
    if (play) play.click();
    await new Promise(r => setTimeout(r, 700));
    const pause = [...document.querySelectorAll('button')].find(b => /^pause$/i.test(b.textContent.trim()));
    if (pause) pause.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: 'cartpole-light.png', fullPage: true });
  // Dark theme.
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); window.dispatchEvent(new CustomEvent('themechange')); });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'cartpole-dark.png', fullPage: true });
  console.log('SHOTS_OK');
} finally {
  await browser.close();
  server.close();
}
