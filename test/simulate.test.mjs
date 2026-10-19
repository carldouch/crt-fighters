// The simulator, as ARCHITECTURE.md, "The simulator", describes it. Run: npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/simulate.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "simulate-"));
let n = 0;

function simulate(doc) {
  const file = join(dir, `in-${n++}.json`);
  writeFileSync(file, typeof doc === "string" ? doc : JSON.stringify(doc));
  return spawnSync(process.execPath, [BIN, file], { encoding: "utf8" });
}

test("prints the result as one JSON object, laid out as in ARCHITECTURE.md", () => {
  const r = simulate({ frames: [{ p1: "forward", repeat: 67 }, { p1: "lp" }, { repeat: 6 }] });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `{
  "frame": 74,
  "winner": null,
  "roundWins": { "p1": 0, "p2": 0 },
  "rounds": [],
  "p1": { "hp": 100, "x": 51 },
  "p2": { "hp": 95, "x": 150 },
  "events": [
    { "frame": 73, "type": "hit", "attacker": "p1", "move": "lp", "damage": 5, "blocked": false }
  ]
}
`);
  assert.deepEqual(Object.keys(JSON.parse(r.stdout)), ["frame", "winner", "roundWins", "rounds", "p1", "p2", "events"]);
});

test("an empty string, or no key, holds nothing; repeat is 1 when left out", () => {
  const out = JSON.parse(simulate({ frames: [{ p1: "", p2: "" }, {}] }).stdout);
  assert.equal(out.frame, 2);
});

test("a blocked move's event has damage 0", () => {
  const out = JSON.parse(simulate({ frames: [{ p1: "forward", p2: "back", repeat: 151 }, { p1: "lp", p2: "back" }, { p2: "back", repeat: 10 }] }).stdout);
  assert.deepEqual(out.events.map(({ type, damage, blocked }) => ({ type, damage, blocked })), [{ type: "block", damage: 0, blocked: true }]);
});

test("the same file always prints the same bytes", () => {
  const doc = { frames: [{ p1: "forward", p2: "forward+rk", repeat: 50 }, { p1: "lk", p2: "back", repeat: 400 }] };
  assert.equal(simulate(doc).stdout, simulate(doc).stdout);
});

const REFUSED = {
  "a file that is not JSON": "{ nope",
  "no frames list": {},
  "frames that is not a list": { frames: {} },
  "a frame that is not an object": { frames: [[]] },
  "a frame that is null": { frames: [null] },
  "an unknown button": { frames: [{ p1: "jump" }] },
  "an empty button between two +": { frames: [{ p1: "forward++lp" }] },
  "buttons that are not a string": { frames: [{ p2: ["lp"] }] },
  "forward and back together": { frames: [{ p1: "forward+back" }] },
  "two attack buttons": { frames: [{ p2: "lk+rp" }] },
  "repeat 0": { frames: [{ repeat: 0 }] },
  "repeat 2.5": { frames: [{ repeat: 2.5 }] },
  'repeat "3"': { frames: [{ repeat: "3" }] },
  "repeat null": { frames: [{ repeat: null }] },
  "repeat 100001": { frames: [{ repeat: 100001 }] },
  "more than 1,000,000 frames in all": { frames: [{ repeat: 100000 }, ...Array(10).fill({ repeat: 100000 })] },
};

for (const [what, doc] of Object.entries(REFUSED)) {
  test(`refuses ${what}: exit code 2, a reason on stderr, nothing on stdout`, () => {
    const r = simulate(doc);
    assert.deepEqual([r.status, r.stdout], [2, ""]);
    assert.match(r.stderr, /^simulate: .+\n$/);
  });
}

test("refuses no argument and a file it cannot read", () => {
  for (const args of [[], [join(dir, "missing.json")]]) {
    const r = spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });
    assert.deepEqual([r.status, r.stdout], [2, ""]);
    assert.notEqual(r.stderr, "");
  }
});

test("accepts exactly 1,000,000 frames", () => {
  const r = simulate({ frames: Array(10).fill({ repeat: 100000 }) });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).frame, 1_000_000);
});
