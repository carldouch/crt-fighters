import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step } from '../src/engine/fight.mjs';
import { MOVES, ROUND_FRAMES } from '../src/engine/rules.mjs';
import { parseReplay, replay } from '../src/engine/replay.mjs';

const advance = (state, n, inputs = {}) => { for (let i = 0; i < n; i++) state = step(state, inputs); return state; };
const close = (distance = 60) => { const s = createFight(); s.p1.x = 0; s.p2.x = distance; return s; };
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

test('step accepts deeply frozen inputs and preserves all earlier states', () => {
  let s = freeze(close()); const history = [];
  const input = freeze({ p1: { lp: true }, p2: { rk: true } });
  for (let i = 0; i < 120; i++) { history.push([s, JSON.stringify(s)]); s = freeze(step(s, input)); }
  for (const [old, json] of history) assert.equal(JSON.stringify(old), json);
});

for (const [key, move] of Object.entries(MOVES)) {
  const input = { p1: { [key === 'forward+rk' ? 'rk' : key]: true, ...(key === 'forward+rk' ? { forward: true } : {}) } };
  test(`${key}: exact startup, inclusive range, recovery and repeat boundary`, () => {
    let s = advance(close(move.range), move.startup, input);
    assert.equal(s.events.length, 0);
    s = step(s, input);
    assert.equal(s.events[0].frame, move.startup);
    assert.equal(s.p2.hp, 100 - move.damage);
    const length = move.startup + move.active + move.recovery;
    s = advance(s, length - move.startup - 1, input);
    assert.equal(s.events.length, 1);
    assert.equal(s.p1.move.frame, length - 1);
    s = step(s, input);
    assert.equal(s.p1.move.frame, 0);
    s = advance(s, move.startup, input);
    assert.equal(s.events[1].frame, length + move.startup);
    assert.equal(advance(close(move.range + 1), length, input).events.length, 0);
  });
  test(`${key}: entering range on last active frame hits; following frame misses`, () => {
    const f = close(move.range + 3);
    let s = step(f, input);
    s = advance(s, move.startup + move.active - 2);
    s = step(s, { p2: { forward: true } });
    assert.equal(s.events.length, 1);
    assert.equal(s.events[0].frame, move.startup + move.active - 1);
    let late = advance(step(f, input), move.startup + move.active - 1);
    late = step(late, { p2: { forward: true } });
    assert.equal(late.events.length, 0);
  });
}

test('hitstun decrements before input: defender can act exactly when it reaches zero', () => {
  let s = advance(close(), 7, { p1: { lp: true } });
  assert.equal(s.p2.stun, 12);
  s = advance(s, 11, { p2: { rp: true } });
  assert.equal(s.p2.move, null);
  assert.equal(s.p2.stun, 1);
  s = step(s, { p2: { rp: true } });
  assert.equal(s.p2.move.key, 'rp');
  assert.equal(s.p2.move.frame, 0);
});

test('blockstun prevents walking until recovery, high kick blocks and low kick breaks guard', () => {
  let s = close(60); s.p1.x = 340; s.p2.x = 400;
  s = advance(s, 16, { p1: { forward: true, rk: true }, p2: { back: true } });
  assert.equal(s.events[0].blocked, true); assert.equal(s.p2.hp, 100); assert.equal(s.p2.stun, 14);
  const x = s.p2.x;
  s = advance(s, 13, { p2: { forward: true } }); assert.equal(s.p2.x, x);
  // There is no space forward at MIN_DISTANCE; backing at the left fighter demonstrates recovery.
  s = step(s, { p2: { rp: true } }); assert.equal(s.p2.move.key, 'rp');
  let low = close(); low.p1.x = 340; low.p2.x = 400;
  low = advance(low, 11, { p1: { lk: true }, p2: { back: true } });
  assert.equal(low.events[0].blocked, false); assert.equal(low.p2.hp, 93);
});

