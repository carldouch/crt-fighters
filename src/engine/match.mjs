import { createFight, step } from './fight.mjs';
import { createCpu, observeFight, stepCpu } from './cpu.mjs';

export function createMatch({ mode = 'local', difficulty = 'normal', seed = 14 } = {}) {
  if (!['local', 'cpu'].includes(mode)) throw new RangeError('Unknown game mode');
  const cpu = createCpu(difficulty, seed);
  return { settings: { mode, difficulty, seed: cpu.seed }, fight: createFight(), cpu };
}

export function advanceMatch(match, inputs = {}) {
  if (match.fight.phase === 'over') return match;
  if (match.settings.mode === 'local') return { ...match, fight: step(match.fight, inputs) };
  const { memory, input } = stepCpu(match.cpu, observeFight(match.fight));
  return { ...match, cpu: memory, fight: step(match.fight, { p1: inputs.p1 ?? {}, p2: input }) };
}

export function restartMatch(match, changes = {}) {
  return createMatch({ ...match.settings, ...changes });
}
