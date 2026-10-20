// The keyboard, read by KeyboardEvent.code (the key's place, whatever the layout): ARCHITECTURE.md, "Controls".

/** Each key's player and button. */
export const KEYS = {
  KeyD: ["p1", "forward"], KeyA: ["p1", "back"], KeyU: ["p1", "lp"], KeyI: ["p1", "rp"], KeyJ: ["p1", "lk"], KeyK: ["p1", "rk"],
  ArrowLeft: ["p2", "forward"], ArrowRight: ["p2", "back"], Numpad4: ["p2", "lp"], Numpad5: ["p2", "rp"], Numpad1: ["p2", "lk"], Numpad2: ["p2", "rk"],
};

/** The buttons `player` holds when the keys in `down` (a set of codes) are pressed. */
export function keyButtons(down, player) {
  const held = { forward: false, back: false, lp: false, rp: false, lk: false, rk: false };
  for (const code of down) {
    const key = KEYS[code];
    if (key?.[0] === player) held[key[1]] = true;
  }
  return held;
}

/**
 * Tracks the keys on `target`: `down` is the set of codes held right now, `taps` the codes pressed since
 * the controls last read them, held or already released.
 */
export function createKeyboard(target = window) {
  const down = new Set();
  const taps = new Set();
  const press = (e) => {
    if (e.code in KEYS || e.code === "Space") e.preventDefault(); // the arrows and the numpad never scroll the page
    if (!e.repeat) taps.add(e.code);
    down.add(e.code);
  };
  const release = (e) => down.delete(e.code);
  const clear = () => down.clear(); // a key released while the page had no focus never sends keyup
  target.addEventListener("keydown", press);
  target.addEventListener("keyup", release);
  target.addEventListener("blur", clear);
  return {
    down,
    taps,
    dispose() {
      target.removeEventListener("keydown", press);
      target.removeEventListener("keyup", release);
      target.removeEventListener("blur", clear);
    },
  };
}
