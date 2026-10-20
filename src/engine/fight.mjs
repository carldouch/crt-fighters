// The fight engine: pure and deterministic, no DOM and no three.js (ARCHITECTURE.md, "The engine").
// A state is plain JSON-ready data. `step(state, inputs)` advances one frame and returns a new state; it
// never changes the state it is given, so a state can be kept, compared, sent or replayed.
import { ATTACK_BUTTONS, MAX_HP, MIN_DISTANCE, MOVES, ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN, STAGE_HALF_WIDTH, START_X, WALK_BACK, WALK_FORWARD } from "./rules.mjs";

export const PLAYERS = ["p1", "p2"];
/** No button held. */
export const NO_INPUT = Object.freeze({ forward: false, back: false, lp: false, rp: false, lk: false, rk: false });
const NO_EVENTS = Object.freeze([]);

/** A move's length in frames: startup, active and recovery. */
export const moveFrames = (key) => MOVES[key].startup + MOVES[key].active + MOVES[key].recovery;

// A fighter at the start of a round. `move` is null or { key, frame, hit }: the move's key in MOVES, the
// frames counted since its first frame (0 on that frame), and whether it has hit. `stun` is the frames
// left in hitstun or blockstun, and `hurt` what caused them: { move, blocked, frames }. `walk` ("forward",
// "back" or null) and `blocking` say what the fighter did on the last frame.
const fighter = (x) => ({ x, hp: MAX_HP, move: null, stun: 0, hurt: null, walk: null, blocking: false });

/** A new match: both fighters at their start, MAX_HP each, round 1 about to begin. */
export function createFight() {
  return {
    frame: 0, // the number of the next frame: the frames stepped so far, pauses included
    round: 1, // the round being fought, or the one that has just ended
    roundFrames: 0, // frames the round has lasted
    pause: 0, // frames left in the pause after a round
    endedAt: null, // the frame on which the round being shown ended, or null while it is fought
    roundWins: { p1: 0, p2: 0 },
    rounds: [], // every round that has ended: { winner, reason }
    winner: null,
    over: false, // the match has ended: later frames change nothing
    p1: fighter(-START_X),
    p2: fighter(START_X),
    events: NO_EVENTS, // the hits and blocks of the last frame: { frame, type, attacker, move, damage, blocked }
  };
}

/** A fighter is free when it is in no move and its stun is 0. Only a free fighter acts. */
export const isFree = (f) => f.move === null && f.stun === 0;

/** Whether the round being fought has ended: the pause, or the end of the match, follows. */
export const roundOver = (state) => state.rounds.length === state.round;

/**
 * Advances the fight by one frame and returns the new state.
 * @param state a state from createFight() or step()
 * @param inputs { p1: Buttons, p2: Buttons }, where Buttons is { forward, back, lp, rp, lk, rk } (booleans)
 */
export function step(state, inputs) {
  const frame = state.frame;
  if (state.over) return { ...state, frame: frame + 1, events: NO_EVENTS };
  if (state.pause > 0) return { ...state, frame: frame + 1, pause: state.pause - 1, events: NO_EVENTS };
  const s = roundOver(state) ? nextRound(state) : state;

  // 1. Timers, then 2. inputs, for each fighter.
  let p1 = act(tick(s.p1), inputs?.p1);
  let p2 = act(tick(s.p2), inputs?.p2);

  // 3. Positions: player 1 moves first, then player 2; forward is +x for player 1 and -x for player 2.
  p1 = { ...p1, x: Math.min(clampStage(p1.x + stride(p1)), p2.x - MIN_DISTANCE) };
  p2 = { ...p2, x: Math.max(clampStage(p2.x - stride(p2)), p1.x + MIN_DISTANCE) };

  // 4. Hits: both decided from the positions above, then applied together, so two attacks can trade.
  const distance = p2.x - p1.x;
  const h1 = hitOf(p1, p2, distance);
  const h2 = hitOf(p2, p1, distance);
  const events = [];
  if (h1) [p1, p2] = land(p1, p2, h1, events, frame, "p1");
  if (h2) [p2, p1] = land(p2, p1, h2, events, frame, "p2");

  const next = { ...s, frame: frame + 1, p1, p2, events: events.length ? events : NO_EVENTS };
  // 5. Knockout.
  if (p1.hp === 0 || p2.hp === 0) return endRound(next, p1.hp === p2.hp ? null : p1.hp === 0 ? "p2" : "p1", "ko");
  // 6. Time.
  const roundFrames = s.roundFrames + 1;
  if (roundFrames >= ROUND_FRAMES) return endRound({ ...next, roundFrames }, p1.hp === p2.hp ? null : p1.hp > p2.hp ? "p1" : "p2", "time");
  return { ...next, roundFrames };
}

