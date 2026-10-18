// The controls (ARCHITECTURE.md, "Controls"): keys by KeyboardEvent.code, and the standard gamepad mapping.
// Player 1 faces right, so right is forward; player 2 faces left, so left is forward.

/** The engine's buttons a player holds: directions and attacks. */
export const ACTIONS = ["forward", "back", "lp", "rp", "lk", "rk"];

/** Keyboard codes → [player, action]. Player 2 also has ; ' . / for keyboards without a numpad. */
export const KEYS = {
  KeyD: ["p1", "forward"], KeyA: ["p1", "back"], KeyU: ["p1", "lp"], KeyI: ["p1", "rp"], KeyJ: ["p1", "lk"], KeyK: ["p1", "rk"],
  ArrowLeft: ["p2", "forward"], ArrowRight: ["p2", "back"], Numpad4: ["p2", "lp"], Numpad5: ["p2", "rp"], Numpad1: ["p2", "lk"], Numpad2: ["p2", "rk"],
  Semicolon: ["p2", "lp"], Quote: ["p2", "rp"], Period: ["p2", "lk"], Slash: ["p2", "rk"],
};

/** Gamepad 0 is player 1, gamepad 1 is player 2. */
export const PAD_PLAYERS = ["p1", "p2"];
/** Standard mapping: button index → attack. */
export const PAD_ATTACKS = { 2: "lp", 3: "rp", 0: "lk", 1: "rk" };
export const PAD_LEFT = 14;
export const PAD_RIGHT = 15;
export const PAD_START = 9;
/** The stick counts past half way. */
export const STICK_THRESHOLD = 0.5;

/** Which way is forward on screen for each player. */
export const FORWARD_IS_RIGHT = { p1: true, p2: false };
