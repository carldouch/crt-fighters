// The keyboard, by KeyboardEvent.code: which bound keys are down, and when each went down.
import { KEYS } from "./bindings.mjs";

export class Keyboard {
  /** `stamp()` numbers presses across devices, so that the newest press can win. */
  constructor(target, stamp) {
    this.down = new Map(); // code → the stamp of its press
    this.startPresses = 0; // Enter presses not yet taken
    target.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !e.repeat) this.startPresses++;
      if (!KEYS[e.code]) return;
      e.preventDefault(); // arrows would scroll the page
      if (!this.down.has(e.code)) this.down.set(e.code, stamp());
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    // A key released while the page had no focus never sends keyup: forget them all.
    target.addEventListener("blur", () => this.down.clear());
  }

  /** Calls `fn(player, action, stamp)` for each bound key held. */
  forEachHeld(fn) {
    for (const [code, stamp] of this.down) fn(...KEYS[code], stamp);
  }

  takeStart() {
    const any = this.startPresses > 0;
    this.startPresses = 0;
    return any;
  }
}
