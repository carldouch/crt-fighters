// The fight's sounds, synthesised with the Web Audio API: nothing is loaded. A hit thumps (lower and louder
// as it hurts more), a block clacks, a knockout booms, and a round starts with a chirp. Browsers start audio
// only after a gesture: the sound wakes on the first key or click. `M` mutes it.
const VOLUME = 0.5;

export class Sound {
  constructor(target) {
    this.ctx = null;
    this.muted = false;
    const wake = () => this.#wake();
    target.addEventListener("keydown", wake);
    target.addEventListener("pointerdown", wake);
    target.addEventListener("keydown", (e) => {
      if (e.code === "KeyM" && !e.repeat) this.muted = !this.muted;
    });
  }

  // Starts the audio on a gesture. Without audio (none on the machine, or refused), the fight goes on silent.
  #wake() {
    try {
      if (!this.ctx) {
        const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!Context) return;
        this.ctx = new Context();
        this.out = this.ctx.createGain();
        this.out.gain.value = VOLUME;
        this.out.connect(this.ctx.destination);
        const n = this.ctx.sampleRate * 0.5;
        this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  get #ready() {
    return this.ctx?.state === "running" && !this.muted;
  }

  // A burst of noise through a band-pass filter at `freq`, fading over `time` seconds.
  #burst(freq, q, gain, time) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + time);
    src.connect(filter).connect(env).connect(this.out);
    src.start(t);
    src.stop(t + time);
  }

  // A tone gliding from `from` to `to` Hz over `time` seconds.
  #tone(type, from, to, gain, time, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + time);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + time);
    osc.connect(env).connect(this.out);
    osc.start(t);
    osc.stop(t + time);
  }

  /** A hit of `damage`, or a block. */
  hit(damage, blocked) {
    if (!this.#ready) return;
    if (blocked) {
      this.#burst(2600, 4, 0.5, 0.07);
      this.#tone("square", 900, 600, 0.08, 0.05);
      return;
    }
    const weight = Math.min(1, damage / 12);
    this.#burst(900 - weight * 400, 1.2, 0.6 + weight * 0.4, 0.12 + weight * 0.06);
    this.#tone("sine", 180 - weight * 60, 45, 0.7 + weight * 0.3, 0.16 + weight * 0.08);
  }

  knockout() {
    if (!this.#ready) return;
    this.#tone("sine", 90, 30, 1, 0.9);
    this.#burst(300, 0.8, 0.8, 0.6);
  }

  fight() {
    if (!this.#ready) return;
    this.#tone("square", 440, 880, 0.12, 0.12);
    this.#tone("square", 660, 1320, 0.12, 0.16, 0.1);
  }
}
