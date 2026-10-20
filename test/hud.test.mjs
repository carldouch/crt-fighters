import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, NO_INPUT, step } from "../src/engine/fight.mjs";
import { bannerOf, fadeOf } from "../src/scene/hud.mjs";

const run = (s, n, p1 = {}) => {
  for (let i = 0; i < n; i++) s = step(s, { p1: { ...NO_INPUT, ...p1 }, p2: NO_INPUT });
  return s;
};

test("the banners follow the match", () => {
  assert.deepEqual(bannerOf(createFight()), ["ROUND 1", ""]);
  assert.deepEqual(bannerOf(run(createFight(), 40)), ["FIGHT!", ""]);
  assert.equal(bannerOf(run(createFight(), 100)), null);
  const time = run(createFight(), 3600);
  assert.deepEqual(bannerOf(time), ["TIME", "Round 1: no winner"]);
  const final = run(time, 91);
  assert.deepEqual(bannerOf(final), ["FINAL ROUND", ""]);
  const over = run(final, 3600);
  assert.deepEqual(bannerOf(over, true), ["DRAW", "Press Enter or Start for a rematch"]);
});

test("the screen fades to black at the end of a pause and back in the next round", () => {
  const time = run(createFight(), 3600);
  assert.equal(fadeOf(time), 0);
  assert.equal(fadeOf(run(time, 90)), 1);
  assert.ok(fadeOf(run(time, 92)) > 0 && fadeOf(run(time, 92)) < 1);
  assert.equal(fadeOf(run(time, 120)), 0);
});
