import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step } from '../src/engine/fight.mjs';
import { MOVES } from '../src/engine/rules.mjs';
import { readPlayer } from '../src/input/controls.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const advance = (s, n, inputs = {}) => { for (let i = 0; i < n; i++) s = step(s, inputs); return s; };
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } return value; }

test('transitions never mutate deeply frozen state or inputs', () => {
  let s = createFight(); s.p1.x = 51;
  const input = freeze({ p1: { lp: true }, p2: { lp: true } });
  for (let i = 0; i < 50; i++) { const before = JSON.stringify(s); const next = step(freeze(s), input); assert.equal(JSON.stringify(s), before); s = next; }
  assert.ok(s.events.length > 0);
});

for (const [key, rule] of Object.entries(MOVES)) {
  test(`${key}: exact startup, inclusive range, damage and single contact`, () => {
    let s = createFight(); s.p1.x = s.p2.x - rule.range;
    const input = { p1: Object.fromEntries(key.split('+').map((k) => [k, true])) };
    s = step(s, input);
    s = advance(s, rule.startup - 1);
    assert.equal(s.events.length, 0);
    s = step(s, {});
    assert.equal(s.p2.hp, 100 - rule.damage); assert.equal(s.events[0].frame, rule.startup);
    s = advance(s, rule.active + rule.recovery + 1);
    assert.equal(s.events.length, 1);
    let miss = createFight(); miss.p1.x = miss.p2.x - rule.range - 1;
    miss = advance(step(miss, input), rule.startup + rule.active + rule.recovery);
    assert.equal(miss.events.length, 0);
  });
}

test('simultaneous lethal attacks draw and finish the match without later changes', () => {
  let s = createFight(); s.p1.x = 51; s.p1.hp = 5; s.p2.hp = 5; s.roundWins = { p1: 1, p2: 1 };
  s = advance(s, 7, { p1: { lp: true }, p2: { lp: true } });
  assert.equal(s.events.length, 2); assert.equal(s.over, true); assert.equal(s.winner, null);
  assert.deepEqual(s.roundWins, { p1: 2, p2: 2 }); assert.strictEqual(step(s, { p1: { forward: true } }), s);
});

test('pause lasts exactly 90 frames; new-round input applies on frame 91', () => {
  let s = createFight(); s.p1.x = 51; s.p2.hp = 5;
  s = advance(s, 7, { p1: { lp: true } });
  const x = s.p1.x;
  s = advance(s, 90, { p1: { forward: true } });
  assert.equal(s.p1.x, x); assert.equal(s.p2.hp, 0);
  s = step(s, { p1: { forward: true } });
  assert.equal(s.p1.x, -147); assert.equal(s.p2.hp, 100);
});

test('fixed-seed stress sequence preserves stage, hp, integers and determinism', () => {
  let a = createFight(), b = createFight(), rng = 341;
  for (let i = 0; i < 12000; i++) {
    rng = Math.imul(rng, 1664525) + 1013904223 >>> 0;
    const buttons = ['forward', 'back', 'lp', 'rp', 'lk', 'rk'];
    const input = { p1: { [buttons[rng % 6]]: true }, p2: { [buttons[(rng >>> 8) % 6]]: true } };
    a = step(a, input); b = step(b, input);
    for (const p of [a.p1, a.p2]) { assert.ok(p.hp >= 0 && p.hp <= 100); assert.ok(Number.isInteger(p.x)); assert.ok(Math.abs(p.x) <= 400); }
    assert.ok(a.p2.x - a.p1.x >= 60);
  }
  assert.deepEqual(a, b);
});

test('gamepad threshold, d-pad, attack mapping and opposing-input neutralization', () => {
  const pad = { connected: true, axes: [0.5], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
  assert.equal(readPlayer(0, new Set(), pad).forward, false);
  pad.axes[0] = 0.51; assert.equal(readPlayer(0, new Set(), pad).forward, true);
  assert.equal(readPlayer(1, new Set(), pad).back, true);
  pad.buttons[14].pressed = true;
  assert.equal(readPlayer(0, new Set(), pad).forward, false);
  for (const [name, index] of [['lp', 2], ['rp', 3], ['lk', 0], ['rk', 1]]) { pad.buttons[index].pressed = true; assert.equal(readPlayer(0, new Set(), pad)[name], true); }
  assert.equal(readPlayer(0, new Set(['KeyD']), null).forward, true);
});

test('CLI validates the entire file before output and handles malformed values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crt-cli-')), path = join(dir, 'frames.json');
  for (const frames of [[null], [[]], [{ p1: null }], [{ p1: 'lp+lp' }], [{ repeat: null }], [{ repeat: '2' }], [{ p1: 'forward' }, { p2: 'bad' }]]) {
    writeFileSync(path, JSON.stringify({ frames }));
    const r = spawnSync(process.execPath, ['bin/simulate.mjs', path], { encoding: 'utf8' });
    assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.ok(r.stderr.length > 0);
  }
  writeFileSync(path, JSON.stringify({ frames: [{ repeat: 100000 }] }));
  const r = spawnSync(process.execPath, ['bin/simulate.mjs', path], { encoding: 'utf8' });
  assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).frame, 100000);
});
