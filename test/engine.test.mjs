// The engine's rules, one test per sentence of ARCHITECTURE.md, "The engine". Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, isFree, step } from "../src/engine/fight.mjs";
import { MOVES } from "../src/engine/rules.mjs";

const NONE = { forward: false, back: false, lp: false, rp: false, lk: false, rk: false };
const hold = (buttons = "") => ({ ...NONE, ...Object.fromEntries(buttons.split("+").filter(Boolean).map((b) => [b, true])) });

/** Steps `n` frames with p1 and p2 holding the buttons given ("forward+rk"); returns the last state and every event. */
function play(state, n, p1 = "", p2 = "") {
  const events = [];
  for (let i = 0; i < n; i++) {
    state = step(state, { p1: hold(p1), p2: hold(p2) });
    events.push(...state.events);
  }
  return { state, events };
}

/** Player 1 walked to 99 units from player 2: every move is in range. */
const close = () => play(createFight(), 67, "forward").state;

test("a round starts with player 1 at -150, player 2 at +150, 100 hp each, no move, no stun", () => {
  const s = createFight();
  assert.deepEqual([s.p1.x, s.p2.x, s.p1.hp, s.p2.hp], [-150, 150, 100, 100]);
  assert.ok(isFree(s.p1) && isFree(s.p2));
});

test("step never changes the state it is given", () => {
  const s = close();
  const copy = structuredClone(s);
  step(s, { p1: hold("lp"), p2: hold("forward") });
  assert.deepEqual(s, copy);
});

test("forward walks 3 units towards the opponent, back 2 away; player 1 moves first", () => {
  assert.equal(play(createFight(), 1, "forward").state.p1.x, -147);
  assert.equal(play(createFight(), 1, "", "forward").state.p2.x, 147);
  assert.equal(play(createFight(), 1, "back", "back").state.p1.x, -152);
  // 63 apart, both walking forward: player 1 stops 60 from player 2's old position, then player 2 stops 60 from it.
  let { state } = play(createFight(), 1, "", "forward");
  ({ state } = play(state, 78, "forward"));
  assert.equal(state.p2.x - state.p1.x, 63);
  ({ state } = play(state, 1, "forward", "forward"));
  assert.deepEqual([state.p1.x, state.p2.x], [87, 147]);
});

test("positions stay within [-400, 400] and at least 60 apart", () => {
  const { state } = play(createFight(), 300, "back", "back");
  assert.deepEqual([state.p1.x, state.p2.x], [-400, 400]);
  const met = play(createFight(), 100, "forward", "forward").state;
  assert.equal(met.p2.x - met.p1.x, 60);
});

test("an attack starts on the frame it is pressed, and the fighter does not walk on it", () => {
  const s = close();
  const { state } = play(s, 1, "forward+lp");
  assert.equal(state.p1.x, s.p1.x);
  assert.deepEqual(state.p1.move, { input: "lp", frame: 0, hit: false });
});

test("rk while holding forward starts the high kick", () => {
  assert.equal(play(close(), 1, "forward+rk").state.p1.move.input, "forward+rk");
  assert.equal(play(close(), 1, "rk").state.p1.move.input, "rk");
});

test("a move hits on its first active frame (frame startup after the one it starts on), once", () => {
  for (const [input, move] of Object.entries(MOVES)) {
    const { state, events } = play(close(), 1, input);
    const rest = play(state, move.startup + move.active + move.recovery);
    const all = [...events, ...rest.events];
    assert.equal(all.length, 1, input);
    assert.equal(all[0].frame, 67 + move.startup, input);
    assert.equal(all[0].damage, move.damage, input);
  }
});

test("a move is over after startup + active + recovery frames, and the fighter is free again", () => {
  const { startup, active, recovery } = MOVES.lp;
  let { state } = play(close(), 1, "lp");
  ({ state } = play(state, startup + active + recovery - 1));
  assert.ok(!isFree(state.p1));
  ({ state } = play(state, 1));
  assert.ok(isFree(state.p1));
});

test("a held attack button starts a new move on the first frame the fighter is free", () => {
  const { events } = play(close(), 40, "lp");
  const { startup, active, recovery } = MOVES.lp;
  const every = startup + active + recovery; // the next punch starts the frame after the last one ends
  assert.deepEqual(events.map((e) => e.frame), [67 + startup, 67 + every + startup]);
});

test("a move hits only within its range", () => {
  const at123 = play(createFight(), 59, "forward").state; // 123 units apart
  assert.equal(at123.p2.x - at123.p1.x, 123);
  assert.equal(play(at123, 40, "rk").events.length, 0); // range 120
  assert.equal(play(at123, 40, "forward+rk").events.length, 1); // range 130
});

