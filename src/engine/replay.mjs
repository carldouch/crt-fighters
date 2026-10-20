// Input files of the simulator: read and checked whole before a single frame runs, then replayed through
// the engine. ARCHITECTURE.md, "The simulator", sets the format. No I/O here: bin/simulate.mjs does it.
import { createFight, PLAYERS, step } from "./fight.mjs";
import { ATTACK_BUTTONS, BUTTONS } from "./rules.mjs";

export const MAX_REPEAT = 100_000;
export const MAX_FRAMES = 1_000_000;

/** A file the simulator refuses; its message is the reason. */
export class ScriptError extends Error {}

/** The buttons one player holds, from "forward+rk" (or "" for none) to { forward, back, lp, rp, lk, rk }. */
export function parseButtons(text, where = "buttons") {
  if (typeof text !== "string") throw new ScriptError(`${where}: ${JSON.stringify(text)} is not a string of buttons`);
  const held = Object.fromEntries(BUTTONS.map((b) => [b, false]));
  if (text === "") return held;
  for (const b of text.split("+")) {
    if (!BUTTONS.includes(b)) throw new ScriptError(`${where}: unknown button ${JSON.stringify(b)} (the buttons are ${BUTTONS.join(", ")})`);
    if (held[b]) throw new ScriptError(`${where}: ${b} twice`);
    held[b] = true;
  }
  if (held.forward && held.back) throw new ScriptError(`${where}: forward and back together`);
  const attacks = ATTACK_BUTTONS.filter((b) => held[b]);
  if (attacks.length > 1) throw new ScriptError(`${where}: more than one attack button (${attacks.join(", ")})`);
  return held;
}

/** Checks a parsed input file and returns its frames as [{ inputs: { p1, p2 }, repeat }]. */
export function parseScript(json) {
  if (json === null || typeof json !== "object" || !Array.isArray(json.frames)) throw new ScriptError("no \"frames\" list");
  let total = 0;
  const frames = json.frames.map((item, i) => {
    const where = `frames[${i}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw new ScriptError(`${where} is not an object`);
    const repeat = item.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT) {
      throw new ScriptError(`${where}.repeat: ${JSON.stringify(item.repeat)} is not a whole number from 1 to ${MAX_REPEAT}`);
    }
    total += repeat;
    const inputs = Object.fromEntries(PLAYERS.map((p) => [p, parseButtons(item[p] ?? "", `${where}.${p}`)]));
    return { inputs, repeat };
  });
  if (total > MAX_FRAMES) throw new ScriptError(`${total} frames in all, more than ${MAX_FRAMES}`);
  return frames;
}

/** Replays checked frames from a new match and returns the simulator's result. */
export function replay(frames) {
  let state = createFight();
  const events = [];
  for (const { inputs, repeat } of frames) {
    for (let i = 0; i < repeat; i++) {
      state = step(state, inputs);
      events.push(...state.events);
    }
  }
  const { frame, winner, roundWins, rounds, p1, p2 } = state;
  return { frame, winner, roundWins, rounds, p1: { hp: p1.hp, x: p1.x }, p2: { hp: p2.hp, x: p2.x }, events };
}
