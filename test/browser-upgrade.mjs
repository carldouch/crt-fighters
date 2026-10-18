import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = process.env.CRT_ARTIFACTS ?? '/tmp/crt-upgrade-review';
mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'native', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { stdio: ['ignore','pipe','pipe'] });
let browser;
try {
  await new Promise((resolve,reject) => { const timer=setTimeout(()=>reject(new Error('Preview startup timeout')),10000); server.stdout.on('data',data=>{if(String(data).includes('4174')){clearTimeout(timer);resolve();}}); server.on('error',reject); server.on('exit',code=>{clearTimeout(timer);reject(new Error(`Preview exit ${code}`));}); });
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:960,height:640}}); const errors=[];const foreign=[];const checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4174\/|data:|blob:)/.test(r.url()))foreign.push(r.url());});
  await page.addInitScript(()=>{window.reviewPads=[null,null];Object.defineProperty(navigator,'getGamepads',{value:()=>window.reviewPads.map(p=>p&&({connected:true,axes:[p.x,0],buttons:Array.from({length:17},(_,i)=>({pressed:p.buttons.includes(i)}))}))});});
  await page.goto('http://127.0.0.1:4174/');await page.waitForFunction(()=>window.__crt?.ready,null,{timeout:90000});
  const state=()=>page.evaluate(()=>structuredClone(window.__crt.fight));
  const hold=async n=>{const f=(await state()).frame;await page.waitForFunction(end=>window.__crt.fight.frame>=end,f+n,{timeout:60000,polling:20});};
  const restart=async()=>{await page.locator('#restart-match').click();await hold(2);};
  assert.equal(await page.locator('#game-mode').inputValue(),'local');assert.equal(await page.locator('#difficulty').isDisabled(),true);
  for(const [key,move] of [['KeyO','lp'],['KeyP','rp'],['KeyL','lk'],['Semicolon','rk']]){
    await restart();await page.keyboard.down(key);await page.waitForFunction(expected=>window.__crt.fight.p2.move?.key===expected,move);await page.keyboard.up(key);assert.equal((await state()).p1.move,null);
  }
  checks.push('all four MacBook P2 attack mappings; P1 unaffected');
  await restart();await page.keyboard.down('ArrowDown');await page.keyboard.down('KeyO');await hold(5);
  let f=await state();assert.equal(f.p2.blocking,true);assert.equal(f.p2.move,null);assert.ok(f.p2.x>150);assert.equal(await page.locator('#guard2').textContent(),'◈ BLOCKING');
  await page.keyboard.up('ArrowDown');await page.keyboard.up('KeyO');
  await restart();await page.keyboard.down('KeyS');await page.keyboard.down('KeyU');await hold(5);f=await state();assert.equal(f.p1.blocking,true);assert.equal(f.p1.move,null);await page.keyboard.up('KeyS');await page.keyboard.up('KeyU');
  checks.push('dedicated keyboard guard on both players; visible feedback and attack suppression');
  await restart();await page.keyboard.down('KeyD');await page.keyboard.down('ArrowLeft');await hold(42);await page.keyboard.up('KeyD');await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowDown');await page.keyboard.down('KeyK');await hold(17);await page.keyboard.up('KeyK');await page.keyboard.up('ArrowDown');
  f=await state();assert.ok(f.events.some(e=>e.blocked&&e.damage===0));assert.equal(f.p2.hp,100);
  checks.push('live mid-kick blocked without damage');
  await restart();await page.evaluate(()=>{window.reviewPads=[{x:1,buttons:[4,2]},{x:-1,buttons:[4,1]}];});await hold(5);f=await state();
  for(const p of ['p1','p2']){assert.equal(f[p].blocking,true);assert.equal(f[p].move,null);}
  await page.evaluate(()=>{window.reviewPads=[null,null];});await hold(3);assert.equal((await state()).p1.blocking,false);
  checks.push('LB/L1 guard on both pads overrides stick and attacks; disconnect releases guard');
  await page.locator('#game-mode').selectOption('cpu');assert.equal(await page.locator('#difficulty').isEnabled(),true);
  for(const difficulty of ['easy','normal','hard']){
    await page.locator('#difficulty').selectOption(difficulty);await restart();
    await page.keyboard.down('KeyO');await hold(20);await page.keyboard.up('KeyO');assert.equal((await state()).p2.move,null);
    await hold(50);assert.ok((await state()).p2.x<150);assert.equal(await page.locator('#device2').textContent(),`CPU · ${difficulty.toUpperCase()}`);
    assert.deepEqual(await page.evaluate(()=>window.__crt.settings),{mode:'cpu',difficulty,seed:14});
  }
  checks.push('all CPU difficulties select, restart, advance and ignore human P2 attacks');
  await page.locator('#help').click();const paused=await state();await page.waitForTimeout(200);assert.deepEqual(await state(),paused);await page.locator('#resume').click();
  await page.screenshot({path:`${output}/enhanced-cpu.png`});
  await page.locator('#game-mode').selectOption('local');assert.equal((await state()).roundWins.p1,0);assert.equal((await state()).p2.hp,100);assert.equal(await page.locator('#difficulty').isDisabled(),true);
  await page.keyboard.down('KeyO');await page.waitForFunction(()=>window.__crt.fight.p2.move?.key==='lp');await page.keyboard.up('KeyO');
  checks.push('CPU pause freezes state; returning to local restores P2 control and clean score');
  await page.setViewportSize({width:390,height:844});await hold(3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${output}/enhanced-narrow.png`});
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('footer .quick-controls > span')].every(e=>e.getBoundingClientRect().bottom<=innerHeight)),true);
  assert.equal(await page.locator('#game-mode').isVisible(),true);assert.equal(await page.locator('#restart-match').isVisible(),true);
  checks.push('narrow layout keeps setup controls visible without overflow');
  assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);
  const report={checks,errors,foreign,backend:await page.evaluate(()=>window.__crt.renderer)};writeFileSync(`${output}/browser-upgrade.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();server.kill();}
