#!/usr/bin/env node
// Replays a sequence of inputs through the engine and prints the result as JSON.
// Usage: node bin/simulate.mjs inputs.json. See ARCHITECTURE.md, "The simulator".
// A bad file is refused with exit code 2, a reason on stderr and nothing on stdout.
import { readFileSync } from "node:fs";
import { formatResult, InputError, parseInputFile, replay } from "../src/engine/replay.mjs";

function refuse(reason) {
  process.stderr.write(`simulate: ${reason}\n`);
  process.exit(2);
}

const [path, ...extra] = process.argv.slice(2);
if (!path || extra.length) refuse("usage: node bin/simulate.mjs <inputs.json>");

let text;
try {
  text = readFileSync(path, "utf8");
} catch (e) {
  refuse(`${path}: cannot be read (${e.code ?? e.message})`);
}
let doc;
try {
  doc = JSON.parse(text);
} catch (e) {
  refuse(`${path}: not JSON (${e.message})`);
}
let parsed;
try {
  parsed = parseInputFile(doc);
} catch (e) {
  if (e instanceof InputError) refuse(`${path}: ${e.message}`);
  throw e;
}
for (const w of parsed.warnings) process.stderr.write(`simulate: ${path}: ${w}\n`);
process.stdout.write(formatResult(replay(parsed.frames)));
