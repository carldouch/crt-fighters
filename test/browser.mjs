import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const output = process.env.CRT_ARTIFACTS ?? '/tmp/crt-fighters-review';
mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'native', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('preview did not start')), 10000);
  server.stdout.on('data', (data) => { if (String(data).includes('4173')) { clearTimeout(timer); resolve(); } });
  server.on('error', reject);
  server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`preview exited ${code}`)); });
});
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const foreign = []; const checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:4173/') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url()); });
  await page.addInitScript(() => {
    window.reviewPads = [null, null];
    Object.defineProperty(navigator, 'getGamepads', { value: () => window.reviewPads.map((p, i) => p && ({ index: i, id: `Review ${i}`, connected: true, mapping: 'standard', axes: [p.x, 0], buttons: Array.from({ length: 17 }, (_, n) => ({ pressed: p.buttons.includes(n), value: p.buttons.includes(n) ? 1 : 0 })) })) });
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(() => window.__crt?.ready, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__crt.fight.frame > 90);
  const state = () => page.evaluate(() => structuredClone(window.__crt.fight));
  const hold = async (n) => { const f = (await state()).frame; await page.waitForFunction((until) => window.__crt.fight.frame >= until || window.__crt.fight.phase === 'over', f + n, { timeout: 60000, polling: 20 }); };
  await page.screenshot({ path: `${output}/arena-wide.png` });
  checks.push('loaded offline with software WebGL2');
  if (process.argv.includes('--smoke')) {
    console.log(JSON.stringify({ checks, errors, foreign, state: await state() }));
  } else {
    await page.keyboard.down('KeyD'); await hold(66); await page.keyboard.up('KeyD');
    assert.ok((await state()).p1.x > -20);
    await page.keyboard.down('KeyU');
    await page.waitForFunction(() => window.__crt.fight.phase === 'pause', null, { timeout: 60000, polling: 20 });
    await page.keyboard.up('KeyU');
    await page.screenshot({ path: `${output}/knockout.png` });
    assert.equal((await state()).roundWins.p1, 1);
    await page.waitForFunction(() => window.__crt.fight.phase === 'fight', null, { timeout: 20000, polling: 20 });
    assert.equal((await state()).p2.hp, 100);
    await page.keyboard.down('KeyD'); await hold(68); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyU');
    await page.waitForFunction(() => window.__crt.fight.phase === 'over', null, { timeout: 60000, polling: 20 });
    await page.keyboard.up('KeyU'); assert.equal((await state()).winner, 'p1');
    const ended = await state(); await page.waitForTimeout(300); assert.deepEqual(await state(), ended);
    await page.waitForTimeout(500); await page.screenshot({ path: `${output}/match-win.png` });
    checks.push('two complete keyboard rounds, KO, round reset, match freeze and result');
    await page.getByRole('button', { name: /REMATCH/ }).click();
    assert.equal((await state()).roundWins.p1, 0); assert.equal((await state()).p2.hp, 100);
    checks.push('rematch resets state');
    await page.evaluate(() => { window.reviewPads = [{ x: 1, buttons: [] }, { x: 0, buttons: [14] }]; });
    await hold(42);
    await page.evaluate(() => { window.reviewPads = [{ x: 0, buttons: [2] }, { x: 0, buttons: [] }]; });
    await hold(8); assert.ok((await state()).p2.hp < 100);
    await page.evaluate(() => { window.reviewPads = [{ x: 0, buttons: [] }, { x: 0, buttons: [] }]; });
    await hold(30);
    await page.evaluate(() => { window.reviewPads[1].buttons = [3]; });
    await hold(10); assert.ok((await state()).p1.hp < 100);
    await page.evaluate(() => { window.reviewPads = [null, null]; });
    await hold(30);
    const beforeDisconnect = (await state()).p1.x; await hold(10); assert.equal((await state()).p1.x, beforeDisconnect);
    checks.push('two gamepads: axes, d-pad, both attack slots and disconnection');
    await page.keyboard.down('KeyA'); await hold(5); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const blurredX = (await state()).p1.x; await hold(8); assert.equal((await state()).p1.x, blurredX); await page.keyboard.up('KeyA');
    checks.push('blur releases held input');
    await page.getByRole('button', { name: /CONTROLS/ }).click();
    const paused = await state(); await page.waitForTimeout(250); assert.deepEqual(await state(), paused);
    await page.keyboard.down('KeyD'); await page.keyboard.up('KeyD');
    await page.getByRole('button', { name: /BACK TO THE FIGHT/ }).click();
    const resumedX = (await state()).p1.x; await hold(5); assert.equal((await state()).p1.x, resumedX);
    checks.push('controls dialog pauses; paused inputs do not leak');
    await page.setViewportSize({ width: 960, height: 540 }); await hold(5); await page.screenshot({ path: `${output}/arena-960.png` });
    await page.setViewportSize({ width: 390, height: 844 }); await hold(5); await page.screenshot({ path: `${output}/arena-narrow.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    checks.push('desktop and narrow viewport layout');
    assert.deepEqual(errors, []); assert.deepEqual(foreign, []);
    const report = { checks, errors, foreign, backend: await page.evaluate(() => window.__crt.renderer) };
    writeFileSync(`${output}/browser-review.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  }
} finally { await browser.close(); server.kill(); }
