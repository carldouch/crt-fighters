#!/usr/bin/env node
// Replays a sequence of inputs through the engine and prints the result as JSON.
// Usage: node bin/simulate.mjs inputs.json. See ARCHITECTURE.md, "The simulator".
// A file it refuses: the reason on stderr, nothing on stdout, exit code 2.
import { readFileSync } from "node:fs";
import { parseScript, replay, ScriptError } from "../src/engine/replay.mjs";

function refuse(reason) {
  process.stderr.write(`simulate: ${reason}\n`);
  process.exit(2);
}

const path = process.argv[2];
if (!path) refuse("no input file (usage: node bin/simulate.mjs inputs.json)");

let text;
try {
  text = readFileSync(path, "utf8");
} catch (e) {
  refuse(`cannot read ${path}: ${e.code ?? e.message}`);
}

let json;
try {
  json = JSON.parse(text);
} catch (e) {
  refuse(`${path} is not JSON: ${e.message}`);
}

let frames;
try {
  frames = parseScript(json);
} catch (e) {
  if (!(e instanceof ScriptError)) throw e;
  refuse(`${path}: ${e.message}`);
}

process.stdout.write(`${JSON.stringify(replay(frames))}\n`);
