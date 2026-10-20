// The page's pure parts, without a browser: the controls, and the poses read from the engine's state.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, step } from "../src/engine/fight.mjs";
import { ANIMS, MOVES } from "../src/engine/rules.mjs";
import { keyButtons } from "../src/input/keyboard.js";
import { padButtons } from "../src/input/gamepad.js";
import { createControls } from "../src/input/index.js";
import { MOVE_CLIPS, moveClipTime } from "../src/scene/clips.js";
import { poseOf } from "../src/scene/pose.js";
import { bannerOf, curtainOf } from "../src/ui/hud.js";

const pad = (axes0, buttons = []) => ({ axes: [axes0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })) });

test("the keys of ARCHITECTURE.md: D and ArrowLeft are each player's forward", () => {
  const down = new Set(["KeyD", "KeyU", "ArrowLeft", "Numpad2"]);
  assert.deepEqual(keyButtons(down, "p1"), { forward: true, back: false, lp: true, rp: false, lk: false, rk: false });
  assert.deepEqual(keyButtons(down, "p2"), { forward: true, back: false, lp: false, rp: false, lk: false, rk: true });
});

test("a gamepad's stick or d-pad towards the opponent is forward: right for player 1, left for player 2", () => {
  assert.equal(padButtons(pad(1), "p1").forward, true);
  assert.equal(padButtons(pad(0.4), "p1").forward, false, "the stick counts past half way");
  assert.equal(padButtons(pad(0, [14]), "p2").forward, true);
  assert.equal(padButtons(pad(0, [14]), "p1").back, true);
  assert.deepEqual(padButtons(pad(0, [2, 1]), "p1"), { forward: false, back: false, lp: true, rp: false, lk: false, rk: true });
  assert.equal(padButtons(null, "p1").forward, false);
});

test("an attack tapped while the fighter is busy is kept for it up to 8 frames, then dropped", () => {
  const keyboard = { down: new Set(), taps: new Set() };
  const controls = createControls(keyboard);
  const frame = (s) => {
    const next = step(s, controls.read());
    controls.settle(next);
    return next;
  };
  let s = createFight();
  keyboard.taps.add("KeyU"); // a tap released before the frame read it
  s = frame(s);
  assert.equal(s.p1.move?.key, "lp");
  for (let i = 1; i < 12; i++) s = frame(s);
  keyboard.taps.add("KeyI"); // on the punch's 12th frame: it ends after its 19th
  for (let i = 12; i < 19; i++) s = frame(s);
  assert.equal(s.p1.move?.key, "lp");
  s = frame(s);
  assert.deepEqual(s.p1.move, { key: "rp", frame: 0, hit: false }, "the right punch starts as soon as the fighter is free");
  for (let i = 1; i < 5; i++) s = frame(s);
  keyboard.taps.add("KeyJ"); // on the right punch's 5th frame: it ends after its 23rd, too late
  for (let i = 5; i < 24; i++) s = frame(s);
  assert.equal(s.p1.move, null);
});

test("each move's clip shows its strike at the range on the move's first active frame", () => {
  for (const [key, move] of Object.entries(MOVES)) {
    const c = MOVE_CLIPS[key];
    assert.equal(moveClipTime(key, 0), c.from, key);
    assert.equal(moveClipTime(key, move.startup), c.impact, key);
    assert.equal(moveClipTime(key, move.startup + move.active + move.recovery), c.to, key);
    let last = -1;
    for (let f = 0; f <= move.startup + move.active + move.recovery; f += 0.25) {
      assert.ok(moveClipTime(key, f) >= last, `${key} never plays backwards`);
      last = moveClipTime(key, f);
    }
  }
});

test("the HUD's banner and curtain follow the rounds", () => {
  let s = createFight();
  for (let i = 0; i < 10; i++) s = step(s, {});
  assert.deepEqual(bannerOf(s, 0), ["Round 1", ""]);
  for (let i = 0; i < 3590; i++) s = step(s, {});
  assert.deepEqual(bannerOf(s, 0), ["Time", "Round 1: no winner"]);
  assert.equal(curtainOf(s), 0);
  for (let i = 0; i < 90; i++) s = step(s, {});
  assert.equal(curtainOf(s), 1, "closed on the pause's last frame");
  s = step(s, {});
  assert.ok(curtainOf(s) > 0.9 && curtainOf(s) < 1, "opening on the next round's first frame");
  for (let i = 0; i < 3599; i++) s = step(s, {});
  assert.deepEqual([s.over, bannerOf(s, 0)[0], bannerOf(s, 60)[0]], [true, "Time", "Draw game"]);
});

test("poses follow the engine: walking, a move, a hit, then the knockout and the victory", () => {
  let s = step(createFight(), { p1: { forward: true } });
  assert.equal(poseOf(s, "p1").clip, ANIMS.forward);
  assert.equal(poseOf(s, "p2").clip, ANIMS.idle);
  for (let i = 0; i < 66; i++) s = step(s, { p1: { forward: true } });
  s = step(s, { p1: { lp: true } });
  assert.deepEqual([poseOf(s, "p1").clip, poseOf(s, "p1").time], [MOVES.lp.anim, MOVE_CLIPS.lp.from]);
  for (let i = 0; i < 6; i++) s = step(s, {});
  assert.equal(poseOf(s, "p2").clip, ANIMS.hitHigh, "a punch is high");
  for (let i = 0; i < 400; i++) s = step(s, { p1: { lp: true } });
  assert.equal(s.ended, true);
  assert.equal(poseOf(s, "p2", 0, 30).clip, ANIMS.ko);
  assert.equal(poseOf(s, "p1", 0, 30).clip, ANIMS.victory);
  assert.equal(poseOf(s, "p1", 0, 30).time, 0.5);
});
