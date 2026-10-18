import test from 'node:test';
import assert from 'node:assert/strict';
import { resultAnnouncement } from '../src/ui/announcement.mjs';

test('match result names the leading player when a drawn round takes them to two wins', () => {
  for (const [winner, name] of [['p1', 'AMBER'], ['p2', 'CYAN']]) {
    const message = resultAnnouncement({ phase: 'over', winner, rounds: [{ winner: null, reason: 'time' }] });
    assert.equal(message.title, `${name} WINS`); assert.equal(message.rematch, true);
  }
});
test('round KO, timeout and drawn match have distinct announcements', () => {
  assert.equal(resultAnnouncement({ phase: 'pause', rounds: [{ winner: 'p1', reason: 'ko' }] }).title, 'K.O.');
  assert.equal(resultAnnouncement({ phase: 'pause', rounds: [{ winner: 'p2', reason: 'time' }] }).subtitle, 'CYAN TAKES THE ROUND');
  const draw = resultAnnouncement({ phase: 'over', winner: null, rounds: [{ winner: null, reason: 'ko' }] });
  assert.equal(draw.title, 'DRAW'); assert.equal(draw.rematch, true);
});
