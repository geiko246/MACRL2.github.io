// Smoke-test the LIVE deployed chapter (production CDN). Dev-only; needs puppeteer.
import puppeteer from 'puppeteer';
const URL = process.argv[2] || 'https://macrl2.github.io/02-cartpole/';
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 250) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); }
  });
  await new Promise(r => setTimeout(r, 1200));
  const demos = await page.$$eval('.demo', e => e.length);
  const canvases = await page.$$eval('canvas', e => e.length);
  const katex = await page.$$eval('.katex', e => e.length);
  const filtered = errors.filter(e => !/favicon/i.test(e));
  console.log(`LIVE ${URL}`);
  console.log(`  demos=${demos} canvases=${canvases} katex=${katex} consoleErrors=${filtered.length}`);
  if (filtered.length) console.log('  ERRORS:\n' + filtered.map(e => '   ' + e).join('\n'));
  console.log((demos === 4 && canvases >= 3 && katex >= 1 && filtered.length === 0) ? 'LIVE_OK' : 'LIVE_FAIL');
} finally { await browser.close(); }
