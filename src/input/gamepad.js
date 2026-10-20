// Gamepads with the standard mapping: gamepad 0 is player 1, gamepad 1 is player 2 (ARCHITECTURE.md, "Controls").

/** The face buttons of each attack: 2 X/Square, 3 Y/Triangle, 0 A/Cross, 1 B/Circle. */
export const PAD_ATTACKS = { lp: 2, rp: 3, lk: 0, rk: 1 };
export const DPAD_LEFT = 14;
export const DPAD_RIGHT = 15;
export const START = 9;
/** The stick counts past half way. */
export const STICK_DEAD_ZONE = 0.5;

export const pressed = (pad, i) => Boolean(pad?.buttons?.[i]?.pressed);

/**
 * The buttons `player` holds on `pad` (null when there is none). Player 1 faces right and player 2 faces
 * left, so the stick or d-pad towards the opponent is forward.
 */
export function padButtons(pad, player) {
  const held = { forward: false, back: false, lp: false, rp: false, lk: false, rk: false };
  if (!pad) return held;
  const x = pad.axes?.[0] ?? 0;
  const left = x < -STICK_DEAD_ZONE || pressed(pad, DPAD_LEFT);
  const right = x > STICK_DEAD_ZONE || pressed(pad, DPAD_RIGHT);
  held.forward = player === "p1" ? right : left;
  held.back = player === "p1" ? left : right;
  for (const [button, i] of Object.entries(PAD_ATTACKS)) held[button] = pressed(pad, i);
  return held;
}

/** A short rumble, `strength` from 0 to 1, on gamepads that have one. */
export function rumble(pad, strength, ms = 90) {
  pad?.vibrationActuator?.playEffect?.("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength / 2 })?.catch?.(() => {});
}

/** The two players' gamepads right now: polled, as the Gamepad API wants, on every frame. */
export function readPads() {
  const pads = navigator.getGamepads?.() ?? [];
  return { p1: pads[0] ?? null, p2: pads[1] ?? null };
}
