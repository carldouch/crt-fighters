import { MAX_HP, START_X, MOVES, ATTACK_BUTTONS, WALK_FORWARD, WALK_BACK, MIN_DISTANCE, STAGE_HALF_WIDTH, ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN } from './rules.mjs';

const fighter = (x) => ({ hp: MAX_HP, x, move: null, stun: 0, blocking: false, motion: 'idle', hitHeight: null });
export function createFight() {
  return { frame: 0, winner: null, over: false, roundWins: { p1: 0, p2: 0 }, rounds: [], events: [], roundFrame: 0, pause: 0, p1: fighter(-START_X), p2: fighter(START_X) };
}

/** Pure one-frame transition. Events and completed rounds are immutable history. */
export function step(state, inputs = {}) {
  if (state.over) return state;
  const s = { ...state, frame: state.frame + 1, p1: { ...state.p1 }, p2: { ...state.p2 } };
  if (s.pause > 0) { s.pause--; return s; }
  if (s.rounds.length && state.roundFrame === -1) {
    s.p1 = fighter(-START_X); s.p2 = fighter(START_X); s.roundFrame = 0;
  }
  for (const id of ['p1', 'p2']) {
    const p = s[id], input = inputs[id] ?? {};
    p.blocking = false; p.motion = 'idle';
    if (p.move) {
      p.move = { ...p.move, frame: p.move.frame + 1 };
      const rule = MOVES[p.move.key];
      if (p.move.frame >= rule.startup + rule.active + rule.recovery) p.move = null;
    }
    p.stun = Math.max(0, p.stun - 1);
    if (p.move || p.stun) continue;
    const attack = ATTACK_BUTTONS.find((button) => input[button]);
    if (attack) {
      p.move = { key: attack === 'rk' && input.forward ? 'forward+rk' : attack, frame: 0, hit: false };
    } else {
      p.blocking = Boolean(input.back);
      p.motion = input.forward ? 'forward' : input.back ? 'back' : 'idle';
    }
  }
  for (const [id, other, direction] of [['p1', 'p2', 1], ['p2', 'p1', -1]]) {
    const p = s[id];
    const dx = p.motion === 'forward' ? WALK_FORWARD : p.motion === 'back' ? -WALK_BACK : 0;
    p.x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, p.x + direction * dx));
    p.x = id === 'p1' ? Math.min(p.x, s[other].x - MIN_DISTANCE) : Math.max(p.x, s[other].x + MIN_DISTANCE);
  }
  // Collect contacts before applying either: a cancelled attack may still trade this frame.
  const contacts = [];
  for (const [id, other] of [['p1', 'p2'], ['p2', 'p1']]) {
    const move = s[id].move;
    if (!move || move.hit) continue;
    const rule = MOVES[move.key];
    if (move.frame >= rule.startup && move.frame < rule.startup + rule.active && s.p2.x - s.p1.x <= rule.range) {
      contacts.push({ id, other, key: move.key, rule, blocked: s[other].blocking && rule.height !== 'low' });
    }
  }
  for (const { id, other, key, rule, blocked } of contacts) {
    const p = s[other];
    if (s[id].move) s[id].move = { ...s[id].move, hit: true };
    p.stun = blocked ? rule.blockstun : rule.hitstun;
    if (!blocked) { p.hp = Math.max(0, p.hp - rule.damage); p.move = null; p.hitHeight = rule.height; }
    s.events = [...s.events, { frame: state.frame, type: 'hit', attacker: id, move: key, damage: blocked ? 0 : rule.damage, blocked }];
  }
  const ko = s.p1.hp === 0 || s.p2.hp === 0;
  if (!ko) s.roundFrame++;
  if (ko || s.roundFrame >= ROUND_FRAMES) {
    const winner = s.p1.hp === s.p2.hp ? null : s.p1.hp > s.p2.hp ? 'p1' : 'p2';
    s.rounds = [...s.rounds, { winner, reason: ko ? 'ko' : 'time' }];
    s.roundWins = { p1: s.roundWins.p1 + (winner !== 'p2' ? 1 : 0), p2: s.roundWins.p2 + (winner !== 'p1' ? 1 : 0) };
    s.over = s.roundWins.p1 >= ROUNDS_TO_WIN || s.roundWins.p2 >= ROUNDS_TO_WIN;
    s.winner = s.over ? s.roundWins.p1 === s.roundWins.p2 ? null : s.roundWins.p1 > s.roundWins.p2 ? 'p1' : 'p2' : null;
    s.pause = s.over ? 0 : ROUND_PAUSE_FRAMES;
    s.lastRoundFrames = s.roundFrame;
    s.roundFrame = -1;
  }
  return s;
}
