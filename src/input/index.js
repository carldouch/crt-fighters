// The players' inputs for each engine frame: the keyboard and the gamepads together, plus a short buffer
// for attacks. The engine acts on the buttons held on a frame; a player who taps an attack while still
// busy (in a move's recovery, or between two engine frames) would lose it, so a pressed attack is held
// for the engine until it starts, for BUFFER_FRAMES at most.
import { PLAYERS } from "../engine/fight.mjs";
import { ATTACK_BUTTONS } from "../engine/rules.mjs";
import { keyButtons } from "./keyboard.js";
import { padButtons, pressed, readPads, START } from "./gamepad.js";

export const BUFFER_FRAMES = 8;

const or = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] || b[k]]));

/** The controls of both players, read by `keyboard` (createKeyboard) and polled from the gamepads. */
export function createControls(keyboard) {
  const buffered = { p1: null, p2: null }; // { button, left }
  let padsBefore = { p1: {}, p2: {} };
  return {
    /** { p1, p2 } for the engine's step(), for this frame. */
    read() {
      const pads = readPads();
      const inputs = {};
      for (const p of PLAYERS) {
        const pad = padButtons(pads[p], p);
        const held = or(keyButtons(keyboard.down, p), pad);
        const taps = keyButtons(keyboard.taps, p);
        const fresh = ATTACK_BUTTONS.find((b) => taps[b] || (pad[b] && !padsBefore[p][b]));
        if (fresh) buffered[p] = { button: fresh, left: BUFFER_FRAMES };
        if (buffered[p] && !ATTACK_BUTTONS.some((b) => held[b])) held[buffered[p].button] = true;
        inputs[p] = held;
        padsBefore[p] = pad;
      }
      keyboard.taps.clear();
      return inputs;
    },
    /** After the step: a buffered attack that started is spent, the others wait one frame less. */
    settle(fight) {
      for (const p of PLAYERS) {
        const b = buffered[p];
        if (b && (fight[p].move?.frame === 0 || --b.left <= 0)) buffered[p] = null;
      }
    },
    /** Enter or Space, or Start on either gamepad: the rematch, once a match is over. */
    rematch() {
      const pads = readPads();
      return keyboard.down.has("Enter") || keyboard.down.has("Space") || pressed(pads.p1, START) || pressed(pads.p2, START);
    },
  };
}
