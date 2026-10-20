// The keyboard: which bound keys are held, by KeyboardEvent.code. A key pressed and released between two
// engine frames still counts on the next one.
import { KEYS } from "./bindings.mjs";

const BOUND = new Set(Object.values(KEYS).flatMap((keys) => Object.values(keys)));

export function createKeyboard(target = window) {
  const held = new Set();
  const tapped = new Set(); // pressed since the last take()

  target.addEventListener("keydown", (e) => {
    if (!BOUND.has(e.code)) return;
    e.preventDefault(); // the arrows would scroll the page
    held.add(e.code);
    tapped.add(e.code);
  });
  target.addEventListener("keyup", (e) => held.delete(e.code));
  // A key released while the page has no focus sends no keyup: let go of everything.
  target.addEventListener("blur", () => held.clear());
  document.addEventListener("visibilitychange", () => held.clear());

  return {
    /** The codes held now, or tapped since the last call. */
    take() {
      const codes = new Set([...held, ...tapped]);
      tapped.clear();
      return codes;
    },
  };
}
