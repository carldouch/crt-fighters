import assert from "node:assert/strict";
import { test } from "node:test";
import { MOVES } from "../src/engine/rules.mjs";
import { moveFrames } from "../src/engine/fight.mjs";
import { MAX_SPEED, moveKnots, timeAt } from "../src/scene/timing.mjs";

test("a move's first active frame shows the clip's impact", () => {
  for (const key of Object.keys(MOVES)) {
    const knots = moveKnots(key, 0.6, 1.5);
    assert.equal(timeAt(knots, MOVES[key].startup), 0.6, key);
  }
});

test("the clip time only moves forward, stays in the clip, and is never rushed beyond MAX_SPEED outside the active frames", () => {
  for (const key of Object.keys(MOVES)) {
    const duration = 1.2;
    const knots = moveKnots(key, 0.8, duration);
    let last = -1;
    for (let f = 0; f <= moveFrames(key); f += 0.25) {
      const t = timeAt(knots, f);
      assert.ok(t >= last && t >= 0 && t <= duration, `${key} at frame ${f}`);
      if (f > 0) assert.ok((t - last) / (0.25 / 60) <= MAX_SPEED + 1e-9, `${key} speed at frame ${f}`);
      last = t;
    }
  }
});

test("timeAt interpolates between knots and holds past either end", () => {
  const knots = [[0, 1], [10, 2], [20, 2]];
  assert.equal(timeAt(knots, -5), 1);
  assert.equal(timeAt(knots, 5), 1.5);
  assert.equal(timeAt(knots, 15), 2);
  assert.equal(timeAt(knots, 99), 2);
});
