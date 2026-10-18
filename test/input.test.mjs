import test from 'node:test';
import assert from 'node:assert/strict';
import { createControls, mergeInput, padInput } from '../src/input/controls.mjs';
const pad = (x = 0, pressed = []) => ({ connected: true, axes: [x], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) });

test('gamepad axes use strict half-way threshold and player-relative directions', () => {
  assert.equal(padInput(pad(0.5), 0).forward, false);
  assert.equal(padInput(pad(0.501), 0).forward, true);
  assert.equal(padInput(pad(-0.501), 1).forward, true);
  assert.equal(padInput(pad(0.501), 1).back, true);
  assert.deepEqual(padInput(null, 0), {});
  assert.deepEqual(padInput({ connected: false }, 0), {});
});
test('every gamepad face button and d-pad map correctly for both slots', () => {
  for (const i of [0, 1]) for (const [key, n] of [['lp', 2], ['rp', 3], ['lk', 0], ['rk', 1]]) assert.equal(padInput(pad(0, [n]), i)[key], true);
  assert.equal(padInput(pad(0, [15]), 0).forward, true);
  assert.equal(padInput(pad(0, [14]), 1).forward, true);
});
test('opposing devices cancel movement and competing attack buttons have stable priority', () => {
  const result = mergeInput({ forward: true, rk: true }, { back: true, lp: true });
  assert.equal(result.forward, false); assert.equal(result.back, false); assert.equal(result.lp, true); assert.equal(result.rk, false);
});
test('quick taps survive until a tick; held keys repeat; blur clears; dispose removes listeners', () => {
  const target = new EventTarget(); const input = createControls(target);
  const key = (type, code) => { const e = new Event(type, { cancelable: true }); Object.defineProperty(e, 'code', { value: code }); target.dispatchEvent(e); };
  key('keydown', 'KeyU'); key('keyup', 'KeyU'); assert.equal(input.sample().p1.lp, true); assert.equal(input.sample().p1.lp, false);
  key('keydown', 'ArrowLeft'); assert.equal(input.sample().p2.forward, true); assert.equal(input.sample().p2.forward, true);
  target.dispatchEvent(new Event('blur')); assert.equal(!!input.sample().p2.forward, false);
  input.dispose(); key('keydown', 'KeyU'); assert.equal(input.sample().p1.lp, false);
});
