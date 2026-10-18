// Turns the keyboard and the gamepads into the engine's inputs, { p1, p2 } of { forward, back, lp, rp, lk, rk }.
// - Both devices work together: an action is held if either device holds it.
// - Forward and back held together: the newer one counts.
// - One attack at a time: the newest press. A press is also kept for BUFFER_FRAMES engine frames, so that a
//   tap made while the fighter is busy (or between two engine frames) still starts its move.
import { ATTACK_BUTTONS } from "../engine/rules.mjs";
import { PLAYERS } from "../engine/fight.mjs";

export const BUFFER_FRAMES = 8;

/**
 * The engine's buttons for one player, from what is held ({ action → press stamp }) and the buffered
 * attack (or null). Pure, for tests.
 */
export function buttonsFor(held, buffered) {
  const newest = (actions) => actions.filter((a) => held.has(a)).sort((a, b) => held.get(b) - held.get(a))[0] ?? null;
  const direction = newest(["forward", "back"]);
  const attack = buffered ?? newest(ATTACK_BUTTONS);
  return {
    forward: direction === "forward", back: direction === "back",
    lp: attack === "lp", rp: attack === "rp", lk: attack === "lk", rk: attack === "rk",
  };
}

export class Controls {
  /** `devices`: objects with forEachHeld(fn(player, action, stamp)), poll() if they need it, and takeStart(). */
  constructor(devices) {
    this.devices = devices;
    this.seen = Object.fromEntries(PLAYERS.map((p) => [p, new Map()])); // what was held at the last sample
    this.buffered = Object.fromEntries(PLAYERS.map((p) => [p, null])); // { attack, until } per player
  }

  /** Reads the devices; returns the inputs for the engine frame `frame`. */
  sample(frame) {
    const held = Object.fromEntries(PLAYERS.map((p) => [p, new Map()]));
    for (const d of this.devices) {
      d.poll?.();
      d.forEachHeld((player, action, stamp) => held[player].set(action, Math.max(stamp, held[player].get(action) ?? 0)));
    }
    const inputs = {};
    for (const p of PLAYERS) {
      // A new press of an attack (a stamp newer than the one seen last) is buffered.
      for (const a of ATTACK_BUTTONS) {
        const stamp = held[p].get(a);
        if (stamp !== undefined && stamp > (this.seen[p].get(a) ?? -1)) this.buffered[p] = { attack: a, until: frame + BUFFER_FRAMES };
      }
      this.seen[p] = held[p];
      const b = this.buffered[p];
      if (b && frame > b.until) this.buffered[p] = null;
      inputs[p] = buttonsFor(held[p], this.buffered[p]?.attack ?? null);
    }
    return inputs;
  }

  /** After each engine frame: a fighter that has just started a move used its buffered press. */
  afterStep(state) {
    for (const p of PLAYERS) if (state[p].move?.frame === 0) this.buffered[p] = null;
  }

  /** Whether Enter or a gamepad's Start was pressed since the last call. */
  takeStart() {
    return this.devices.map((d) => d.takeStart()).some(Boolean);
  }
}
