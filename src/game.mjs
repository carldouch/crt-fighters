// The page's match: the engine stepped at a fixed 60 steps per second, whatever the display's refresh rate,
// fed by the controls, and published in window.__crt after every step. No rendering here: the page calls
// update() from its own clock as well as before drawing, and each call steps the frames that are due.
import { createFight, step } from "./engine/fight.mjs";
import { FPS } from "./engine/rules.mjs";

export const STEP_MS = 1000 / FPS;
// At most half a second of catching up per call: a longer gap (a hidden tab, a stalled page) is skipped.
const MAX_CATCH_UP_MS = 500;
// A rematch can start this many frames after the match ends, so that a late attack press does not skip the result.
const REMATCH_AFTER_FRAMES = 60;

/** The fight as window.__crt shows it (ARCHITECTURE.md, "The page"). */
export const publicView = (s) => ({
  frame: s.frame, winner: s.winner, roundWins: { ...s.roundWins },
  p1: { hp: s.p1.hp, x: s.p1.x }, p2: { hp: s.p2.hp, x: s.p2.x },
});

export class Game {
  /** `controls`: sample(frame), afterStep(state), takeStart(). `onStep(state)` is called after each engine frame. */
  constructor(controls, onStep = () => {}) {
    this.controls = controls;
    this.onStep = onStep;
    this.events = []; // hits and blocks since the renderer last took them
    this.restart();
  }

  restart() {
    this.state = createFight();
    this.previous = this.state;
    this.overAt = null;
    this.lag = 0;
    this.last = null;
    this.onStep(this.state);
  }

  /**
   * Steps the engine for the time elapsed since the last call (`now` in ms) and returns the fraction of a
   * frame left over, from 0 to 1, for the renderer to interpolate with.
   */
  update(now) {
    this.lag += this.last === null ? 0 : Math.min(Math.max(0, now - this.last), MAX_CATCH_UP_MS);
    this.last = now;
    const start = this.controls.takeStart();
    if (start && this.rematchReady) {
      this.restart();
      this.last = now;
    }
    while (this.lag >= STEP_MS) {
      this.lag -= STEP_MS;
      this.previous = this.state;
      this.state = step(this.state, this.controls.sample(this.state.frame));
      this.controls.afterStep(this.state);
      for (const e of this.state.events) this.events.push(e);
      if (this.state.over && this.overAt === null) this.overAt = this.state.frame;
      this.onStep(this.state);
    }
    return this.lag / STEP_MS;
  }

  /** Stops the clock until the next update(), which resumes from then: for a page that is hidden. */
  pause() {
    this.last = null;
  }

  /** Whether Enter or Start now starts a rematch. */
  get rematchReady() {
    return this.overAt !== null && this.state.frame - this.overAt >= REMATCH_AFTER_FRAMES;
  }

  /** The hits and blocks since the last call. */
  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
