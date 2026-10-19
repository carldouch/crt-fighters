#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createFight, step } from '../src/engine/fight.mjs';
import { BUTTONS, ATTACK_BUTTONS } from '../src/engine/rules.mjs';

function buttons(value = '') {
  if (typeof value !== 'string') throw new Error('player inputs must be strings');
  const names = value === '' ? [] : value.split('+');
  if (names.some((name) => !BUTTONS.includes(name))) throw new Error('unknown button');
  if (new Set(names).size !== names.length) throw new Error('duplicate button');
  const held = Object.fromEntries(names.map((name) => [name, true]));
  if (held.forward && held.back) throw new Error('forward and back cannot be held together');
  if (ATTACK_BUTTONS.filter((name) => held[name]).length > 1) throw new Error('only one attack button is allowed');
  return held;
}
try {
  if (process.argv.length !== 3) throw new Error('usage: node bin/simulate.mjs <inputs.json>');
  const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (!input || !Array.isArray(input.frames)) throw new Error('frames must be a list');
  let count = 0;
  const frames = input.frames.map((frame) => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error('each frame must be an object');
    const repeat = frame.repeat === undefined ? 1 : frame.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100000) throw new Error('repeat must be an integer from 1 to 100000');
    count += repeat;
    if (count > 1000000) throw new Error('at most 1000000 frames are allowed');
    return { repeat, inputs: { p1: buttons(frame.p1), p2: buttons(frame.p2) } };
  });
  let state = createFight();
  for (const { repeat, inputs } of frames) for (let n = 0; n < repeat; n++) state = step(state, inputs);
  const { winner, roundWins, rounds, events } = state;
  const view = ({ hp, x }) => ({ hp, x });
  process.stdout.write(JSON.stringify({ frame: count, winner, roundWins, rounds, p1: view(state.p1), p2: view(state.p2), events }) + '\n');
} catch (error) {
  console.error(`simulate: ${error.message}`);
  process.exitCode = 2;
}
