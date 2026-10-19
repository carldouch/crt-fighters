// The fight engine: pure and deterministic, no DOM and no three.js. The page, the simulator and, from
// round 3, the server only feed it inputs and read its state. ARCHITECTURE.md, "The engine", has the rules;
// step() follows its order of one frame, numbered the same way.
import {
  ATTACK_BUTTONS, MAX_HP, MIN_DISTANCE, MOVES, ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN,
  STAGE_HALF_WIDTH, START_X, WALK_BACK, WALK_FORWARD,
} from "./rules.mjs";

/**
 * A fighter at the start of a round.
 * - `move`: the move in progress, `{ input, frame, hit }`: its input in MOVES (`"lp"`, `"forward+rk"`…), the
 *   frames it has counted (0 on the frame it starts) and whether it has hit.
 * - `stun`: frames left before it can act; `reaction` says what caused it: `{ move, blocked }`.
 * - `walk` (`"forward"`, `"back"` or null) and `blocking`: what it did this frame.
 */
function fighter(x) {
  return { hp: MAX_HP, x, move: null, stun: 0, reaction: null, walk: null, blocking: false };
}

/** A new match: both fighters at their start, MAX_HP each, round 1 about to begin. */
export function createFight() {
  return {
    frame: 0, // frames stepped so far, pauses included
    round: 1, // the round being fought, or that has just ended
    roundFrame: 0, // frames the round has lasted
    roundEndFrame: null, // the frame the last round ended on, while the pause after it runs
    over: false,
    winner: null,
    roundWins: { p1: 0, p2: 0 },
    rounds: [],
    p1: fighter(-START_X),
    p2: fighter(START_X),
    events: [], // this frame's hits and blocks, player 1's first
  };
}

/** A fighter is free when it is in no move and its stun is 0. Only a free fighter acts. */
export const isFree = (f) => f.move === null && f.stun === 0;

/**
 * Advances the fight by one frame and returns the new state; the state passed in is never changed.
 * @param state a state from createFight() or step()
 * @param inputs { p1: Buttons, p2: Buttons }, where Buttons is { forward, back, lp, rp, lk, rk } (booleans)
 */
export function step(state, inputs) {
  const frame = state.frame;
  let s = { ...state, frame: frame + 1, events: [] };
  if (s.over) return s; // the match is over: every later frame changes nothing
  if (s.roundEndFrame !== null) {
    if (frame - s.roundEndFrame <= ROUND_PAUSE_FRAMES) return s; // the pause: nothing moves, inputs ignored
    s = { ...s, round: s.round + 1, roundFrame: 0, roundEndFrame: null, p1: fighter(-START_X), p2: fighter(START_X) };
  }
  const p1 = countFrame(s.p1); // 1. timers
  const p2 = countFrame(s.p2);
  act(p1, inputs?.p1); // 2. inputs
  act(p2, inputs?.p2);
  p1.x = Math.min(onStage(p1.x + walked(p1, 1)), p2.x - MIN_DISTANCE); // 3. positions, player 1 first
  p2.x = Math.max(onStage(p2.x + walked(p2, -1)), p1.x + MIN_DISTANCE);
  s.events = resolveHits(p1, p2, frame); // 4. hits
  s.p1 = p1;
  s.p2 = p2;
  if (p1.hp === 0 || p2.hp === 0) return endRound(s, leader(p1.hp > 0, p2.hp > 0), "ko", frame); // 5. knockout
  s.roundFrame += 1; // 6. time
  if (s.roundFrame === ROUND_FRAMES) return endRound(s, leader(p1.hp > p2.hp, p2.hp > p1.hp), "time", frame);
  return s;
}

