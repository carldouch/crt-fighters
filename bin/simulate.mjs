#!/usr/bin/env node
// Replays a sequence of inputs through the engine and prints the result as JSON.
// Usage: node bin/simulate.mjs inputs.json. See ARCHITECTURE.md, "The simulator".
// A file it refuses: the reason on stderr, nothing on stdout, exit code 2.
import { readFileSync } from "node:fs";
import { formatResult, InputError, parseFrames, replay } from "../src/engine/replay.mjs";

function refuse(reason) {
  process.stderr.write(`simulate: ${reason}\n`);
  process.exitCode = 2;
}

const [file] = process.argv.slice(2);
if (!file) {
  refuse("usage: node bin/simulate.mjs <inputs.json>");
} else {
  let text = null;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    refuse(`cannot read ${file}: ${e.code ?? e.message}`);
  }
  if (text !== null) {
    try {
      process.stdout.write(formatResult(replay(parseFrames(text))));
    } catch (e) {
      if (!(e instanceof InputError)) throw e;
      refuse(`${file}: ${e.message}`);
    }
  }
}
