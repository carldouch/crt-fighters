// The controls of ARCHITECTURE.md, "Controls": keys by KeyboardEvent.code, gamepads in the standard mapping.
// Data only: keyboard.mjs, gamepad.mjs and controls.mjs read it.

export const KEYS = {
  p1: { forward: "KeyD", back: "KeyA", lp: "KeyU", rp: "KeyI", lk: "KeyJ", rk: "KeyK" },
  p2: { forward: "ArrowLeft", back: "ArrowRight", lp: "Numpad4", rp: "Numpad5", lk: "Numpad1", rk: "Numpad2" },
};

/** navigator.getGamepads()[PAD_INDEX[side]] plays that side. */
export const PAD_INDEX = { p1: 0, p2: 1 };

/** Attack buttons of a standard gamepad: X / Square, Y / Triangle, A / Cross, B / Circle. */
export const PAD_ATTACKS = { lp: 2, rp: 3, lk: 0, rk: 1 };

/** The d-pad's left and right buttons, and how far the stick must be pushed to count. */
export const DPAD_LEFT = 14;
export const DPAD_RIGHT = 15;
export const STICK_DEADZONE = 0.5;

/** Player 1 faces right, so right is forward; player 2 faces left. */
export const FORWARD_IS_RIGHT = { p1: true, p2: false };
