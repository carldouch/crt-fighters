import {
  MAX_HP, START_X, WALK_FORWARD, WALK_BACK, MIN_DISTANCE, STAGE_HALF_WIDTH,
  ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN, ATTACK_BUTTONS, MOVES,
} from './rules.mjs';

const PLAYERS = ['p1', 'p2'];
const fighter = (x) => ({ hp: MAX_HP, x, move: null, stun: 0, blocking: false, motion: 'idle', reaction: null });

/** JSON-serializable simulation state. No wall clock, rendering, or random state. */
export function createFight() {
  return {
    frame: 0, roundFrame: 0, phase: 'fight', pause: 0, endedAt: null,
    winner: null, roundWins: { p1: 0, p2: 0 }, rounds: [], events: [],
    p1: fighter(-START_X), p2: fighter(START_X),
  };
}

function act(f, buttons, frame) {
  f.blocking = false;
  f.motion = 'idle';
  if (f.move) {
    f.move = { ...f.move, frame: f.move.frame + 1 };
    const m = MOVES[f.move.key];
    if (f.move.frame >= m.startup + m.active + m.recovery) f.move = null;
  }
  f.stun = Math.max(0, f.stun - 1);
  if (f.stun === 0) f.reaction = null;
  if (f.move || f.stun) return 0;
  const attack = ATTACK_BUTTONS.find((key) => buttons[key]);
  // Invalid simultaneous directions are neutral; valid simulator inputs never have them.
  const forward = !!buttons.forward && !buttons.back;
  const back = !!buttons.back && !buttons.forward;
  if (attack) {
    f.move = { key: attack === 'rk' && forward ? 'forward+rk' : attack, frame: 0, hit: false, started: frame };
    return 0;
  }
  f.blocking = back;
  f.motion = forward ? 'forward' : back ? 'back' : 'idle';
  return forward ? WALK_FORWARD : back ? -WALK_BACK : 0;
}

function contact(f, defender, attacker, frame, distance) {
  if (!f.move || f.move.hit) return null;
  const m = MOVES[f.move.key];
  if (f.move.frame < m.startup || f.move.frame >= m.startup + m.active || distance > m.range) return null;
  const blocked = defender.blocking && m.height !== 'low';
  return { frame, type: 'hit', attacker, move: f.move.key, damage: blocked ? 0 : m.damage, blocked };
}

function endRound(s, reason) {
  const winner = s.p1.hp === s.p2.hp ? null : s.p1.hp > s.p2.hp ? 'p1' : 'p2';
  s.rounds = [...s.rounds, { winner, reason }];
  s.roundWins = { p1: s.roundWins.p1 + (winner !== 'p2' ? 1 : 0), p2: s.roundWins.p2 + (winner !== 'p1' ? 1 : 0) };
  const won1 = s.roundWins.p1 >= ROUNDS_TO_WIN;
  const won2 = s.roundWins.p2 >= ROUNDS_TO_WIN;
  s.phase = won1 || won2 ? 'over' : 'pause';
  s.winner = won1 === won2 ? null : won1 ? 'p1' : 'p2';
  s.pause = s.phase === 'pause' ? ROUND_PAUSE_FRAMES : 0;
  s.endedAt = s.frame - 1;
}

/** Advance one frame without mutating state or inputs. Completed matches are absorbing. */
export function step(state, inputs = {}) {
  if (state.phase === 'over') return state;
  const s = { ...state, frame: state.frame + 1 };
  if (state.phase === 'pause' && state.pause > 0) {
    s.pause--;
    return s;
  }
  if (state.phase === 'pause') {
    s.p1 = fighter(-START_X);
    s.p2 = fighter(START_X);
    s.roundFrame = 0;
    s.phase = 'fight';
    s.endedAt = null;
  } else {
    s.p1 = { ...state.p1 };
    s.p2 = { ...state.p2 };
  }

  // Timers and inputs do not depend on the opponent; positions resolve in p1/p2 order.
  const d1 = act(s.p1, inputs.p1 ?? {}, state.frame);
  const d2 = act(s.p2, inputs.p2 ?? {}, state.frame);
  const clamp = (x) => Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, x));
  s.p1.x = Math.min(clamp(s.p1.x + d1), s.p2.x - MIN_DISTANCE);
  s.p2.x = Math.max(clamp(s.p2.x - d2), s.p1.x + MIN_DISTANCE);
  const distance = s.p2.x - s.p1.x;

  // Snapshot both contacts before applying either: a cancelled move can still trade this frame.
  const hits = PLAYERS.map((id, i) => contact(s[id], s[PLAYERS[1 - i]], id, state.frame, distance)).filter(Boolean);
  for (const hit of hits) s[hit.attacker].move = { ...s[hit.attacker].move, hit: true };
  for (const hit of hits) {
    const target = s[hit.attacker === 'p1' ? 'p2' : 'p1'];
    const m = MOVES[hit.move];
    target.hp = Math.max(0, target.hp - hit.damage);
    target.stun = hit.blocked ? m.blockstun : m.hitstun;
    target.reaction = { at: state.frame, duration: target.stun, height: m.height, blocked: hit.blocked };
    if (!hit.blocked) target.move = null;
  }
  if (hits.length) s.events = [...state.events, ...hits];
  if (s.p1.hp === 0 || s.p2.hp === 0) endRound(s, 'ko');
  else if (++s.roundFrame >= ROUND_FRAMES) endRound(s, 'time');
  return s;
}
