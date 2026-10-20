// The fight engine: pure, deterministic, no DOM and no three.js. Whole numbers only.
// ARCHITECTURE.md, "The engine", is the specification; each numbered step below is one of its steps.
import {
  ATTACK_BUTTONS, MAX_HP, MIN_DISTANCE, MOVES, ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN, STAGE_HALF_WIDTH, START_X,
  WALK_BACK, WALK_FORWARD,
} from "./rules.mjs";

export const PLAYERS = ["p1", "p2"];
const OTHER = { p1: "p2", p2: "p1" };
/** +1 when `forward` is +x (player 1, always on the left), -1 when it is -x (player 2). */
const FACING = { p1: 1, p2: -1 };

/**
 * A fighter at the start of a round. `move` is the move it is doing ({ key, frame, hit }: `frame` counts
 * from 0 on the frame it started), `stun` the frames it still cannot act and `stunBy` what caused them
 * ({ type: "hit" or "block", move }). `walk` (+1 forward, -1 back, 0) and `blocking` say what it did on
 * the last frame: the page animates them.
 */
function fighter(player) {
  return { hp: MAX_HP, x: FACING[player] * -START_X, move: null, stun: 0, stunBy: null, walk: 0, blocking: false };
}

/** A new match: both fighters at their start, MAX_HP each, round 1 about to begin. */
export function createFight() {
  return {
    frame: 0, // frames stepped since the match began, pauses included
    round: 1, // the round being fought (or just ended)
    clock: 0, // frames the round has lasted
    ended: false, // the round has ended: the fighters stay as they are until the next one
    pause: 0, // frames left in the pause before the next round
    roundWins: { p1: 0, p2: 0 },
    rounds: [], // every round that has ended: { winner, reason }
    winner: null,
    over: false, // the match has ended: later frames change nothing
    events: [], // the hits and blocks of the last frame: { frame, type, attacker, move, damage, blocked }
    p1: fighter("p1"),
    p2: fighter("p2"),
  };
}

/** Is the fighter free: in no move and no stun? Only a free fighter acts. */
export const isFree = (f) => f.move === null && f.stun === 0;

/** The move `buttons` start, or null: `rk` while holding `forward` is the high kick. */
export function moveOf(buttons) {
  // A page may hold several attack buttons at once (an input file never does): the first in ATTACK_BUTTONS wins.
  const attack = ATTACK_BUTTONS.find((b) => buttons?.[b]);
  if (!attack) return null;
  return attack === "rk" && buttons.forward ? "forward+rk" : attack;
}

/** Is a move on one of its active frames, the frames it can hit on? */
export function isActive({ key, frame }) {
  const { startup, active } = MOVES[key];
  return frame >= startup && frame < startup + active;
}

/**
 * Advances the fight by one frame and returns the new state; `state` is left unchanged.
 * @param state a state from createFight() or step()
 * @param inputs { p1: Buttons, p2: Buttons }, where Buttons is { forward, back, lp, rp, lk, rk } (booleans)
 */
export function step(state, inputs) {
  const s = { ...state, frame: state.frame + 1, events: [] };
  if (s.over) return s;
  if (s.ended) {
    // The pause: nothing moves and inputs are ignored. On the frame after it, a new round starts.
    if (s.pause > 0) return { ...s, pause: s.pause - 1 };
    Object.assign(s, { round: s.round + 1, clock: 0, ended: false, p1: fighter("p1"), p2: fighter("p2") });
  }
  const f = { p1: { ...s.p1 }, p2: { ...s.p2 } };
  s.p1 = f.p1;
  s.p2 = f.p2;

  // 1. Timers.
  for (const p of PLAYERS) {
    const me = f[p];
    if (me.move) {
      const move = { ...me.move, frame: me.move.frame + 1 };
      const { startup, active, recovery } = MOVES[move.key];
      me.move = move.frame >= startup + active + recovery ? null : move;
    }
    if (me.stun > 0) me.stun -= 1;
    if (me.stun === 0) me.stunBy = null;
  }

  // 2. Inputs, for each free fighter.
  for (const p of PLAYERS) {
    const me = f[p];
    const b = inputs?.[p] ?? {};
    me.walk = 0;
    me.blocking = false;
    if (!isFree(me)) continue;
    const key = moveOf(b);
    if (key) {
      me.move = { key, frame: 0, hit: false };
    } else if (b.forward && !b.back) {
      me.walk = 1;
    } else if (b.back && !b.forward) {
      me.walk = -1;
      me.blocking = true;
    }
  }

  // 3. Positions: player 1 moves first, then player 2.
  for (const p of PLAYERS) {
    const me = f[p];
    if (me.walk === 0) continue;
    const speed = me.walk > 0 ? WALK_FORWARD : WALK_BACK;
    let x = clamp(me.x + me.walk * speed * FACING[p], -STAGE_HALF_WIDTH, STAGE_HALF_WIDTH);
    const other = f[OTHER[p]].x;
    x = p === "p1" ? Math.min(x, other - MIN_DISTANCE) : Math.max(x, other + MIN_DISTANCE);
    me.x = x;
  }

  // 4. Hits, both resolved from the positions of step 3, so two attacks can trade.
  const distance = f.p2.x - f.p1.x;
  const landing = PLAYERS.filter((p) => {
    const move = f[p].move;
    return move && !move.hit && isActive(move) && distance <= MOVES[move.key].range;
  }).map((p) => ({ attacker: p, key: f[p].move.key }));
  for (const { attacker, key } of landing) {
    const move = MOVES[key];
    const me = f[attacker];
    const them = f[OTHER[attacker]];
    if (me.move?.key === key) me.move = { ...me.move, hit: true };
    const blocked = them.blocking && move.height !== "low";
    if (blocked) {
      them.stun = move.blockstun;
      them.stunBy = { type: "block", move: key };
    } else {
      them.hp = Math.max(0, them.hp - move.damage);
      them.stun = move.hitstun;
      them.stunBy = { type: "hit", move: key };
      them.move = null;
    }
    s.events.push({ frame: state.frame, type: blocked ? "block" : "hit", attacker, move: key, damage: blocked ? 0 : move.damage, blocked });
  }

  // 5. Knockout.
  if (f.p1.hp === 0 || f.p2.hp === 0) {
    const winner = f.p1.hp === f.p2.hp ? null : f.p1.hp === 0 ? "p2" : "p1";
    return endRound(s, winner, "ko");
  }

  // 6. Time.
  s.clock += 1;
  if (s.clock >= ROUND_FRAMES) {
    const winner = f.p1.hp === f.p2.hp ? null : f.p1.hp > f.p2.hp ? "p1" : "p2";
    return endRound(s, winner, "time");
  }
  return s;
}

/** Ends the round: a round with no winner counts for both. Then the match ends, or the pause begins. */
function endRound(s, winner, reason) {
  const roundWins = { ...s.roundWins };
  for (const p of PLAYERS) if (winner === null || winner === p) roundWins[p] += 1;
  const rounds = [...s.rounds, { winner, reason }];
  for (const p of PLAYERS) Object.assign(s[p], { walk: 0, blocking: false });
  const done = PLAYERS.filter((p) => roundWins[p] >= ROUNDS_TO_WIN);
  if (done.length > 0) {
    return { ...s, roundWins, rounds, ended: true, over: true, winner: done.length === 1 ? done[0] : null };
  }
  return { ...s, roundWins, rounds, ended: true, pause: ROUND_PAUSE_FRAMES };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
