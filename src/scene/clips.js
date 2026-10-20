// How the clips of public/models/computerboi.glb line up with the engine's frames. Times are seconds of
// each clip, read from __dev.measureClips() (src/dev.js) on the model at its height on the stage.
import { ANIMS, MOVES } from "../engine/rules.mjs";

/**
 * Each move's clip, in three parts that fill the move's frames:
 * - startup: `from` (just before the limb leaves the guard) to `impact`, the limb at the move's range, so
 *   the strike reaches the opponent on the move's first active frame, the first frame it can hit on;
 * - active: `impact` to `through`, the follow-through to the limb's furthest point;
 * - recovery: `through` to `to`, back to the guard.
 * The punches peak at 96 and 93 cm, a little short of their 100: they land as the fist meets the head.
 */
export const MOVE_CLIPS = {
  lp: { from: 0.4, impact: 0.58, through: 0.62, to: 0.86 },
  rp: { from: 0.12, impact: 0.37, through: 0.45, to: 0.72 },
  lk: { from: 0.25, impact: 0.59, through: 0.65, to: 1.12 },
  rk: { from: 0.25, impact: 0.64, through: 0.72, to: 1.15 },
  "forward+rk": { from: 0.25, impact: 0.62, through: 0.76, to: 1.3 },
};

/**
 * The reactions, played from `from` to `to` over the stun's frames: the head snaps back (high), the body
 * folds (mid and low). There is no blocking clip: a block is the first, smaller part of the head's snap.
 */
export const REACTIONS = {
  high: { clip: ANIMS.hitHigh, from: 0.12, to: 0.7 },
  mid: { clip: ANIMS.hitMid, from: 0.1, to: 0.85 },
  block: { clip: ANIMS.hitHigh, from: 0.1, to: 0.38 },
};

/**
 * The end of a round, played from `from` at the clip's own speed. The knockout's first second stands
 * still: it starts where the fighter is thrown, so it lies on the floor 1.25 s later, within the pause.
 */
export const ENDS = {
  ko: { clip: ANIMS.ko, from: 1.0 },
  victory: { clip: ANIMS.victory, from: 0 },
};

/**
 * The walks loop at `rate` times their speed. The clips step slowly (about 35 cm a second); the engine
 * walks at 180 cm a second forward and 120 back, so they play faster, short of a jog.
 */
export const WALKS = {
  forward: { clip: ANIMS.forward, rate: 3.5 },
  back: { clip: ANIMS.back, rate: 2.6 },
};

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

/** The time in its clip of move `key` on (fractional) frame `f` of the move, frame 0 being its first. */
export function moveClipTime(key, f) {
  const { startup, active, recovery } = MOVES[key];
  const { from, impact, through, to } = MOVE_CLIPS[key];
  if (f < startup) return lerp(from, impact, f / startup);
  if (f < startup + active) return lerp(impact, through, (f - startup) / active);
  return lerp(through, to, (f - startup - active) / recovery);
}
