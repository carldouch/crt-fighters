// The HUD, in the page over the canvas: both hp bars, the round wins, the clock, and what just happened.
// It reads the engine's state; it never changes it.
import { FPS, MAX_HP, ROUND_FRAMES, ROUNDS_TO_WIN } from "../engine/rules.mjs";

const NAMES = { p1: "Player 1", p2: "Player 2" };

export function createHud(root = document.body) {
  const hud = el("div", "hud");
  const sides = {};
  for (const p of ["p1", "p2"]) {
    const side = el("div", `side ${p}`);
    const name = el("div", "name", NAMES[p]);
    const device = el("span", "device", "keyboard");
    name.append(device);
    const bar = el("div", "bar");
    const trail = el("div", "trail");
    const fill = el("div", "fill");
    bar.append(trail, fill);
    const wins = el("div", "wins");
    const pips = Array.from({ length: ROUNDS_TO_WIN }, () => wins.appendChild(el("i")));
    side.append(name, bar, wins);
    hud.append(side);
    sides[p] = { fill, trail, pips, device, hp: MAX_HP };
  }
  const clock = el("div", "clock", "60");
  hud.insertBefore(clock, sides.p2.fill.closest(".side"));
  const banner = el("div", "banner");
  const title = el("div", "title");
  const sub = el("div", "sub");
  banner.append(title, sub);
  const help = el("div", "help");
  help.innerHTML = "<b>Player 1</b> A D walk · U I J K attack · D+K high kick &nbsp;|&nbsp; <b>Player 2</b> ← → walk · Num 4 5 1 2 attack · ←+Num2 high kick &nbsp;|&nbsp; hold back to block · gamepads too · M mutes";
  const toast = el("div", "toast");
  const curtain = el("div", "curtain"); // hides the fighters' return to their marks between rounds
  const crt = el("div", "crt"); // scanlines and a vignette over the whole picture
  const stats = el("div", "stats");
  root.append(curtain, crt, hud, banner, help, toast, stats);
  let toastTimer = 0;
  const devices = { p1: "", p2: "" };

  return {
    /** Shows `fight`; `sinceEnd` is the frames since the round ended, while it has. */
    update(fight, sinceEnd) {
      curtain.style.opacity = String(curtainOf(fight));
      for (const p of ["p1", "p2"]) {
        const s = sides[p];
        const hp = fight[p].hp;
        if (hp !== s.hp) {
          s.fill.style.width = `${(hp / MAX_HP) * 100}%`;
          s.trail.style.width = `${(hp / MAX_HP) * 100}%`;
          s.fill.classList.toggle("low", hp <= 25);
          s.hp = hp;
        }
        s.pips.forEach((pip, i) => pip.classList.toggle("won", fight.roundWins[p] > i));
      }
      clock.textContent = String(Math.ceil((ROUND_FRAMES - fight.clock) / FPS));
      clock.classList.toggle("low", !fight.ended && ROUND_FRAMES - fight.clock <= 10 * FPS);
      const [t, s] = bannerOf(fight, sinceEnd);
      if (title.textContent !== t) title.textContent = t;
      if (sub.textContent !== s) sub.textContent = s;
      banner.classList.toggle("shown", t !== "");
    },
    /** What each player can play with, e.g. "keys + gamepad". */
    devices(d) {
      for (const p of ["p1", "p2"]) {
        if (devices[p] !== d[p]) sides[p].device.textContent = devices[p] = d[p];
      }
    },
    /** The renderer and the frame rate, in a corner. */
    stats(text) {
      stats.textContent = text;
    },
    /** A short note at the bottom of the screen. */
    toast(text) {
      toast.textContent = text;
      toast.classList.add("shown");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("shown"), 2500);
    },
  };
}

const CURTAIN_FRAMES = 12;

/** How dark the curtain is: it closes over the pause's last frames and opens on the next round's first. */
export function curtainOf(fight) {
  if (fight.ended && !fight.over && fight.pause < CURTAIN_FRAMES) return 1 - fight.pause / CURTAIN_FRAMES;
  if (!fight.ended && fight.round > 1 && fight.clock < CURTAIN_FRAMES) return 1 - fight.clock / CURTAIN_FRAMES;
  return 0;
}

/** The banner's two lines for this moment of the match. */
export function bannerOf(fight, sinceEnd) {
  if (fight.ended) {
    const { winner, reason } = fight.rounds.at(-1);
    const what = reason === "time" ? "Time" : winner === null ? "Double K.O." : "K.O.";
    if (fight.over && sinceEnd >= 60) {
      return [fight.winner ? `${NAMES[fight.winner]} wins` : "Draw game", "Enter, Space or Start: rematch"];
    }
    return [what, winner ? `${NAMES[winner]} takes round ${fight.round}` : `Round ${fight.round}: no winner`];
  }
  if (fight.clock < 45) return [`Round ${fight.round}`, ""];
  if (fight.clock < 80) return ["Fight!", ""];
  return ["", ""];
}

function el(tag, className = "", text = "") {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}
