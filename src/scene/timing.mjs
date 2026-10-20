// How a clip's time follows the engine's frames. Pure functions of frame counters: no three.js.
//
// A move's clip is pinned to the move's frames so that the strike lands on the frame the engine hits:
// its first active frame (`startup`) shows the clip's impact pose, the moment the striking limb is
// furthest out (measured from the model, see model.mjs). Before it, the wind-up plays; during the active
// frames the clip runs at its own speed through the impact; the recovery brings the fighter back to its
// stance by the move's last frame. Outside the active frames a clip never plays faster than MAX_SPEED: a
// wind-up longer than that is entered part way, and a long tail is left out.
import { FPS, MOVES } from "../engine/rules.mjs";
import { moveFrames } from "../engine/fight.mjs";

export const MAX_SPEED = 3;
/** Hit reactions play this much faster than the clip, over the hitstun. */
export const HURT_SPEED = 2.2;

/** The knots [engine frame, clip time] of a move whose clip lasts `duration` with its impact at `impact`. */
export function moveKnots(key, impact, duration) {
  const { startup, active, recovery } = MOVES[key];
  const start = Math.max(0, impact - (startup / FPS) * MAX_SPEED);
  const activeEnd = Math.min(duration, impact + active / FPS);
  const end = Math.min(duration, activeEnd + (recovery / FPS) * MAX_SPEED);
  return [[0, start], [startup, impact], [startup + active, activeEnd], [moveFrames(key), end]];
}

/** The clip time at `frame` (fractional), interpolated between knots and held past either end. */
export function timeAt(knots, frame) {
  if (frame <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [f1, t1] = knots[i];
    if (frame <= f1) {
      const [f0, t0] = knots[i - 1];
      return f1 === f0 ? t1 : t0 + ((frame - f0) / (f1 - f0)) * (t1 - t0);
    }
  }
  return knots.at(-1)[1];
}

/** The clip time of a hit reaction `elapsed` frames (fractional) into its hitstun. */
export const hurtTime = (elapsed, duration) => Math.min(duration, (elapsed / FPS) * HURT_SPEED);
