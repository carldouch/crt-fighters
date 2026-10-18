import assert from "node:assert/strict";
import { test } from "node:test";
import { formatResult, InputError, parseInputFile, replay } from "../src/engine/replay.mjs";

const refused = (doc, reason) => assert.throws(() => parseInputFile(doc), (e) => e instanceof InputError && reason.test(e.message), JSON.stringify(doc));

test("bad files are refused with the path of what is wrong", () => {
  refused([], /a JSON object/);
  refused({}, /^frames: .*there is none/);
  refused({ frames: [{ p1: "lp" }, "x"] }, /^frames\[1\]: must be an object/);
  refused({ frames: [{ p2: "jump" }] }, /^frames\[0\]\.p2: unknown button "jump"/);
  refused({ frames: [{ p1: "forward+back" }] }, /forward and back/);
  refused({ frames: [{ p1: "lp+rk" }] }, /one attack button at most/);
  refused({ frames: [{ p1: "lp+lp" }] }, /held twice/);
  refused({ frames: [{ p1: 3 }] }, /must be a string/);
  refused({ frames: [{ repeat: "2" }] }, /repeat: must be a whole number/);
  refused({ frames: Array(11).fill({ repeat: 100000 }) }, /^frames\[10\]: .*more than 1,000,000 frames/);
});

test("unknown keys are reported and ignored", () => {
  const { frames, warnings } = parseInputFile({ frames: [{ p1: "forward", repaet: 3 }] });
  assert.equal(frames[0].repeat, 1);
  assert.deepEqual(warnings, ["frames[0].repaet: unknown key, ignored (a frame has p1, p2 and repeat)"]);
});

test("the example of ARCHITECTURE.md replays, and prints the same bytes every time", () => {
  const doc = { frames: [{ p1: "forward", p2: "", repeat: 40 }, { p1: "lp", p2: "back" }, { p1: "forward+rk" }] };
  const result = replay(parseInputFile(doc).frames);
  assert.equal(result.frame, 42);
  assert.deepEqual(result.p1, { hp: 100, x: -30 });
  const text = formatResult(result);
  assert.equal(text, formatResult(replay(parseInputFile(doc).frames)));
  assert.deepEqual(JSON.parse(text), result);
});
