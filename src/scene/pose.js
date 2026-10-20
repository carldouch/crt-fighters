// What a fighter's model shows, read from the engine's state and nothing else: a clip, and for the clips
// timed to the engine (moves, reactions, the end of a round) the time in it. No three.js here.
import { ANIMS, FPS, MOVES } from "../engine/rules.mjs";
import { ENDS, moveClipTime, REACTIONS, WALKS } from "./clips.js";

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

/**
 * The pose of `player` in `fight`. `alpha` (0 to 1) is how far the display is into the next engine frame;
 * `sinceEnd` the frames since the round ended, while it has. Returns { clip, time, rate, fade }: `time`
 * is null for a looping clip played at `rate`; `fade` is the cross-fade into it, in seconds.
 */
export function poseOf(fight, player, alpha = 0, sinceEnd = 0) {
  const me = fight[player];
  if (fight.ended) {
    const { winner, reason } = fight.rounds.at(-1);
    const seconds = sinceEnd / FPS;
    if (reason === "ko" && me.hp === 0) return { clip: ENDS.ko.clip, time: ENDS.ko.from + seconds, fade: 0.1 };
    if (winner === player) return { clip: ENDS.victory.clip, time: ENDS.victory.from + seconds, fade: 0.3 };
    return { clip: ANIMS.idle, time: null, rate: 1, fade: 0.3 };
  }
  if (me.move) {
    return { clip: MOVES[me.move.key].anim, time: moveClipTime(me.move.key, me.move.frame + alpha), fade: 0.05 };
  }
  if (me.stun > 0 && me.stunBy) {
    const { type, move } = me.stunBy;
    const total = type === "block" ? MOVES[move].blockstun : MOVES[move].hitstun;
    const r = type === "block" ? REACTIONS.block : MOVES[move].height === "high" ? REACTIONS.high : REACTIONS.mid;
    return { clip: r.clip, time: lerp(r.from, r.to, (total - me.stun + alpha) / total), fade: 0.04 };
  }
  if (me.walk > 0) return { clip: WALKS.forward.clip, time: null, rate: WALKS.forward.rate, fade: 0.1 };
  if (me.walk < 0) return { clip: WALKS.back.clip, time: null, rate: WALKS.back.rate, fade: 0.1 };
  return { clip: ANIMS.idle, time: null, rate: 1, fade: 0.15 };
}

/** Every clip a pose can name. */
export const POSE_CLIPS = [...new Set([
  ...Object.values(ANIMS), ...Object.values(MOVES).map((m) => m.anim), ...Object.values(REACTIONS).map((r) => r.clip),
  ...Object.values(WALKS).map((w) => w.clip),
])];
