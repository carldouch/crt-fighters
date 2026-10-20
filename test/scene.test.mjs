// The model's clips against the engine's frames, and the controls' mapping. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, step } from "../src/engine/fight.mjs";
import { MOVES } from "../src/engine/rules.mjs";
import { poseOf, strike, STRIKES } from "../src/scene/poses.mjs";
import { createControls, gamepadButtons, keyboardButtons, merge } from "../src/input/controls.mjs";

test("every move's limb is furthest out on the move's first active frame, the frame it hits", () => {
  for (const [input, { startup, active, recovery }] of Object.entries(MOVES)) {
    const at = (frame) => strike({ input, frame });
    assert.equal(at(startup).time, STRIKES[input].contact, input);
    assert.equal(at(startup).lean, 1, input);
    for (let f = 0; f < startup; f++) assert.ok(at(f).time < STRIKES[input].contact, `${input} frame ${f} is before contact`);
    for (let f = 1; f < startup + active + recovery; f++) assert.ok(at(f).time >= at(f - 1).time, `${input} plays forward`);
    assert.ok(Math.abs(at(startup + active + recovery - 1).time - STRIKES[input].end) < 0.1, `${input} ends on guard`);
  }
});

test("a fighter is shown in the clip of what the engine says it is doing", () => {
  const press = (s, p1, p2 = {}) => step(s, { p1, p2 });
  let s = createFight();
  assert.equal(poseOf(s, "p1").clip, "idle");
  s = press(s, { forward: true });
  assert.equal(poseOf(s, "p1").clip, "stepfroward");
  s = press(s, { back: true });
  assert.equal(poseOf(s, "p1").clip, "stepbackward");
  s = press(s, { rk: true, forward: true });
  assert.equal(poseOf(s, "p1").clip, "highkick");
  for (let i = 0; i < 67; i++) s = press(s, {}, { forward: true });
  for (let i = 0; i <= MOVES.lp.startup; i++) s = press(s, {}, i === 0 ? { lp: true } : {});
  assert.equal(s.events[0]?.attacker, "p2");
  assert.equal(poseOf(s, "p1").clip, "headhit"); // the left punch is high: the head is thrown back
});

test("the keys of ARCHITECTURE.md's table, by KeyboardEvent.code", () => {
  const p1 = keyboardButtons("p1", new Set(["KeyD", "KeyU"]));
  assert.deepEqual(p1, { forward: true, back: false, lp: true, rp: false, lk: false, rk: false });
  const p2 = keyboardButtons("p2", new Set(["ArrowRight", "Numpad2"]));
  assert.deepEqual(p2, { forward: false, back: true, lp: false, rp: false, lk: false, rk: true });
});

test("gamepads: stick past half way or d-pad; right is forward for player 1, left for player 2", () => {
  const pad = (x, pressed = []) => ({ connected: true, axes: [x, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) });
  assert.equal(gamepadButtons("p1", pad(0.6)).forward, true);
  assert.equal(gamepadButtons("p1", pad(0.4)).forward, false);
  assert.equal(gamepadButtons("p2", pad(0, [14])).forward, true);
  assert.equal(gamepadButtons("p2", pad(0, [15])).back, true);
  assert.deepEqual(Object.entries(gamepadButtons("p1", pad(0, [2, 3, 0, 1]))).filter(([, v]) => v).map(([k]) => k), ["lp", "rp", "lk", "rk"]);
  assert.equal(gamepadButtons("p1", null).forward, false);
});

test("keyboard and gamepad together: either counts, and forward with back is neither", () => {
  const held = merge({ forward: true, lp: false }, { back: true, lp: true });
  assert.deepEqual([held.forward, held.back, held.lp], [false, false, true]);
});

test("an attack pressed a few frames before the fighter is free still comes out", () => {
  const codes = [new Set(["KeyU"]), new Set(), new Set(), new Set()];
  let i = 0;
  const controls = createControls({ take: () => codes[i++] ?? new Set() }, () => []);
  let s = createFight();
  s = { ...s, p1: { ...s.p1, stun: 3 } }; // busy for 3 more frames
  for (let f = 0; f < 4; f++) {
    s = step(s, controls.read());
    controls.started(s);
  }
  assert.equal(s.p1.move?.input, "lp");
});

test("a gamepad button pressed and released between two engine frames counts on the next one", () => {
  const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
  const controls = createControls({ take: () => new Set() }, () => [null, pad]);
  pad.buttons[2].pressed = true; // player 2's left punch, down for one display frame only
  controls.poll();
  pad.buttons[2].pressed = false;
  assert.equal(controls.read().p2.lp, true);
});

test("the attack held through a rematch is ignored until it is released", () => {
  let codes = new Set(["KeyU"]);
  const controls = createControls({ take: () => codes }, () => []);
  assert.equal(controls.read().p1.lp, true);
  controls.clear(); // a new fight
  assert.equal(controls.read().p1.lp, false);
  codes = new Set();
  controls.read();
  codes = new Set(["KeyU"]);
  assert.equal(controls.read().p1.lp, true);
});
