import { MOVES, WALK_BACK, WALK_FORWARD, MIN_DISTANCE } from './rules.mjs';

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ reaction: 24, interval: 18, aggression: 0.30, defense: 0.15 }),
  normal: Object.freeze({ reaction: 12, interval: 8, aggression: 0.72, defense: 0.65 }),
  hard: Object.freeze({ reaction: 6, interval: 3, aggression: 0.92, defense: 0.90 }),
});

export function createCpu(difficulty = 'normal', seed = 14) {
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new RangeError('Unknown CPU difficulty');
  return { difficulty, seed: seed >>> 0, history: [], lastSeen: null, nextDecision: 0, input: {} };
}

// Only visibly observable combat information crosses the controller boundary.
export function observeFight(fight) {
  const fighter = (f) => ({ x: f.x, hp: f.hp, stun: f.stun, blocking: f.blocking,
    move: f.move && { key: f.move.key, frame: f.move.frame, hit: f.move.hit } });
  return { frame: fight.frame, phase: fight.phase, round: fight.rounds.length, p1: fighter(fight.p1), p2: fighter(fight.p2) };
}

/** Pure, seeded controller. No player inputs, clocks, or engine mutation. */
export function stepCpu(memory, observation) {
  const config = DIFFICULTIES[memory.difficulty];
  const next = { ...memory, history: [...memory.history, observation], input: { ...memory.input } };
  if (observation.phase !== 'fight' || (memory.history.length && memory.history.at(-1).round !== observation.round)) {
    next.history = []; next.lastSeen = null; next.input = {}; next.nextDecision = observation.frame;
    return { memory: next, input: {} };
  }
  if (next.history.length <= config.reaction) return { memory: next, input: {} };
  const seen = next.history.shift();
  next.lastSeen = seen;
  if (observation.frame < next.nextDecision) return { memory: next, input: { ...next.input } };
  next.nextDecision = observation.frame + config.interval;
  const random = () => { next.seed = (Math.imul(next.seed, 1664525) + 1013904223) >>> 0; return next.seed / 4294967296; };
  // Own action/recovery is known immediately; opponent information remains delayed.
  const enemy = seen.p1; const self = observation.p2;
  // Hard anticipates visible walking from two delayed snapshots, never live P1
  // position or inputs. A stop or reversal can fool this prediction.
  const velocity = memory.lastSeen ? Math.max(-WALK_BACK, Math.min(WALK_FORWARD, enemy.x - memory.lastSeen.p1.x)) : 0;
  const predictedX = enemy.x + (memory.difficulty === 'hard' ? velocity * config.reaction : 0);
  const distance = Math.max(MIN_DISTANCE, self.x - predictedX);
  let input = {};
  const threat = enemy.move && MOVES[enemy.move.key];
  // Extrapolate an already observed animation; this predicts no future inputs.
  const enemyMoveFrame = threat ? enemy.move.frame + observation.frame - seen.frame : 0;
  const recovery = threat && enemyMoveFrame >= threat.startup + threat.active && enemyMoveFrame < threat.startup + threat.active + threat.recovery;
  // Plan while busy as a human can hold a button through recovery. The engine
  // alone decides when that action becomes legal; this never cancels a move.
  if (self.hp > 0) {
    if (threat && !recovery && distance <= threat.range + 18 && random() < config.defense) {
      // Standing guard stops high/mid. Back-walking can evade a low if there is room.
      input = { back: true };
    } else if (distance > 115) {
      input = memory.difficulty === 'easy' && random() < 0.3 ? {} : { forward: true };
    } else if ((recovery && memory.difficulty === 'hard') || random() < config.aggression) {
      // Legal follow-ups only: the engine enforces startup, stun and recovery.
      if (memory.difficulty === 'easy') input = { [random() < 0.75 ? 'lp' : 'rk']: true };
      else if (enemy.blocking && distance <= 105) input = { lk: true };
      else if (recovery && distance <= 100) input = { lp: true };
      else {
        const choices = distance <= 95 ? ['lp', 'rp', 'lk', 'rk'] : distance <= 105 ? ['lk', 'rk', 'forward+rk'] : ['rk', 'forward+rk'];
        const attack = choices[Math.floor(random() * choices.length)];
        input = attack === 'forward+rk' ? { forward: true, rk: true } : { [attack]: true };
      }
    } else if (memory.difficulty !== 'easy' && distance < 85) input = { back: true };
  }
  next.input = input;
  return { memory: next, input: { ...input } };
}
