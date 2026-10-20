// The engine's rules frame by frame, beyond what the round's checks cover: stun lengths, blockstun,
// what the page may send that a file never does, and what the page reads from the state.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, isActive, moveOf, step } from "../src/engine/fight.mjs";
import { MOVES, ROUND_PAUSE_FRAMES } from "../src/engine/rules.mjs";

const NONE = {};
const held = (s) => Object.fromEntries(s.split("+").filter(Boolean).map((b) => [b, true]));
/** Steps `state` through [p1, p2, repeat] rows of buttons written as in an input file. */
function run(state, rows) {
  for (const [p1 = "", p2 = "", repeat = 1] of rows) for (let i = 0; i < repeat; i++) state = step(state, { p1: held(p1), p2: held(p2) });
  return state;
}
const close = () => run(createFight(), [["forward", "", 67]]); // 99 units apart, in range of everything

test("step leaves the state it is given unchanged", () => {
  const a = close();
  const before = JSON.stringify(a);
  run(a, [["lp", "rk", 20]]);
  assert.equal(JSON.stringify(a), before);
});

test("a move is active from its startup frame for its active frames", () => {
  const { startup, active } = MOVES.lp;
  assert.equal(isActive({ key: "lp", frame: startup - 1 }), false);
  assert.equal(isActive({ key: "lp", frame: startup }), true);
  assert.equal(isActive({ key: "lp", frame: startup + active - 1 }), true);
  assert.equal(isActive({ key: "lp", frame: startup + active }), false);
});

test("a hit stuns for hitstun frames: the defender acts again on the hitstun-th frame after it", () => {
  let s = run(close(), [["lp"], ["", "", 6]]); // the punch lands on its 7th frame
  assert.equal(s.events[0]?.type, "hit");
  assert.equal(s.p2.stun, MOVES.lp.hitstun);
  s = run(s, [["", "lp", MOVES.lp.hitstun - 1]]);
  assert.equal(s.p2.move, null, "still stunned");
  s = run(s, [["", "lp"]]);
  assert.equal(s.p2.move?.key, "lp", "free again, the held punch starts");
});

test("a block stuns for blockstun frames, does no damage and cancels nothing", () => {
  // Player 2 backs away from player 1's middle kick for 10 frames, blocking it at 119 units (range 120).
  let s = run(close(), [["rk"], ["", "", 2], ["", "back", 10]]);
  assert.deepEqual(s.events.map((e) => [e.type, e.damage, e.blocked]), [["block", 0, true]]);
  assert.deepEqual([s.p2.hp, s.p2.stun, s.p2.stunBy], [100, MOVES.rk.blockstun, { type: "block", move: "rk" }]);
  assert.equal(s.p2.blocking, true, "the block was decided this frame, before the hit");
  s = run(s, [["", "back"]]);
  assert.deepEqual([s.p2.blocking, s.p2.walk], [false, 0], "in blockstun it is not free: it neither walks nor blocks");
});

test("the page may hold several attack buttons: lp, rp, lk, rk win in that order, and forward+rk is the high kick", () => {
  assert.equal(moveOf(held("lk+rp")), "rp");
  assert.equal(moveOf(held("rk+forward")), "forward+rk");
  assert.equal(moveOf(held("rk+back")), "rk");
  assert.equal(moveOf(held("forward")), null);
});

test("holding forward and back together neither walks nor blocks", () => {
  const s = run(createFight(), [["forward+back", "forward+back", 10]]);
  assert.deepEqual([s.p1.x, s.p2.x, s.p1.blocking, s.p2.blocking], [-150, 150, false, false]);
});

test("a fighter walking into the wall still walks (and blocks) on that frame", () => {
  const s = run(createFight(), [["back", "", 200]]);
  assert.deepEqual([s.p1.x, s.p1.walk, s.p1.blocking], [-400, -1, true]);
});

test("events are numbered by the frame they happen on, player 1's first", () => {
  const s = run(close(), [["lp", "lp"], ["", "", 6]]);
  assert.deepEqual(s.events.map((e) => [e.frame, e.attacker]), [[73, "p1"], [73, "p2"]]);
  assert.equal(s.frame, 74);
});

test("during the pause nothing moves and inputs are ignored; the next round starts the frame after it", () => {
  let s = run(close(), [["lp", "", 368]]); // a knockout on frame 434
  assert.deepEqual([s.ended, s.over, s.pause, s.round], [true, false, ROUND_PAUSE_FRAMES, 1]);
  s = run(s, [["back", "forward+lp", ROUND_PAUSE_FRAMES]]);
  assert.deepEqual([s.p1.x, s.p2.x, s.p2.hp, s.round, s.ended], [51, 150, 0, 1, true]);
  s = run(s, [["back"]]);
  assert.deepEqual([s.p1.x, s.p2.hp, s.round, s.clock, s.ended], [-152, 100, 2, 1, false]);
});

test("a match that is over only counts frames", () => {
  const draw = run(createFight(), [["", "", 3600], ["", "", 90], ["", "", 3600]]);
  assert.deepEqual([draw.over, draw.winner, draw.roundWins], [true, null, { p1: 2, p2: 2 }]);
  const later = run(draw, [["forward", "lp", 50]]);
  assert.deepEqual({ ...later, frame: draw.frame }, { ...draw, events: [] });
  assert.equal(later.frame, draw.frame + 50);
});

test("the same inputs always give the same state", () => {
  const rows = [["forward", "back", 40], ["forward+rk", "lk"], ["lp", "forward", 25], ["back", "rp", 30], ["lk", "back", 60]];
  assert.equal(JSON.stringify(run(createFight(), rows)), JSON.stringify(run(createFight(), rows)));
});

test("an empty input holds nothing", () => {
  assert.deepEqual(step(createFight(), {}).p1.x, -150);
  assert.deepEqual(step(createFight(), { p1: NONE }).p1.x, -150);
});
