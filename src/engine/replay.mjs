// Replays a simulation file through the engine (ARCHITECTURE.md, "The simulator"). No file or console here:
// bin/simulate.mjs reads the file, prints the result and turns a refusal into exit code 2.
import { ATTACK_BUTTONS, BUTTONS } from "./rules.mjs";
import { createFight, step, summary } from "./fight.mjs";

export const MAX_REPEAT = 100_000;
export const MAX_FRAMES = 1_000_000;

/** A simulation file the simulator refuses; its message is the reason printed on stderr. */
export class InputError extends Error {}

/**
 * Parses and validates a simulation file's text. Returns its frames as `[{ inputs: { p1, p2 }, repeat }]`,
 * each input in the engine's Buttons form, or throws an InputError saying why the file is refused.
 */
export function parseFrames(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new InputError(`not JSON: ${e.message}`);
  }
  if (!Array.isArray(doc?.frames)) throw new InputError('no "frames" list');
  let total = 0;
  const frames = doc.frames.map((item, i) => {
    const at = `frames[${i}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new InputError(`${at} is not an object`);
    const repeat = item.repeat === undefined ? 1 : item.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT) {
      throw new InputError(`${at}.repeat must be a whole number from 1 to ${MAX_REPEAT}, not ${JSON.stringify(item.repeat)}`);
    }
    total += repeat;
    return { inputs: { p1: buttons(item.p1, `${at}.p1`), p2: buttons(item.p2, `${at}.p2`) }, repeat };
  });
  if (total > MAX_FRAMES) throw new InputError(`${total} frames in all, more than ${MAX_FRAMES}`);
  return frames;
}

/** `"forward+rk"` → `{ forward: true, back: false, lp: false, rp: false, lk: false, rk: true }`. */
function buttons(value, at) {
  const held = Object.fromEntries(BUTTONS.map((b) => [b, false]));
  if (value === undefined || value === "") return held;
  if (typeof value !== "string") throw new InputError(`${at} must be a string of buttons joined by "+"`);
  for (const name of value.split("+")) {
    if (!BUTTONS.includes(name)) throw new InputError(`${at}: unknown button ${JSON.stringify(name)} (buttons: ${BUTTONS.join(", ")})`);
    held[name] = true;
  }
  if (held.forward && held.back) throw new InputError(`${at}: forward and back together`);
  if (ATTACK_BUTTONS.filter((b) => held[b]).length > 1) throw new InputError(`${at}: more than one attack button`);
  return held;
}

/** Runs the frames through a new fight: { frame, winner, roundWins, rounds, p1, p2, events }. */
export function replay(frames) {
  let state = createFight();
  const events = [];
  for (const { inputs, repeat } of frames) {
    for (let i = 0; i < repeat; i++) {
      state = step(state, inputs);
      events.push(...state.events);
    }
  }
  const { frame, winner, roundWins, p1, p2 } = summary(state);
  return { frame, winner, roundWins, rounds: state.rounds, p1, p2, events };
}

/** The result as printed: the layout of ARCHITECTURE.md's example, one round or event per line. */
export function formatResult(result) {
  const inline = (v) => JSON.stringify(v, null, 1).replace(/\n\s*/g, " ");
  const value = (v) => (Array.isArray(v) && v.length ? `[\n${v.map((x) => `    ${inline(x)}`).join(",\n")}\n  ]` : inline(v));
  return `{\n${Object.entries(result).map(([k, v]) => `  ${JSON.stringify(k)}: ${value(v)}`).join(",\n")}\n}\n`;
}
