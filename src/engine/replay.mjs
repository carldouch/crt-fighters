import { BUTTONS, ATTACK_BUTTONS } from './rules.mjs';
import { createFight, step } from './fight.mjs';

function buttons(value, path) {
  if (value === undefined || value === '') return {};
  if (typeof value !== 'string') throw new Error(`${path}: expected a button string`);
  const keys = value.split('+');
  if (keys.some((k) => !BUTTONS.includes(k))) throw new Error(`${path}: unknown button`);
  if (new Set(keys).size !== keys.length) throw new Error(`${path}: duplicate button`);
  if (keys.includes('forward') && keys.includes('back')) throw new Error(`${path}: forward and back together`);
  if (keys.filter((k) => ATTACK_BUTTONS.includes(k)).length > 1) throw new Error(`${path}: more than one attack`);
  return Object.fromEntries(keys.map((k) => [k, true]));
}

/** Validate the entire recording before executing any frames. */
export function parseReplay(data) {
  if (!data || !Array.isArray(data.frames)) throw new Error('expected a frames list');
  let total = 0;
  return data.frames.map((frame, i) => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error(`frame ${i}: expected an object`);
    const repeat = frame.repeat === undefined ? 1 : frame.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100000) throw new Error(`frame ${i}: repeat must be an integer from 1 to 100000`);
    total += repeat;
    if (total > 1000000) throw new Error('recording exceeds 1000000 frames');
    return { p1: buttons(frame.p1, `frame ${i}.p1`), p2: buttons(frame.p2, `frame ${i}.p2`), repeat };
  });
}

export function replay(data) {
  const frames = parseReplay(data);
  let state = createFight();
  let count = 0;
  for (const input of frames) {
    count += input.repeat;
    for (let i = 0; i < input.repeat && state.phase !== 'over'; i++) state = step(state, input);
  }
  return {
    frame: count, winner: state.winner, roundWins: state.roundWins, rounds: state.rounds,
    p1: { hp: state.p1.hp, x: state.p1.x }, p2: { hp: state.p2.hp, x: state.p2.x }, events: state.events,
  };
}
