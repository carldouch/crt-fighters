import assert from "node:assert/strict";
import { test } from "node:test";
import { BUFFER_FRAMES, buttonsFor, Controls } from "../src/input/controls.mjs";

const held = (entries) => new Map(Object.entries(entries));

test("the newer of forward and back counts, and the newest attack", () => {
  assert.deepEqual(buttonsFor(held({ forward: 1, back: 2, lp: 3, rk: 5 }), null), { forward: false, back: true, lp: false, rp: false, lk: false, rk: true });
  assert.equal(buttonsFor(held({ lp: 9 }), "lk").lk, true, "a buffered press wins");
});

// A device that holds what the test sets: { player: { action: stamp } }.
const fake = () => ({ held: {}, forEachHeld(fn) { for (const [p, actions] of Object.entries(this.held)) for (const [a, s] of Object.entries(actions)) fn(p, a, s); }, takeStart: () => false });

test("a tap is buffered until the fighter starts a move, or for BUFFER_FRAMES frames", () => {
  const pad = fake();
  const c = new Controls([pad]);
  pad.held = { p1: { lp: 1 } };
  assert.equal(c.sample(10).p1.lp, true);
  pad.held = {}; // released before the fighter was free
  assert.equal(c.sample(11).p1.lp, true, "still buffered");
  c.afterStep({ p1: { move: { frame: 0 } }, p2: { move: null } });
  assert.equal(c.sample(12).p1.lp, false, "used by the move it started");
  pad.held = { p1: { rk: 2 } };
  c.sample(20);
  pad.held = {};
  assert.equal(c.sample(20 + BUFFER_FRAMES).p1.rk, true);
  assert.equal(c.sample(21 + BUFFER_FRAMES).p1.rk, false, "expired");
});

test("a button kept held is not a new press", () => {
  const pad = fake();
  const c = new Controls([pad]);
  pad.held = { p2: { rp: 4 } };
  c.sample(0);
  c.afterStep({ p1: { move: null }, p2: { move: { frame: 0 } } });
  assert.equal(c.buffered.p2, null);
  c.sample(1);
  assert.equal(c.buffered.p2, null, "the same stamp is not buffered again");
  assert.equal(c.sample(2).p2.rp, true, "held, it keeps acting");
});
