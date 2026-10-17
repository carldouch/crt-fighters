import {
  MAX_HP, START_X, WALK_FORWARD, WALK_BACK, MIN_DISTANCE, STAGE_HALF_WIDTH,
  ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN, MOVES, ATTACK_BUTTONS,
} from './rules.mjs';

const players = ['p1', 'p2'];
const fighter = (x) => ({ hp: MAX_HP, x, move: null, stun: 0, blocking: false, walking: null, reaction: null });

export function createFight() {
  return {
    frame: 0, roundFrame: 0, winner: null, done: false, pause: 0, roundEnded: false,
    roundWins: { p1: 0, p2: 0 }, rounds: [], events: [],
    p1: fighter(-START_X), p2: fighter(START_X),
  };
}

function finishRound(state, winner, reason) {
  state.rounds = [...state.rounds, { winner, reason }];
  state.roundWins = { ...state.roundWins };
  for (const id of players) if (winner === null || winner === id) state.roundWins[id]++;
  const winners = players.filter((id) => state.roundWins[id] >= ROUNDS_TO_WIN);
  state.done = winners.length > 0;
  state.winner = winners.length === 1 ? winners[0] : null;
  state.roundEnded = true;
  state.pause = state.done ? 0 : ROUND_PAUSE_FRAMES;
}

/** Pure one-frame transition. Move frame zero is the frame on which its input starts it. */
export function step(previous, inputs = {}) {
  if (previous.done) return previous;
  const state = { ...previous, frame: previous.frame + 1 };
  if (state.pause > 0) {
    state.pause--;
    return state;
  }
  if (state.roundEnded) {
    state.p1 = fighter(-START_X);
    state.p2 = fighter(START_X);
    state.roundFrame = 0;
    state.roundEnded = false;
  } else {
    for (const id of players) state[id] = { ...state[id], move: state[id].move && { ...state[id].move } };
  }
  // Timers, then inputs and ordered movement. Released attacks still finish their moves.
  for (const id of players) {
    const f = state[id];
    if (f.move) {
      f.move.frame++;
      const rule = MOVES[f.move.key];
      if (f.move.frame >= rule.startup + rule.active + rule.recovery) f.move = null;
    }
    f.stun = Math.max(0, f.stun - 1);
    f.blocking = false;
    f.walking = null;
  }
  for (const id of players) {
    const f = state[id], other = state[id === 'p1' ? 'p2' : 'p1'];
    if (f.move || f.stun) continue;
    const buttons = inputs[id] ?? {};
    const attack = ATTACK_BUTTONS.find((key) => buttons[key]);
    if (attack) {
      f.move = { key: attack === 'rk' && buttons.forward ? 'forward+rk' : attack, frame: 0, hit: false };
      continue;
    }
    f.blocking = !!buttons.back;
    const direction = id === 'p1' ? 1 : -1;
    const movement = buttons.forward ? WALK_FORWARD : buttons.back ? -WALK_BACK : 0;
    let x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, f.x + direction * movement));
    x = id === 'p1' ? Math.min(x, other.x - MIN_DISTANCE) : Math.max(x, other.x + MIN_DISTANCE);
    if (x !== f.x) f.walking = movement > 0 ? 'forward' : 'back';
    f.x = x;
  }
  // Collect contacts before applying them: cancellation cannot prevent a simultaneous trade.
  const contacts = [];
  for (const id of players) {
    const f = state[id], target = id === 'p1' ? 'p2' : 'p1';
    if (!f.move || f.move.hit) continue;
    const move = MOVES[f.move.key];
    if (f.move.frame < move.startup || f.move.frame >= move.startup + move.active) continue;
    if (state.p2.x - state.p1.x > move.range) continue;
    f.move.hit = true;
    contacts.push({ attacker: id, target, key: f.move.key, move, blocked: state[target].blocking && move.height !== 'low' });
  }
  const events = [];
  for (const { attacker, target, key, move, blocked } of contacts) {
    const f = state[target];
    f.stun = blocked ? move.blockstun : move.hitstun;
    f.reaction = { frame: previous.frame, height: move.height, blocked };
    if (!blocked) {
      f.hp = Math.max(0, f.hp - move.damage);
      f.move = null;
    }
    events.push({ frame: previous.frame, type: 'hit', attacker, move: key, damage: blocked ? 0 : move.damage, blocked });
  }
  if (events.length) state.events = [...state.events, ...events];
  if (state.p1.hp === 0 || state.p2.hp === 0) {
    finishRound(state, state.p1.hp === state.p2.hp ? null : state.p1.hp > 0 ? 'p1' : 'p2', 'ko');
  } else {
    state.roundFrame++;
    if (state.roundFrame >= ROUND_FRAMES) {
      finishRound(state, state.p1.hp === state.p2.hp ? null : state.p1.hp > state.p2.hp ? 'p1' : 'p2', 'time');
    }
  }
  return state;
}
