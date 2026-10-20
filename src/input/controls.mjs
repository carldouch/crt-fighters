// Turns the keyboard and the gamepads into the engine's inputs, one read per engine frame.
import { ATTACK_BUTTONS, BUTTONS } from "../engine/rules.mjs";
import { DPAD_LEFT, DPAD_RIGHT, FORWARD_IS_RIGHT, KEYS, PAD_ATTACKS, PAD_INDEX, STICK_DEADZONE } from "./bindings.mjs";

/** Frames an attack press is kept while its fighter cannot act yet: a press up to this early still comes out. */
export const BUFFER_FRAMES = 6;

const SIDES = ["p1", "p2"];
const none = () => Object.fromEntries(BUTTONS.map((b) => [b, false]));

/** The buttons a side holds on the keyboard, from the set of held KeyboardEvent codes. */
export function keyboardButtons(side, codes) {
  const held = none();
  for (const b of BUTTONS) held[b] = codes.has(KEYS[side][b]);
  return held;
}

/** The buttons a side holds on its gamepad (a Gamepad API snapshot), with the stick or the d-pad. */
export function gamepadButtons(side, pad) {
  const held = none();
  if (!pad?.connected) return held;
  const pressed = (i) => Boolean(pad.buttons[i]?.pressed);
  const x = pad.axes[0] ?? 0;
  const right = x > STICK_DEADZONE || pressed(DPAD_RIGHT);
  const left = x < -STICK_DEADZONE || pressed(DPAD_LEFT);
  held.forward = FORWARD_IS_RIGHT[side] ? right : left;
  held.back = FORWARD_IS_RIGHT[side] ? left : right;
  for (const b of ATTACK_BUTTONS) held[b] = pressed(PAD_ATTACKS[b]);
  return held;
}

/** Both devices of a side: a button counts if either holds it; forward and back together cancel out. */
export function merge(a, b) {
  const held = none();
  for (const k of BUTTONS) held[k] = a[k] || b[k];
  if (held.forward && held.back) held.forward = held.back = false;
  return held;
}

/**
 * The page's controls. `read()` gives `{ p1, p2 }` for the next engine frame; `started(state)`, after
 * that frame, clears the buffer of a fighter whose move has just started.
 *
 * The buffer: an attack pressed (not held) is fed to the engine for BUFFER_FRAMES frames, in place of
 * any other attack, until the fighter starts it. The engine starts it on the first of those frames the
 * fighter is free, as it would a held button; an attack held down keeps acting as the engine says.
 */
export function createControls(keyboard, getGamepads = () => navigator.getGamepads?.() ?? []) {
  const before = { p1: none(), p2: none() };
  const buffer = { p1: null, p2: null }; // { button, frames }
  const padSeen = { p1: new Set(), p2: new Set() }; // gamepad buttons seen down since the last read
  const ignored = { p1: new Set(), p2: new Set() }; // attack buttons held through a rematch, until released
  const devices = { p1: "keyboard", p2: "keyboard" };

  /** Every display frame: a gamepad button pressed and released between two engine frames still counts. */
  function poll() {
    const pads = getGamepads() ?? [];
    for (const side of SIDES) {
      const pad = gamepadButtons(side, pads[PAD_INDEX[side]]);
      for (const b of BUTTONS) if (pad[b]) padSeen[side].add(b);
    }
  }

  function read() {
    poll();
    const codes = keyboard.take();
    const inputs = {};
    for (const side of SIDES) {
      const keys = keyboardButtons(side, codes);
      const pad = none();
      for (const b of padSeen[side]) pad[b] = true;
      padSeen[side].clear();
      if (BUTTONS.some((b) => pad[b])) devices[side] = `gamepad ${PAD_INDEX[side] + 1}`;
      else if (BUTTONS.some((b) => keys[b])) devices[side] = "keyboard";
      const held = merge(keys, pad);
      for (const b of ignored[side]) {
        if (held[b]) held[b] = false;
        else ignored[side].delete(b);
      }
      const pressed = ATTACK_BUTTONS.find((b) => held[b] && !before[side][b]);
      before[side] = held;
      if (pressed) buffer[side] = { button: pressed, frames: BUFFER_FRAMES };
      inputs[side] = withBuffer(held, buffer[side]);
      if (buffer[side] && --buffer[side].frames === 0) buffer[side] = null;
    }
    return inputs;
  }

  function started(state) {
    for (const side of SIDES) if (state[side].move?.frame === 0) buffer[side] = null;
  }

  /** For a new fight: forgets the buffered attacks, and ignores the attack buttons held now until released. */
  function clear() {
    for (const side of SIDES) {
      buffer[side] = null;
      ignored[side] = new Set(ATTACK_BUTTONS.filter((b) => before[side][b]));
    }
  }

  return { poll, read, started, clear, devices };
}

function withBuffer(held, buffered) {
  if (!buffered) return held;
  const out = { ...held };
  for (const b of ATTACK_BUTTONS) out[b] = b === buffered.button;
  return out;
}