// The pause is over: the next round starts on this frame, both fighters back at their start.
const nextRound = (s) => ({ ...s, round: s.round + 1, roundFrames: 0, endedAt: null, p1: fighter(-START_X), p2: fighter(START_X) });

// 1. A fighter in a move counts one more frame of it, and is free again once all the move's frames are
// counted; a fighter in stun counts it down by 1.
function tick(f) {
  let { move, stun, hurt } = f;
  if (move) move = move.frame + 1 >= moveFrames(move.key) ? null : { ...move, frame: move.frame + 1 };
  if (stun > 0) stun -= 1;
  if (stun === 0) hurt = null;
  return { ...f, move, stun, hurt };
}

// 2. A free fighter starts the move of its attack button (rk while holding forward is the high kick) and
// does not walk; otherwise it walks, and holding back blocks. Forward and back together cancel out. With
// several attack buttons held (the simulator refuses that; the page sends one), the first of
// ATTACK_BUTTONS counts.
function act(f, buttons = NO_INPUT) {
  if (!isFree(f)) return { ...f, walk: null, blocking: false };
  const attack = ATTACK_BUTTONS.find((b) => buttons[b]);
  if (attack) {
    const key = attack === "rk" && buttons.forward && !buttons.back ? "forward+rk" : attack;
    return { ...f, move: { key, frame: 0, hit: false }, walk: null, blocking: false };
  }
  const walk = buttons.forward && !buttons.back ? "forward" : buttons.back && !buttons.forward ? "back" : null;
  return { ...f, walk, blocking: walk === "back" };
}

// The distance a fighter walks this frame, counted positive towards the opponent.
const stride = (f) => (f.walk === "forward" ? WALK_FORWARD : f.walk === "back" ? -WALK_BACK : 0);
const clampStage = (x) => Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, x));

// 4. The hit `attacker` lands this frame, or null: a move that has not hit yet, on an active frame, with
// the fighters at most its range apart. Holding back blocks high and mid moves, never lows.
function hitOf(attacker, defender, distance) {
  const m = attacker.move;
  if (!m || m.hit) return null;
  const move = MOVES[m.key];
  if (m.frame < move.startup || m.frame >= move.startup + move.active || distance > move.range) return null;
  return { key: m.key, move, blocked: defender.blocking && move.height !== "low" };
}

// Applies one hit to both fighters and records its event. A hit, unlike a block, costs the defender the
// move's damage and cancels the move it was doing.
function land(attacker, defender, { key, move, blocked }, events, frame, who) {
  events.push({ frame, type: blocked ? "block" : "hit", attacker: who, move: key, damage: blocked ? 0 : move.damage, blocked });
  const done = { ...attacker, move: attacker.move && { ...attacker.move, hit: true } };
  const stun = blocked ? move.blockstun : move.hitstun;
  const hurt = { move: key, blocked, frames: stun };
  if (blocked) return [done, { ...defender, stun, hurt }];
  return [done, { ...defender, hp: Math.max(0, defender.hp - move.damage), move: null, stun, hurt }];
}

// The round ends, won by `winner` (null: no winner, and both fighters win a round). The first fighter to
// win ROUNDS_TO_WIN rounds wins the match; both reaching it together end it with no winner. Otherwise a
// pause of ROUND_PAUSE_FRAMES frames comes before the next round.
function endRound(s, winner, reason) {
  const roundWins = winner ? { ...s.roundWins, [winner]: s.roundWins[winner] + 1 } : { p1: s.roundWins.p1 + 1, p2: s.roundWins.p2 + 1 };
  const rounds = [...s.rounds, { winner, reason }];
  const endedAt = s.frame - 1;
  const [won1, won2] = [roundWins.p1 >= ROUNDS_TO_WIN, roundWins.p2 >= ROUNDS_TO_WIN];
  if (won1 || won2) return { ...s, roundWins, rounds, endedAt, over: true, winner: won1 && won2 ? null : won1 ? "p1" : "p2" };
  return { ...s, roundWins, rounds, endedAt, pause: ROUND_PAUSE_FRAMES };
}
