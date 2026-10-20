#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createFight, step } from '../src/engine/fight.mjs';
import { BUTTONS, ATTACK_BUTTONS } from '../src/engine/rules.mjs';
try {
  if (process.argv.length !== 3) throw new Error('usage: node bin/simulate.mjs <inputs.json>');
  const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (!data || !Array.isArray(data.frames)) throw new Error('frames must be a list');
  let count = 0;
  const frames = data.frames.map((frame, i) => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error(`frame ${i}: expected an object`);
    const repeat = frame.repeat === undefined ? 1 : frame.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100000) throw new Error(`frame ${i}: repeat must be an integer from 1 to 100000`);
    count += repeat;
    if (count > 1000000) throw new Error('more than 1000000 total frames');
    const inputs = {};
    for (const id of ['p1', 'p2']) {
      const raw = frame[id] === undefined ? '' : frame[id];
      if (typeof raw !== 'string') throw new Error(`frame ${i}: ${id} must be a button string`);
      const buttons = raw === '' ? [] : raw.split('+');
      if (buttons.some((b) => !BUTTONS.includes(b)) || new Set(buttons).size !== buttons.length) throw new Error(`frame ${i}: unknown or repeated button`);
      if (buttons.includes('forward') && buttons.includes('back')) throw new Error(`frame ${i}: forward and back together`);
      if (buttons.filter((b) => ATTACK_BUTTONS.includes(b)).length > 1) throw new Error(`frame ${i}: more than one attack`);
      inputs[id] = Object.fromEntries(buttons.map((b) => [b, true]));
    }
    return { inputs, repeat };
  });
  let s = createFight();
  for (const { inputs, repeat } of frames) for (let i = 0; i < repeat; i++) s = step(s, inputs);
  const simple = ({ hp, x }) => ({ hp, x });
  console.log(JSON.stringify({ frame: count, winner: s.winner, roundWins: s.roundWins, rounds: s.rounds, p1: simple(s.p1), p2: simple(s.p2), events: s.events }));
} catch (error) {
  console.error(`simulate: ${error.message}`); process.exitCode = 2;
}
