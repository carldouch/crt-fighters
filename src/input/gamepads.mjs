// Gamepads, polled with navigator.getGamepads() every frame: gamepad 0 is player 1, gamepad 1 player 2.
// The stick (past half way) or the d-pad gives the direction, relative to where the player faces.
import { FORWARD_IS_RIGHT, PAD_ATTACKS, PAD_LEFT, PAD_PLAYERS, PAD_RIGHT, PAD_START, STICK_THRESHOLD } from "./bindings.mjs";

const pressed = (pad, i) => Boolean(pad.buttons[i]?.pressed);

export class Gamepads {
  constructor(stamp) {
    this.stamp = stamp;
    this.held = PAD_PLAYERS.map(() => new Map()); // per pad: action → the stamp of its press
    this.startDown = PAD_PLAYERS.map(() => false);
    this.startPresses = 0;
    this.connected = PAD_PLAYERS.map(() => false);
  }

  /** Reads every pad once; call it every frame. */
  poll() {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    PAD_PLAYERS.forEach((player, i) => {
      const pad = pads[i];
      this.connected[i] = Boolean(pad?.connected);
      const now = new Set();
      if (pad?.connected) {
        const x = pad.axes[0] ?? 0;
        const left = x < -STICK_THRESHOLD || pressed(pad, PAD_LEFT);
        const right = x > STICK_THRESHOLD || pressed(pad, PAD_RIGHT);
        const towards = FORWARD_IS_RIGHT[player] ? right : left;
        const away = FORWARD_IS_RIGHT[player] ? left : right;
        if (towards) now.add("forward");
        if (away) now.add("back");
        for (const [button, action] of Object.entries(PAD_ATTACKS)) if (pressed(pad, Number(button))) now.add(action);
        const start = pressed(pad, PAD_START);
        if (start && !this.startDown[i]) this.startPresses++;
        this.startDown[i] = start;
      }
      const held = this.held[i];
      for (const action of held.keys()) if (!now.has(action)) held.delete(action);
      for (const action of now) if (!held.has(action)) held.set(action, this.stamp());
    });
  }

  /** Calls `fn(player, action, stamp)` for each action held on a pad. */
  forEachHeld(fn) {
    PAD_PLAYERS.forEach((player, i) => {
      for (const [action, stamp] of this.held[i]) fn(player, action, stamp);
    });
  }

  takeStart() {
    const any = this.startPresses > 0;
    this.startPresses = 0;
    return any;
  }
}
