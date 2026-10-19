// What each fighter's model shows, read from the engine's state alone: which clip, how far into it, and
// how far the model leans into a strike. No three.js here: fighter.mjs applies it.
import { MOVES } from "../engine/rules.mjs";

/**
 * The clips of the moves, timed against the engine. Seconds into each clip, measured on the model's
 * skeleton (the striking hand or foot): `start`, when it leaves the guard; `contact`, when it is furthest
 * forward; `end`, when it is back on guard. `reach`: how far ahead of the hips it is at `contact`, in
 * the model's own units.
 */
export const STRIKES = {
  lp: { clip: "leftpunch", start: 0.18, contact: 0.6, end: 0.88, reach: 0.047 },
  rp: { clip: "rightpunch", start: 0.18, contact: 0.4, end: 0.8, reach: 0.045 },
  lk: { clip: "lowkick", start: 0.35, contact: 0.63, end: 1.2, reach: 0.059 },
  rk: { clip: "middlekick", start: 0.38, contact: 0.7, end: 1.18, reach: 0.072 },
  "forward+rk": { clip: "highkick", start: 0.32, contact: 0.77, end: 1.45, reach: 0.067 },
};

/** Hit reactions: `peak`, when the head or the body is thrown furthest back; `end`, back on guard. */
export const REACTIONS = {
  high: { clip: "headhit", start: 0.13, peak: 0.7, end: 1.15 },
  mid: { clip: "middlehit", start: 0.1, peak: 0.33, end: 1.1 },
};

/** Seconds of the knockout clip from the moment the legs give way to the moment the body lies still. */
export const KNOCKOUT = { clip: "ko", start: 1.1, down: 2.6 };
export const VICTORY = { clip: "victory", start: 0.9 };

/** Seconds of a walk clip per step, and units walked per step, so that the clip's pace follows the walk. */
export const WALKS = {
  forward: { clip: "stepfroward", from: 0.05, to: 1.0, stride: 54 },
  back: { clip: "stepbackward", from: 0.2, to: 1.35, stride: 40 },
};

/** Frames a reaction takes to reach its peak: the hit shows at once, the recovery fills the stun. */
const IMPACT_FRAMES = 4;
/** A fight's frames per second, for the clips that just play (idle, knockout, victory). */
const SECONDS = 1 / 60;

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

/**
 * The pose of one fighter on the frame the state shows.
 * @param state the engine's state after a step
 * @param side "p1" or "p2"
 * @param walked units the fighter has walked so far, forward and back (the scene counts them)
 * @returns { clip, time, lean } where `lean` is a share (0 to 1) of the gap the strike closes visually
 */
export function poseOf(state, side, walked = 0) {
  const f = state[side];
  if (state.roundEndFrame !== null) return endOfRound(state, side);
  if (f.reaction) return reaction(f);
  if (f.move) return strike(f.move);
  if (f.walk) return walk(f.walk, walked);
  return { clip: "idle", time: (state.frame * SECONDS) % 5, lean: 0 };
}

/** A move's clip, timed so that the limb is furthest forward on the move's first active frame. */
export function strike({ input, frame }) {
  const { startup, active, recovery } = MOVES[input];
  const s = STRIKES[input];
  const held = s.contact + 0.05; // the limb stays out through the active frames
  let time, lean;
  if (frame < startup) {
    time = lerp(s.start, s.contact, frame / startup);
    lean = frame / startup;
  } else if (frame < startup + active) {
    time = lerp(s.contact, held, (frame - startup) / active);
    lean = 1;
  } else {
    const t = (frame - startup - active) / recovery;
    time = lerp(held, s.end, t);
    lean = 1 - t;
  }
  return { clip: s.clip, time, lean };
}

/** Thrown back by a hit (head for high moves, body for the others), or braced by a block. */
function reaction(f) {
  const move = MOVES[f.reaction.move];
  const r = REACTIONS[move.height === "high" ? "high" : "mid"];
  const total = f.reaction.blocked ? move.blockstun : move.hitstun;
  const elapsed = total - f.stun; // 0 on the frame of the hit
  // A block only flinches: the same clip, held short of its peak.
  const peak = f.reaction.blocked ? lerp(r.start, r.peak, 0.35) : r.peak;
  const time = elapsed < IMPACT_FRAMES
    ? lerp(r.start, peak, (elapsed + 1) / IMPACT_FRAMES)
    : lerp(peak, f.reaction.blocked ? r.start : r.end, (elapsed - IMPACT_FRAMES) / (total - IMPACT_FRAMES));
  return { clip: r.clip, time, lean: 0 };
}

function walk(direction, walked) {
  const w = WALKS[direction];
  const steps = (walked / w.stride) % 1;
  return { clip: w.clip, time: w.from + steps * (w.to - w.from), lean: 0 };
}

/** Between rounds and after the match: the loser falls, the winner celebrates, a draw stands still. */
function endOfRound(state, side) {
  const since = (state.frame - 1 - state.roundEndFrame) * SECONDS; // 0 on the frame the round ended
  const f = state[side];
  const { winner } = state.rounds.at(-1);
  if (f.hp === 0) return { clip: KNOCKOUT.clip, time: Math.min(KNOCKOUT.start + since * 1.6, KNOCKOUT.down + 1), lean: 0 };
  if (winner === side) return { clip: VICTORY.clip, time: VICTORY.start + since, lean: 0 };
  return { clip: "idle", time: (state.frame * SECONDS) % 5, lean: 0 };
}
