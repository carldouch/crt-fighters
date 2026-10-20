// The HUD: both hp bars with the damage trailing behind, the round wins, the clock and the result, from
// the engine's state. Plain DOM over the canvas.
import { MAX_HP, MOVES, ROUND_FRAMES, ROUND_PAUSE_FRAMES, ROUNDS_TO_WIN } from "../engine/rules.mjs";

const NAMES = { p1: "PLAYER 1", p2: "PLAYER 2" };
/** Hp per engine frame the damage trail drains, behind the hp bar. */
const TRAIL_DRAIN = 0.4;
/** Frames the "ROUND n / FIGHT" call stays on screen at the start of a round; the fight runs meanwhile. */
const CALL_FRAMES = 70;

export function createHud(root) {
  root.innerHTML = `
    <div class="hud-top">
      ${side("p1")}
      <div class="clock"><span class="time">60</span><span class="round">ROUND 1</span></div>
      ${side("p2")}
    </div>
    <div class="banner"><div class="big"></div><div class="small"></div></div>
    <div class="legend">
      <span>P1 <kbd>A</kbd><kbd>D</kbd> walk <kbd>U</kbd><kbd>I</kbd><kbd>J</kbd><kbd>K</kbd> attack</span>
      <span>hold back to block · forward + kick: high kick</span>
      <span>P2 <kbd>←</kbd><kbd>→</kbd> walk <kbd>4</kbd><kbd>5</kbd><kbd>1</kbd><kbd>2</kbd> attack (numpad)</span>
      <span class="keys"><kbd>F2</kbd> frame data · <kbd>P</kbd> pause · <kbd>.</kbd> step</span>
    </div>
    <div class="stats"></div>
    <div class="callouts"></div>`;
  const q = (s) => root.querySelector(s);
  const el = {
    p1: bar(root, "p1"),
    p2: bar(root, "p2"),
    time: q(".time"),
    round: q(".round"),
    banner: q(".banner"),
    big: q(".banner .big"),
    small: q(".banner .small"),
    stats: q(".stats"),
    callouts: q(".callouts"),
    devices: { p1: q(".side.p1 .device"), p2: q(".side.p2 .device") },
  };
  const trail = { p1: MAX_HP, p2: MAX_HP };
  let shownFrame = 0;
  window.addEventListener("keydown", (e) => {
    if (e.code === "F2") root.classList.toggle("frame-data");
  });
  const toast = (text) => {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    t.addEventListener("animationend", () => t.remove());
    root.append(t);
  };
  window.addEventListener("gamepadconnected", (e) => {
    const side = ["PLAYER 1", "PLAYER 2"][e.gamepad.index];
    toast(side ? `Gamepad ${e.gamepad.index + 1} connected: ${side}` : `Gamepad ${e.gamepad.index + 1} connected: only gamepads 1 and 2 play`);
  });
  window.addEventListener("gamepaddisconnected", (e) => toast(`Gamepad ${e.gamepad.index + 1} disconnected`));
  let lastText = "";

  return {
    /** Pops the damage of a hit, or "BLOCK", over the defender's head (`at`, in CSS pixels). */
    callout(event, at) {
      const c = document.createElement("div");
      c.className = `callout ${event.blocked ? "block" : "hit"}`;
      c.innerHTML = event.blocked ? "BLOCK" : `−${event.damage}<small>${MOVES[event.move].name}</small>`;
      c.style.left = `${at.x}px`;
      c.style.top = `${Math.max(at.y, 140)}px`; // below the hp bars
      c.addEventListener("animationend", () => c.remove());
      el.callouts.append(c);
    },
    /** Draws the state; `devices` names each player's input device, `stats` the backend and frame rate. */
    update(state, devices, stats) {
      const frames = Math.max(0, state.frame - shownFrame);
      shownFrame = state.frame;
      for (const s of ["p1", "p2"]) {
        const hp = state[s].hp;
        trail[s] = hp >= trail[s] ? hp : Math.max(hp, trail[s] - TRAIL_DRAIN * frames); // the lost hp drains slowly
        el[s].fill.style.transform = `scaleX(${hp / MAX_HP})`;
        el[s].trail.style.transform = `scaleX(${trail[s] / MAX_HP})`;
        el[s].hp.textContent = hp;
        el[s].pips.forEach((p, i) => p.classList.toggle("won", i < state.roundWins[s]));
        el[s].root.classList.toggle("hurt", state[s].reaction !== null && !state[s].reaction.blocked);
        el.devices[s].textContent = devices[s];
        el[s].frames.textContent = frameData(state[s]);
      }
      el.time.textContent = Math.ceil((ROUND_FRAMES - state.roundFrame) / 60);
      el.round.textContent = `ROUND ${state.round}`;
      el.stats.textContent = stats;
      const [big, small] = banner(state);
      const text = big + small;
      if (text !== lastText) {
        lastText = text;
        el.big.textContent = big;
        el.small.textContent = small;
        el.banner.classList.toggle("show", big !== "");
        el.banner.classList.remove("pop");
        void el.banner.offsetWidth; // restart the pop animation
        el.banner.classList.add("pop");
      }
    },
  };
}

/** The call in the middle of the screen: the round's start, its end, the match's result. */
export function banner(state) {
  if (state.over) {
    const result = state.winner ? `${NAMES[state.winner]} WINS` : "DRAW GAME";
    return [result, `${state.roundWins.p1} – ${state.roundWins.p2} · any attack button for a rematch`];
  }
  if (state.roundEndFrame !== null) {
    const { winner, reason } = state.rounds.at(-1);
    const call = reason === "ko" ? (winner ? "K.O." : "DOUBLE K.O.") : "TIME";
    const left = ROUND_PAUSE_FRAMES - (state.frame - 1 - state.roundEndFrame);
    return [call, winner ? `${NAMES[winner]} takes round ${state.rounds.length}` : `no winner: a round to each · next in ${Math.ceil(left / 60)}`];
  }
  if (state.roundFrame < CALL_FRAMES / 2) return [`ROUND ${state.round}`, ""];
  if (state.roundFrame < CALL_FRAMES) return ["FIGHT!", ""];
  return ["", ""];
}

/** What a fighter is doing, frame by frame: "lp 7/19 active" on the 7th frame of a left punch. */
export function frameData(f) {
  if (f.move) {
    const { startup, active, recovery } = MOVES[f.move.input];
    const n = f.move.frame;
    const phase = n < startup ? "startup" : n < startup + active ? "active" : "recovery";
    return `${f.move.input} ${n + 1}/${startup + active + recovery} ${phase}`;
  }
  if (f.stun > 0) return `${f.reaction.blocked ? "blockstun" : "hitstun"} ${f.stun}`;
  return f.blocking ? "blocking" : (f.walk ?? "free");
}

function side(s) {
  const pips = Array.from({ length: ROUNDS_TO_WIN }, () => '<i class="pip"></i>').join("");
  return `<div class="side ${s}">
      <div class="name">${NAMES[s]}<span class="pips">${pips}</span><span class="device"></span></div>
      <div class="bar"><div class="trail"></div><div class="fill"></div><span class="hp">${MAX_HP}</span></div>
      <div class="frames"></div>
    </div>`;
}

function bar(root, s) {
  const r = root.querySelector(`.side.${s}`);
  return { root: r, fill: r.querySelector(".fill"), trail: r.querySelector(".trail"), hp: r.querySelector(".hp"), frames: r.querySelector(".frames"), pips: [...r.querySelectorAll(".pip")] };
}
