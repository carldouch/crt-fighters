import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve('dist'), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary' };
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(join(root, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(root + sep) || !existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } }), errors = [], results = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.__crt?.ready, null, { timeout: 90000 });
  for (const selector of ['#restart', '#pause', '#sound']) {
    await page.click('#restart');
    await page.waitForFunction(() => window.__crt.fight.p1.x === -150 && window.__crt.fight.frame < 100);
    if (selector === '#pause') { await page.click('#pause'); await page.click('#pause'); }
    else await page.focus(selector);
    const startFrame = await page.evaluate(() => window.__crt.fight.frame);
    await page.keyboard.down('d');
    await page.waitForFunction((frame) => window.__crt.fight.frame >= frame + 20, startFrame, { timeout: 20000 });
    await page.keyboard.up('d');
    const x = await page.evaluate(() => window.__crt.fight.p1.x);
    assert.ok(x >= -120, `${selector} focus disabled movement: ${x}`);
    results.push({ focusedControl: selector, x, passed: true });
  }
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'typing'; document.body.append(input); input.focus(); });
  const before = await page.evaluate(() => window.__crt.fight.p1.x);
  const editStartFrame = await page.evaluate(() => window.__crt.fight.frame);
  await page.keyboard.down('d');
  await page.waitForFunction((frame) => window.__crt.fight.frame >= frame + 20, editStartFrame, { timeout: 20000 });
  await page.keyboard.up('d');
  const after = await page.evaluate(() => window.__crt.fight.p1.x);
  const editEndFrame = await page.evaluate(() => window.__crt.fight.frame);
  assert.equal(after, before, 'typing in an editable input must not move the fighter');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, editableInput: { before, after, startFrame: editStartFrame, endFrame: editEndFrame, passed: true }, errors }));
} finally { await browser?.close(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