test('simultaneous lethal trades award both players and draw the match at two wins', () => {
  let s = close(); s.p1.hp = s.p2.hp = 5;
  s.roundWins = { p1: 1, p2: 1 };
  s = advance(s, 7, { p1: { lp: true }, p2: { lp: true } });
  assert.deepEqual(s.events.map((e) => e.attacker), ['p1', 'p2']);
  assert.deepEqual(s.roundWins, { p1: 2, p2: 2 });
  assert.equal(s.phase, 'over'); assert.equal(s.winner, null);
  assert.equal(step(freeze(s), { p1: { forward: true } }), s);
});

test('KO on final clock frame takes precedence over time', () => {
  let s = close(); s.p2.hp = 5; s.roundFrame = ROUND_FRAMES - 7;
  s = advance(s, 7, { p1: { lp: true } });
  assert.equal(s.rounds[0].reason, 'ko');
});

test('all 90 pause frames ignore inputs; frame 91 resets and acts', () => {
  let s = close(); s.p2.hp = 5; s = advance(s, 7, { p1: { lp: true } });
  const ko = s;
  s = advance(s, 90, { p1: { forward: true, rk: true }, p2: { forward: true } });
  assert.deepEqual(s.p1, ko.p1); assert.deepEqual(s.p2, ko.p2); assert.equal(s.pause, 0);
  s = step(s, { p1: { forward: true } });
  assert.equal(s.p1.x, -147); assert.equal(s.p2.x, 150); assert.equal(s.roundFrame, 1); assert.equal(s.p2.hp, 100);
});

test('unequal wins followed by a tied round give the leading player the match', () => {
  let s = createFight(); s.roundWins = { p1: 1, p2: 0 }; s.roundFrame = 3599;
  s = step(s); assert.equal(s.winner, 'p1'); assert.equal(s.phase, 'over');
});

test('replays count supplied frames after the engine freezes', () => {
  const result = replay({ frames: Array.from({ length: 10 }, () => ({ repeat: 100000 })) });
  assert.equal(result.frame, 1000000); assert.deepEqual(result.roundWins, { p1: 2, p2: 2 });
});

test('strict replay validation rejects nested, malformed and contradictory input', () => {
  for (const value of [null, [], 3, { frames: null }, { frames: [null] }, { frames: [[]] },
    ...[null, 1, [], {}, 'lp+', '+lp', 'lp+lp', 'constructor', '__proto__', 'forward+back', 'lp+rp'].map((p1) => ({ frames: [{ p1 }] })),
    ...[null, true, '2', 0, -1, 2.5, 100001].map((repeat) => ({ frames: [{ repeat }] }))]) {
    assert.throws(() => parseReplay(value));
  }
  assert.throws(() => parseReplay({ frames: [...Array(10).fill({ repeat: 100000 }), {}] }));
  assert.equal(parseReplay({ frames: [{ p1: 'forward+lp', p2: 'back+rk' }] }).length, 1);
});

test('seeded mixed inputs preserve position, health and determinism over many matches', () => {
  let seed = 146;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const buttons = ['', 'forward', 'back', 'lp', 'rp', 'lk', 'rk', 'forward+rk'];
  for (let match = 0; match < 12; match++) {
    let a = createFight(), b = createFight();
    for (let frame = 0; frame < 10000; frame++) {
      const make = () => Object.fromEntries(buttons[(next() >>> 16) % buttons.length].split('+').filter(Boolean).map((key) => [key, true]));
      const inputs = { p1: make(), p2: make() }; a = step(a, inputs); b = step(b, inputs);
      assert.ok(a.p1.x >= -400 && a.p2.x <= 400 && a.p2.x - a.p1.x >= 60);
      for (const id of ['p1', 'p2']) assert.ok(Number.isInteger(a[id].x) && a[id].hp >= 0 && a[id].hp <= 100 && a[id].stun >= 0);
      if (a.phase === 'over') break;
    }
    assert.deepEqual(a, b);
  }
});
