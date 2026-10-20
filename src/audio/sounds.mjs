// Sounds, made with WebAudio (no file to load): a whoosh when a move starts, a thump for a hit, a click for
// a block, a boom for a knockout. The browser allows sound only after a key or a button is pressed.
import { MOVES } from "../engine/rules.mjs";

export function createSounds() {
  let ctx = null;
  const start = () => {
    if (ctx) return ctx.state === "suspended" && ctx.resume();
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null; // no sound, the fight goes on
    }
  };
  window.addEventListener("keydown", start);
  window.addEventListener("gamepadconnected", start);

  /** A burst of noise through a filter, then a falling tone under it. */
  function play({ noise = 0, tone = 0, from = 200, to = 60, ms = 120, volume = 0.3, filter = 1200 }) {
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime, end = t + ms / 1000;
    const out = ctx.createGain();
    out.gain.setValueAtTime(volume, t);
    out.gain.exponentialRampToValueAtTime(0.001, end);
    out.connect(ctx.destination);
    if (noise) {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (ms / 1000)), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = filter;
      const gain = ctx.createGain();
      gain.gain.value = noise;
      src.buffer = buffer;
      src.connect(bandpass).connect(gain).connect(out);
      src.start(t);
    }
    if (tone) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, end);
      const gain = ctx.createGain();
      gain.gain.value = tone;
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(end);
    }
  }

  return {
    /** The sounds of one engine frame, from the state after it and the state before it. */
    frame(state, before) {
      for (const side of ["p1", "p2"]) {
        const move = state[side].move;
        if (move?.frame === 0) play({ noise: 0.5, ms: 90 + MOVES[move.input].startup * 6, volume: 0.08, filter: 2400 });
      }
      for (const e of state.events) {
        if (e.blocked) play({ noise: 0.6, tone: 0.4, from: 900, to: 500, ms: 70, volume: 0.18, filter: 3500 });
        else play({ noise: 1, tone: 1, from: 160 + e.damage * 6, to: 50, ms: 110 + e.damage * 8, volume: 0.35, filter: 900 });
      }
      if (state.rounds.length > before.rounds.length && state.rounds.at(-1).reason === "ko") {
        play({ tone: 1, noise: 0.4, from: 120, to: 30, ms: 900, volume: 0.45, filter: 300 });
      }
    },
  };
}