test("holding back blocks high and mid moves for no damage and blockstun; lows still hit", () => {
  // Player 2 backs into the wall at 400, player 1 follows to 97 units: in range of every move.
  const atWall = play(createFight(), 151, "forward", "back").state;
  for (const [input, move] of Object.entries(MOVES)) {
    const s = play(atWall, 1, input, "back").state;
    const { state, events } = play(s, move.startup, "", "back");
    const [e] = events;
    assert.equal(e.blocked, move.height !== "low", input);
    assert.equal(e.type, e.blocked ? "block" : "hit", input);
    assert.equal(state.p2.hp, e.blocked ? 100 : 100 - move.damage, input);
    assert.equal(state.p2.stun, e.blocked ? move.blockstun : move.hitstun, input);
  }
});

test("a fighter that is not free cannot block", () => {
  let s = play(close(), 1, "", "rk").state; // player 2 starts a kick, then holds back during it
  s = play(s, 1, "lp", "back").state;
  const { events } = play(s, MOVES.lp.startup, "", "back");
  assert.equal(events[0].type, "hit");
});

test("a hit cancels the defender's move: it does no damage", () => {
  const { state, events } = play(close(), 40, "lp", "rk");
  assert.equal(events.filter((e) => e.attacker === "p2").length, 0);
  assert.equal(state.p1.hp, 100);
});

test("both fighters' hits are resolved together: two attacks can trade", () => {
  const { events } = play(close(), 10, "lp", "lp");
  assert.deepEqual(events.map((e) => [e.frame, e.attacker]), [[73, "p1"], [73, "p2"]]);
});

test("hp never goes below 0, and a knockout ends the round by ko", () => {
  let s = { ...close(), p2: { ...close().p2, hp: 3 } };
  s = play(s, 20, "rk").state;
  assert.equal(s.p2.hp, 0);
  assert.deepEqual(s.rounds, [{ winner: "p1", reason: "ko" }]);
});

test("both at 0 hp: the round has no winner and both fighters win a round", () => {
  const base = close();
  const s = { ...base, p1: { ...base.p1, hp: 5 }, p2: { ...base.p2, hp: 5 } };
  const { state } = play(s, 10, "lp", "lp");
  assert.deepEqual(state.rounds, [{ winner: null, reason: "ko" }]);
  assert.deepEqual(state.roundWins, { p1: 1, p2: 1 });
});

test("after 3600 frames the round ends by time, won by more hp; equal hp gives both a round", () => {
  assert.deepEqual(play(createFight(), 3599).state.rounds, []);
  const draw = play(createFight(), 3600).state;
  assert.deepEqual([draw.rounds, draw.roundWins], [[{ winner: null, reason: "time" }], { p1: 1, p2: 1 }]);
  const one = play(play(close(), 1, "lp").state, 3532).state;
  assert.deepEqual(one.rounds, [{ winner: "p1", reason: "time" }]);
});

test("the 90 frames after a round are a pause: nothing moves, inputs are ignored; then a new round starts", () => {
  const ko = play(close(), 368, "lp").state; // knocked out on frame 434
  assert.equal(ko.frame, 435);
  const paused = play(ko, 90, "forward", "forward");
  assert.deepEqual([paused.state.p1.x, paused.state.p2.x, paused.events], [ko.p1.x, ko.p2.x, []]);
  const next = play(paused.state, 1, "forward").state; // frame 525: the new round's first frame
  assert.deepEqual([next.round, next.roundFrame, next.p1, next.p2.hp], [2, 1, { ...next.p1, hp: 100, x: -147 }, 100]);
});

test("the first fighter to win 2 rounds wins the match; later frames change nothing but the frame count", () => {
  let s = createFight();
  for (let r = 0; r < 2; r++) s = play(play(play(s, 67, "forward").state, 368, "lp").state, 90).state;
  assert.deepEqual([s.over, s.winner, s.roundWins], [true, "p1", { p1: 2, p2: 0 }]);
  const later = play(s, 200, "lp", "forward").state;
  assert.deepEqual({ ...later, frame: s.frame }, { ...s, events: [] });
});

test("both reaching 2 rounds together ends the match with no winner", () => {
  const s = play(play(play(createFight(), 3600).state, 90).state, 3600).state;
  assert.deepEqual([s.over, s.winner, s.roundWins], [true, null, { p1: 2, p2: 2 }]);
});

test("the same inputs give the same states", () => {
  const run = () => play(play(close(), 30, "forward+rk", "lk").state, 200, "lp", "back").state;
  assert.deepEqual(run(), run());
});
