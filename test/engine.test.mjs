import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, NO_INPUT, roundOver, step } from "../src/engine/fight.mjs";
import { ROUND_PAUSE_FRAMES } from "../src/engine/rules.mjs";

const press = (p1 = {}, p2 = {}) => ({ p1: { ...NO_INPUT, ...p1 }, p2: { ...NO_INPUT, ...p2 } });
const run = (state, inputs, n = 1) => {
  for (let i = 0; i < n; i++) state = step(state, inputs);
  return state;
};
const freeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
};
// Player 1 walks 67 frames: 99 units from player 2, in range of every move.
const close = () => run(createFight(), press({ forward: true }), 67);

test("step never changes the state it is given", () => {
  let s = freeze(close());
  for (const inputs of [press({ lp: true }, { rk: true }), ...Array(30).fill(press())]) s = freeze(step(s, inputs));
  assert.equal(s.p2.hp, 95);
});

test("the same inputs give the same states", () => {
  const script = (s) => run(run(run(s, press({ forward: true }, { back: true }), 40), press({ forward: true, rk: true }, { lk: true })), press({ lp: true }), 200);
  assert.deepEqual(script(createFight()), script(createFight()));
});

test("forward and back together cancel out: no walk, no block", () => {
  const s = step(createFight(), press({ forward: true, back: true }));
  assert.equal(s.p1.x, -150);
  assert.equal(s.p1.blocking, false);
});

test("several attack buttons: the first of lp, rp, lk, rk counts", () => {
  assert.equal(step(createFight(), press({ rk: true, rp: true })).p1.move.key, "rp");
  assert.equal(step(createFight(), press({ forward: true, rk: true })).p1.move.key, "forward+rk");
});

test("a block is an event of type block, with no damage and blockstun", () => {
  let s = run(createFight(), press({ forward: true }, { back: true }), 151);
  s = run(s, press({ lp: true }, { back: true }), 1);
  s = run(s, press({}, { back: true }), 6);
  assert.deepEqual(s.events, [{ frame: 157, type: "block", attacker: "p1", move: "lp", damage: 0, blocked: true }]);
  assert.equal(s.p2.stun, 8);
  assert.deepEqual(s.p2.hurt, { move: "lp", blocked: true, frames: 8 });
});

test("a double knockout ends the round with no winner, and both win it", () => {
  const s0 = close();
  const low = { ...s0, p1: { ...s0.p1, hp: 5 }, p2: { ...s0.p2, hp: 5 } };
  const s = run(low, press({ lp: true }, { lp: true }), 7);
  assert.deepEqual(s.rounds, [{ winner: null, reason: "ko" }]);
  assert.deepEqual(s.roundWins, { p1: 1, p2: 1 });
  assert.equal(s.pause, ROUND_PAUSE_FRAMES);
  assert.equal(s.endedAt, 73);
  assert.ok(roundOver(s));
});

test("a round with no winner can win the match for the fighter one round ahead", () => {
  const s = run({ ...createFight(), roundWins: { p1: 1, p2: 0 } }, press(), 3600);
  assert.deepEqual([s.over, s.winner, s.roundWins], [true, "p1", { p1: 2, p2: 1 }]);
});

test("the frame counter keeps counting once the match is over, nothing else changes", () => {
  const over = run({ ...createFight(), roundWins: { p1: 1, p2: 1 } }, press(), 3600);
  const later = run(over, press({ forward: true }), 10);
  assert.equal(later.frame, over.frame + 10);
  assert.deepEqual({ ...later, frame: 0 }, { ...over, frame: 0 });
});
