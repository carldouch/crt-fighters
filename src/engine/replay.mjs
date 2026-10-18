// Replays an input file through the engine (ARCHITECTURE.md, "The simulator"). Pure: the simulator only
// reads the file and prints what this module returns.
import { createFight, NO_INPUT, PLAYERS, step } from "./fight.mjs";
import { ATTACK_BUTTONS, BUTTONS } from "./rules.mjs";

export const MAX_REPEAT = 100_000;
export const MAX_FRAMES = 1_000_000;
const FRAME_KEYS = new Set([...PLAYERS, "repeat"]);

/** An input file the simulator refuses; `message` says where and why. */
export class InputError extends Error {}

// "forward+rk" → { forward: true, rk: true, … }. An empty string, or no value, holds nothing.
function buttonsOf(value, at) {
  if (value === undefined || value === "") return NO_INPUT;
  if (typeof value !== "string") throw new InputError(`${at}: must be a string of buttons joined by "+", such as "forward+lp", not ${JSON.stringify(value)}`);
  const held = { ...NO_INPUT };
  for (const name of value.split("+").map((b) => b.trim())) {
    if (!BUTTONS.includes(name)) throw new InputError(`${at}: unknown button ${JSON.stringify(name)} (the buttons are ${BUTTONS.join(", ")})`);
    if (held[name]) throw new InputError(`${at}: ${name} is held twice`);
    held[name] = true;
  }
  if (held.forward && held.back) throw new InputError(`${at}: forward and back cannot be held together`);
  const attacks = ATTACK_BUTTONS.filter((b) => held[b]);
  if (attacks.length > 1) throw new InputError(`${at}: one attack button at most per frame, not ${attacks.join(" and ")}`);
  return Object.freeze(held);
}

/**
 * Checks an input file's JSON and returns its frames as [{ inputs: { p1, p2 }, repeat }] and the warnings
 * (unknown keys, which are ignored). Throws InputError on anything the simulator refuses.
 */
export function parseInputFile(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new InputError("the file must be a JSON object with a frames list");
  if (!Array.isArray(doc.frames)) throw new InputError(`frames: must be a list of frames, ${doc.frames === undefined ? "and there is none" : `not ${JSON.stringify(doc.frames).slice(0, 40)}`}`);
  const warnings = [];
  let total = 0;
  const frames = doc.frames.map((f, i) => {
    const at = `frames[${i}]`;
    if (!f || typeof f !== "object" || Array.isArray(f)) throw new InputError(`${at}: must be an object such as { "p1": "forward", "repeat": 10 }, not ${JSON.stringify(f)}`);
    for (const k of Object.keys(f)) if (!FRAME_KEYS.has(k)) warnings.push(`${at}.${k}: unknown key, ignored (a frame has p1, p2 and repeat)`);
    const repeat = f.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT) throw new InputError(`${at}.repeat: must be a whole number from 1 to ${MAX_REPEAT}, not ${JSON.stringify(f.repeat)}`);
    total += repeat;
    if (total > MAX_FRAMES) throw new InputError(`${at}: the file holds more than ${MAX_FRAMES.toLocaleString("en")} frames in all`);
    return { inputs: { p1: buttonsOf(f.p1, `${at}.p1`), p2: buttonsOf(f.p2, `${at}.p2`) }, repeat };
  });
  return { frames, warnings };
}

/** Steps the engine through `frames` (from parseInputFile) and returns the simulator's result. */
export function replay(frames) {
  let state = createFight();
  const events = [];
  for (const { inputs, repeat } of frames) {
    for (let n = 0; n < repeat; n++) {
      state = step(state, inputs);
      for (const e of state.events) events.push(e);
    }
  }
  const fighter = (f) => ({ hp: f.hp, x: f.x });
  return { frame: state.frame, winner: state.winner, roundWins: state.roundWins, rounds: state.rounds, p1: fighter(state.p1), p2: fighter(state.p2), events };
}

/** The result as the simulator prints it: one JSON object, one line per event; the same result, the same bytes. */
export function formatResult(result) {
  const { events, ...rest } = result;
  const fields = Object.entries(rest).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const list = events.length ? `[\n${events.map((e) => `    ${JSON.stringify(e)}`).join(",\n")}\n  ]` : "[]";
  return `{\n${[...fields, `  "events": ${list}`].join(",\n")}\n}\n`;
}
