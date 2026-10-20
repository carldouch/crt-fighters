// The HUD, in HTML over the canvas: both hp bars, the round wins, the clock, the match's banners and
// the fade between rounds. Everything it shows is read from the engine's state.
import { roundOver } from "../engine/fight.mjs";
import { FPS, MAX_HP, ROUND_FRAMES, ROUNDS_TO_WIN } from "../engine/rules.mjs";

const NAMES = { p1: "PLAYER 1", p2: "PLAYER 2" };
const FADE_FRAMES = 15;
/** The frame of a round where the HUD calls "FIGHT!", after "ROUND n"; the banner ends at BANNER_END. */
export const FIGHT_FRAME = 36;
const BANNER_END = 60;

/** The banner for a state, [title, subtitle], or null. */
export function bannerOf(s, rematchReady = false) {
  if (s.over) return [s.winner ? `${NAMES[s.winner]} WINS` : "DRAW", rematchReady ? "Press Enter or Start for a rematch" : ""];
  if (roundOver(s)) {
    const { winner, reason } = s.rounds.at(-1);
    const title = reason === "time" ? "TIME" : s.p1.hp === 0 && s.p2.hp === 0 ? "DOUBLE K.O." : "K.O.";
    return [title, winner ? `${NAMES[winner]} takes round ${s.round}` : `Round ${s.round}: no winner`];
  }
  const final = s.roundWins.p1 === ROUNDS_TO_WIN - 1 && s.roundWins.p2 === ROUNDS_TO_WIN - 1;
  if (s.roundFrames < FIGHT_FRAME) return [final ? "FINAL ROUND" : `ROUND ${s.round}`, ""];
  if (s.roundFrames < BANNER_END) return ["FIGHT!", ""];
  return null;
}

/** The black between two rounds, from 0 to 1: it hides the fighters going back to their places. */
export function fadeOf(s) {
  if (!s.over && roundOver(s) && s.pause <= FADE_FRAMES) return 1 - s.pause / FADE_FRAMES;
  if (s.round > 1 && !roundOver(s) && s.roundFrames < FADE_FRAMES) return 1 - s.roundFrames / FADE_FRAMES;
  return 0;
}

export class Hud {
  constructor(root) {
    const $ = (sel) => root.querySelector(sel);
    this.sides = Object.fromEntries(["p1", "p2"].map((p) => [p, {
      el: $(`.side.${p}`), fill: $(`.side.${p} .fill`), trail: $(`.side.${p} .trail`),
      pips: [...root.querySelectorAll(`.side.${p} .pips b`)], pad: $(`.help .${p} .pad`), trailHp: MAX_HP,
    }]));
    this.time = $(".clock .time");
    this.round = $(".clock .round");
    this.banner = $(".banner");
    this.title = $(".banner .title");
    this.sub = $(".banner .sub");
    this.fade = $(".fade");
    this.badge = $(".badge");
    this.text = new Map(); // element → the text shown, to touch the page only on a change
    this.fps = 60;
  }

  #set(el, text) {
    if (this.text.get(el) !== text) {
      this.text.set(el, text);
      el.textContent = text;
    }
  }

  /** A hit on `side`: its bar flashes. */
  hit(side) {
    const el = this.sides[side].el;
    el.classList.remove("hit");
    void el.offsetWidth; // restart the animation
    el.classList.add("hit");
  }

  /** `info`: { renderer, pads: [p1 connected, p2 connected], rematchReady, sound: on or off }. */
  update(s, info, dt) {
    for (const p of ["p1", "p2"]) {
      const side = this.sides[p];
      const hp = s[p].hp;
      // The trail follows the bar down after a short delay, to show how much a hit took.
      side.trailHp = hp >= side.trailHp ? hp : Math.max(hp, side.trailHp - dt * 40);
      side.fill.style.transform = `scaleX(${hp / MAX_HP})`;
      side.trail.style.transform = `scaleX(${side.trailHp / MAX_HP})`;
      side.el.classList.toggle("low", hp > 0 && hp <= MAX_HP * 0.25);
      side.pips.forEach((b, i) => b.classList.toggle("won", s.roundWins[p] > i));
      side.pad.classList.toggle("on", info.pads[p === "p1" ? 0 : 1]);
    }
    this.#set(this.time, String(Math.max(0, Math.ceil((ROUND_FRAMES - s.roundFrames) / FPS))));
    this.#set(this.round, `ROUND ${s.round}`);
    const banner = bannerOf(s, info.rematchReady);
    this.banner.classList.toggle("on", banner !== null);
    if (banner) {
      this.#set(this.title, banner[0]);
      this.#set(this.sub, banner[1]);
    }
    this.fade.style.opacity = String(fadeOf(s));
    if (dt > 0) this.fps += (1 / dt - this.fps) * Math.min(1, dt * 2);
    this.#set(this.badge, `${info.renderer === "webgpu" ? "WebGPU" : "WebGL 2"} · ${Math.round(this.fps)} fps · sound ${info.sound ? "on" : "off"} (M)`);
  }
}
