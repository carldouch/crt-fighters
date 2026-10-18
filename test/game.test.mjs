import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_INPUT } from "../src/engine/fight.mjs";
import { Game, STEP_MS } from "../src/game.mjs";

const controls = () => ({ sample: () => ({ p1: { ...NO_INPUT, forward: true }, p2: NO_INPUT }), afterStep() {}, takeStart: () => false });

test("the engine steps 60 frames per second of clock time, at most half a second at once", () => {
  const published = [];
  const game = new Game(controls(), (s) => published.push(s.frame));
  game.update(0);
  game.update(10 * STEP_MS + 1);
  assert.equal(game.state.frame, 10);
  game.update(10_000); // a stall of nearly 10 s
  assert.equal(game.state.frame, 40, "half a second of play, the rest skipped");
  assert.deepEqual(published.slice(-3), [38, 39, 40], "every frame is published");
});

test("a paused clock does not count the time it was paused, and time going back counts as none", () => {
  const game = new Game(controls());
  game.update(0);
  game.pause();
  game.update(60_000);
  assert.equal(game.state.frame, 0);
  game.update(60_000 + 3 * STEP_MS + 1);
  assert.equal(game.state.frame, 3);
  game.update(1_000);
  game.update(1_000 + STEP_MS + 1);
  assert.equal(game.state.frame, 4);
});

test("the leftover fraction of a frame is returned for drawing", () => {
  const game = new Game(controls());
  game.update(0);
  const alpha = game.update(STEP_MS * 2.5);
  assert.ok(Math.abs(alpha - 0.5) < 1e-9);
  assert.equal(game.previous.frame, 1);
  assert.equal(game.state.frame, 2);
});
