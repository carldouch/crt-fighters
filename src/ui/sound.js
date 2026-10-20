// The fight's sounds, synthesized with the Web Audio API: nothing to download. The browser lets a page
// play sound only after a key or a click, so the sound starts with the first one. `M` mutes it.

export function createSound(target = window) {
  let ctx = null;
  let out = null;
  let muted = false;
  let noise = null;

  const start = () => {
    try {
      if (ctx) return void ctx.resume();
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) return;
      ctx = new Context();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : 0.5;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null; // no audio device: the fight goes on in silence
    }
  };
  const key = (e) => {
    if (e.code === "KeyM") {
      muted = !muted;
      if (out) out.gain.value = muted ? 0 : 0.5;
    }
    start();
  };
  target.addEventListener("keydown", key);
  target.addEventListener("pointerdown", start);

  const live = () => ctx && ctx.state === "running" && !muted;

  /** A burst of filtered noise: `freq` its colour, `q` its focus, `length` in seconds. */
  function hiss(freq, q, length, gain, sweepTo = freq) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(sweepTo, t + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(filter).connect(env).connect(out);
    src.start(t);
    src.stop(t + length);
  }

  /** A tone that falls from `from` to `to` Hz over `length` seconds. */
  function drop(type, from, to, length, gain) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + length);
  }

  return {
    /** A move starts: a swish, longer for the kicks. */
    swing(kick) {
      if (live()) hiss(kick ? 900 : 1500, 1.2, kick ? 0.16 : 0.1, 0.12, kick ? 400 : 700);
    },
    /** A hit lands (harder with more damage), or is blocked. */
    impact(damage, blocked) {
      if (!live()) return;
      if (blocked) {
        drop("square", 1400, 700, 0.06, 0.06);
        hiss(3000, 3, 0.08, 0.25);
        return;
      }
      drop("sine", 150 + damage * 6, 45, 0.18 + damage * 0.01, 0.7);
      hiss(1800, 0.8, 0.09 + damage * 0.006, 0.55, 600);
    },
    /** A knockout. */
    knockout() {
      if (!live()) return;
      drop("sine", 120, 30, 0.9, 0.9);
      drop("triangle", 660, 110, 0.7, 0.15);
    },
    /** A round starts. */
    bell() {
      if (!live()) return;
      drop("triangle", 1320, 1300, 0.5, 0.18);
      drop("sine", 2640, 2600, 0.35, 0.06);
    },
  };
}
