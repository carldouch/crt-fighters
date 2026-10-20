// Input files: what the simulator accepts, and the reason it gives for what it refuses.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseButtons, parseScript, replay, ScriptError } from "../src/engine/replay.mjs";

const refused = (json, reason) => assert.throws(() => parseScript(json), (e) => e instanceof ScriptError && reason.test(e.message));

test("buttons are joined by +, and an empty string or no key holds nothing", () => {
  assert.deepEqual(parseButtons("forward+rk"), { forward: true, back: false, lp: false, rp: false, lk: false, rk: true });
  assert.deepEqual(parseScript({ frames: [{}] })[0], { inputs: { p1: parseButtons(""), p2: parseButtons("") }, repeat: 1 });
});

test("each refusal names the frame and the reason", () => {
  refused(null, /no "frames" list/);
  refused({ frames: "x" }, /no "frames" list/);
  refused({ frames: [[]] }, /frames\[0\] is not an object/);
  refused({ frames: [{}, { p2: "kick" }] }, /frames\[1\]\.p2: unknown button "kick"/);
  refused({ frames: [{ p1: "lp+" }] }, /unknown button ""/);
  refused({ frames: [{ p1: "lp+lp" }] }, /lp twice/);
  refused({ frames: [{ p1: 5 }] }, /not a string/);
  refused({ frames: [{ p1: "back+forward" }] }, /forward and back together/);
  refused({ frames: [{ p1: "rk+lk" }] }, /more than one attack button \(lk, rk\)/);
  refused({ frames: [{ repeat: "2" }] }, /repeat: "2" is not a whole number/);
  refused({ frames: [...Array.from({ length: 10 }, () => ({ repeat: 100000 })), {}] }, /1000001 frames in all/);
});

test("a million frames is the limit, and runs", () => {
  const out = replay(parseScript({ frames: Array.from({ length: 10 }, () => ({ repeat: 100000 })) }));
  assert.equal(out.frame, 1000000);
  assert.deepEqual(out.roundWins, { p1: 2, p2: 2 });
});
