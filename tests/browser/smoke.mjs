// Local browser smoke harness (dev-only; needs node_modules/puppeteer).
// Serves the repo root, loads a page in headless Chromium, collects console
// errors, and runs a per-page check function. Usage:
//   node tests/browser/smoke.mjs <which>
// where <which> is one of: kit | chapter
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PORT = 8099;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
  '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.map':'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
        if (p.endsWith('/')) p += 'index.html';
        const fp = normalize(join(ROOT, p));
        if (!fp.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        const body = await readFile(fp);
        res.writeHead(200, { 'content-type': MIME[extname(fp)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404).end('not found'); }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const CHECKS = {
  // Verify kit.js lazily mounts a demo and exposes the full ctx.
  async kit(page) {
    await page.goto(`http://127.0.0.1:${PORT}/tests/manual/kit.html`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-mounted="1"]', { timeout: 5000 });
    const mounts = await page.evaluate(() => window.__kitMounts);
    const text = await page.$eval('.demo', el => el.textContent);
    const keys = 'Theme,Plot,Anim,CanvasDraw,integrate,Controls,Diagram,linalg';
    assert(mounts === 1, `expected 1 mount, got ${mounts}`);
    assert(text.includes(`ctx=${keys}`), `ctx keys mismatch: ${text}`);
    return `mounted once; ctx=${keys}`;
  },
  // Verify the cart-pole chapter: 4 demos mount, KaTeX renders, no console errors.
  async chapter(page) {
    await page.goto(`http://127.0.0.1:${PORT}/dist/02-cartpole/index.html`, { waitUntil: 'networkidle0' });
    // Scroll through so IntersectionObserver mounts every demo.
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
      }
    });
    await new Promise(r => setTimeout(r, 800));
    const demoCount = await page.$$eval('.demo', els => els.length);
    const canvases = await page.$$eval('canvas', els => els.length);
    const katex = await page.$$eval('.katex', els => els.length);
    assert(demoCount === 4, `expected 4 .demo, got ${demoCount}`);
    assert(canvases >= 3, `expected >=3 canvases, got ${canvases}`);
    assert(katex >= 1, `expected KaTeX-rendered math, got ${katex}`);
    return `4 demos, ${canvases} canvases, ${katex} math spans`;
  },
  // Verify the researcher journey page: the humanoid-balance demo mounts,
  // renders a canvas, exposes its press controls, and drives without errors.
  async researcher(page) {
    await page.goto(`http://127.0.0.1:${PORT}/dist/researcher/index.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
      }
    });
    await page.waitForSelector('.demo[data-demo="humanoid-balance"] canvas', { timeout: 5000 });
    const buttons = await page.$$eval('.hb-btn', els => els.length);
    const hasReadout = await page.$$eval('.hb-readout', els => els.length);
    assert(buttons === 4, `expected 4 control buttons, got ${buttons}`);
    assert(hasReadout === 1, `expected 1 readout, got ${hasReadout}`);
    // Drive a press-and-release so the input path executes, then confirm the
    // button press armed the keyboard (arrow keys work without clicking the figure).
    await page.evaluate(() => {
      const b = document.querySelector('.hb-btn');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    const armed = await page.evaluate(() =>
      document.activeElement === document.querySelector('.hb-stage'));
    assert(armed, 'button press did not focus the stage (keyboard not armed)');
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('ArrowLeft');
    await new Promise(r => setTimeout(r, 400));
    const readout = await page.$eval('.hb-readout', el => el.textContent);
    assert(/upright|fell/.test(readout), `unexpected readout: "${readout}"`);
    return `humanoid-balance mounted; ${buttons} buttons; readout="${readout}"`;
  },
};

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const which = process.argv[2] || 'kit';
const server = await serve();
const errors = [];
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const summary = await CHECKS[which](page);
  if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); throw new Error('console errors present'); }
  console.log(`SMOKE_OK [${which}]: ${summary}; 0 console errors`);
} finally {
  await browser.close();
  server.close();
}
