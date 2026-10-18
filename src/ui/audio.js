/** Optional synthesized impact sound; no audio downloads and no autoplay. */
export function createAudio() {
  let context;
  let enabled = false;
  return {
    toggle() {
      enabled = !enabled;
      if (enabled) {
        const Audio = window.AudioContext ?? window.webkitAudioContext;
        if (!Audio) return (enabled = false);
        context ??= new Audio();
        context.resume().catch(() => {});
      }
      return enabled;
    },
    hit(event) {
      if (!enabled || context?.state !== 'running') return;
      const t = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = event.blocked ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(event.blocked ? 600 : 150 + event.damage * 9, t);
      oscillator.frequency.exponentialRampToValueAtTime(event.blocked ? 220 : 40, t + 0.1);
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.12, t + 0.005); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      oscillator.connect(gain).connect(context.destination); oscillator.start(t); oscillator.stop(t + 0.15);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    },
  };
}
