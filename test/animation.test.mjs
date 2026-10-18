import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTime } from '../src/scene/fighter.js';
import { MOVES } from '../src/engine/rules.mjs';

for (const [key, move] of Object.entries(MOVES)) test(`${key}: contact pose aligns with first active frame and recovery ends at clip end`, () => {
  const duration = 2; const contact = 0.81;
  assert.equal(moveTime(0, move, duration, contact), 0);
  assert.equal(moveTime(move.startup, move, duration, contact), contact);
  assert.equal(moveTime(move.startup + move.active + move.recovery, move, duration, contact), duration);
  let previous = -1;
  for (let frame = 0; frame <= move.startup + move.active + move.recovery; frame += 0.25) {
    const time = moveTime(frame, move, duration, contact); assert.ok(time >= previous && time <= duration); previous = time;
  }
});
