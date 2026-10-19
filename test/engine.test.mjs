import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step } from '../src/engine/fight.mjs';

const run = (s, inputs, n) => { for (let i = 0; i < n; i++) s = step(s, inputs); return s; };
const close = () => run(createFight(), { p1: { forward: true } }, 67);
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value)) freeze(item); }
  return value;
}
test('transitions accept deeply frozen states and inputs without mutating history', () => {
  const first = freeze(close()), copy = JSON.stringify(first);
  const next = run(first, freeze({ p1: { lp: true }, p2: { lp: true } }), 7);
  assert.equal(JSON.stringify(first), copy);
  assert.equal(next.p1.hp, 95); assert.equal(next.p2.hp, 95);
  assert.equal(next.events.length, 2);
});
test('an attack released immediately still connects once; held attacks restart only after recovery', () => {
  let s = step(close(), { p1: { lp: true } });
  s = run(s, {}, 5); assert.equal(s.events.length, 0);
  s = step(s, {}); assert.equal(s.events.length, 1);
  s = run(s, {}, 30); assert.equal(s.events.length, 1);
  const held = run(close(), { p1: { lp: true } }, 45);
  assert.deepEqual(held.events.map(e => e.frame), [73, 92, 111]);
});
test('a new attack on the exact frame stun expires may act', () => {
  let s = run(close(), { p1: { lp: true } }, 7);
  assert.equal(s.p2.stun, 12);
  s = run(s, { p2: { rp: true } }, 11);
  assert.equal(s.p2.move, null);
  s = step(s, { p2: { rp: true } });
  assert.equal(s.p2.move.key, 'rp'); assert.equal(s.p2.move.frame, 0);
});
test('simultaneous lethal attacks award both fighters a round and preserve both contacts', () => {
  let s = close(); s = { ...s, p1: { ...s.p1, hp: 5 }, p2: { ...s.p2, hp: 5 } };
  s = run(s, { p1: { lp: true }, p2: { lp: true } }, 7);
  assert.equal(s.rounds[0].winner, null);
  assert.deepEqual(s.roundWins, { p1: 1, p2: 1 }); assert.equal(s.events.length, 2);
  s = run(s, {}, 90);
  assert.equal(s.p1.hp, 0);
  s = step(s, {}); assert.equal(s.p1.hp, 100); assert.equal(s.roundFrame, 1);
});
test('a tied match is terminal even though winner is null', () => {
  let s = run(createFight(), {}, 3600 + 90 + 3600);
  assert.equal(s.done, true); assert.equal(s.winner, null);
  assert.deepEqual(s.roundWins, { p1: 2, p2: 2 });
  assert.equal(step(s, { p1: { lp: true } }), s);
});
test('deterministic input stream keeps positions and health bounded', () => {
  let a = createFight(), b = createFight(), seed = 17;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
  for (let i = 0; i < 12000; i++) {
    const buttons = () => ({ forward: rand() % 3 !== 0, back: false, lp: rand() % 4 === 0, rk: rand() % 7 === 0 });
    const input = { p1: buttons(), p2: buttons() };
    a = step(a, input); b = step(b, input);
    assert.equal(a.p1.x <= a.p2.x - 60, true);
    assert.equal(a.p1.x >= -400 && a.p2.x <= 400, true);
    assert.equal(a.p1.hp >= 0 && a.p2.hp >= 0, true);
  }
  assert.deepEqual(a, b);
});
