#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { replay } from '../src/engine/replay.mjs';

try {
  if (process.argv.length !== 3) throw new Error('usage: node bin/simulate.mjs <inputs.json>');
  const result = replay(JSON.parse(readFileSync(process.argv[2], 'utf8')));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  console.error(`simulate: ${error.message}`);
  process.exitCode = 2;
}