/** Step 1: a copy of the fighter, one frame further into its move or its stun. */
function countFrame(f) {
  const next = { ...f, walk: null, blocking: false };
  if (f.move) {
    const m = MOVES[f.move.input];
    const counted = f.move.frame + 1;
    next.move = counted === m.startup + m.active + m.recovery ? null : { ...f.move, frame: counted };
  }
  if (f.stun > 0) next.stun = f.stun - 1;
  if (next.stun === 0) next.reaction = null;
  return next;
}

/**
 * Step 2: a free fighter starts the attack held (forward + rk is the high kick), or walks; holding back
 * with no attack, it blocks. (One attack and one direction at most: the simulator refuses more, the page
 * cannot send more.)
 */
function act(f, held) {
  if (!isFree(f)) return;
  const attack = ATTACK_BUTTONS.find((b) => held?.[b]);
  if (attack) {
    f.move = { input: attack === "rk" && held.forward ? "forward+rk" : attack, frame: 0, hit: false };
  } else if (held?.forward) {
    f.walk = "forward";
  } else if (held?.back) {
    f.walk = "back";
  }
  f.blocking = !attack && Boolean(held?.back);
}

/** Units walked along x this frame; `facing` is +1 for player 1 (forward is +x), -1 for player 2. */
function walked(f, facing) {
  if (f.walk === "forward") return WALK_FORWARD * facing;
  if (f.walk === "back") return -WALK_BACK * facing;
  return 0;
}

const onStage = (x) => Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, x));

/** Step 4: both fighters' hits, from the same positions, so that two attacks can trade. */
function resolveHits(p1, p2, frame) {
  const distance = p2.x - p1.x;
  const landing = [[p1, p2, "p1", landingMove(p1, distance)], [p2, p1, "p2", landingMove(p2, distance)]];
  const events = [];
  for (const [attacker, defender, side, input] of landing) {
    if (!input) continue;
    const move = MOVES[input];
    const blocked = defender.blocking && move.height !== "low";
    if (attacker.move) attacker.move = { ...attacker.move, hit: true }; // it has hit: never again
    if (blocked) {
      defender.stun = move.blockstun;
    } else {
      defender.hp = Math.max(0, defender.hp - move.damage);
      defender.stun = move.hitstun;
      defender.move = null; // a hit cancels the defender's move
    }
    defender.reaction = { move: input, blocked };
    // The event's damage is the move's (0 when blocked), even when the defender had less hp left.
    events.push({ frame, type: blocked ? "block" : "hit", attacker: side, move: input, damage: blocked ? 0 : move.damage, blocked });
  }
  return events;
}

/** The input of the attacker's move if it hits this frame: an active frame, not hit yet, within range. */
function landingMove(attacker, distance) {
  const m = attacker.move;
  if (!m || m.hit) return null;
  const { startup, active, range } = MOVES[m.input];
  return m.frame >= startup && m.frame < startup + active && distance <= range ? m.input : null;
}

const leader = (p1Ahead, p2Ahead) => (p1Ahead && !p2Ahead ? "p1" : p2Ahead && !p1Ahead ? "p2" : null);

/** Steps 5 and 6: the round ends; a round with no winner counts for both. */
function endRound(s, winner, reason, frame) {
  const roundWins = { ...s.roundWins };
  for (const side of winner ? [winner] : ["p1", "p2"]) roundWins[side] += 1;
  const p1Won = roundWins.p1 >= ROUNDS_TO_WIN, p2Won = roundWins.p2 >= ROUNDS_TO_WIN;
  return {
    ...s,
    roundWins,
    rounds: [...s.rounds, { winner, reason }],
    roundEndFrame: frame,
    over: p1Won || p2Won,
    winner: leader(p1Won, p2Won),
  };
}

/** What the page shows in window.__crt.fight, and the simulator prints: { frame, winner, roundWins, p1, p2 }. */
export function summary(s) {
  return {
    frame: s.frame,
    winner: s.winner,
    roundWins: { ...s.roundWins },
    p1: { hp: s.p1.hp, x: s.p1.x },
    p2: { hp: s.p2.hp, x: s.p2.x },
  };
}
