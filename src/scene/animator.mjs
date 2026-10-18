// Plays one fighter's clips from poses computed each frame, with short crossfades between them. The time
// of a timed pose is set directly (it follows the engine's frames); a looping pose advances with the
// clock. A new `id` starts a new playing of a clip, faded in even when it is the same clip.
import * as THREE from "three/webgpu";

export class Animator {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = clips;
    this.slots = new Map(); // clip name → two actions, so that a clip can fade into itself
    this.current = null; // { id, action, time } shown now
    this.fading = null; // the pose fading out
    this.fade = 1; // 0 → 1 over `fadeTime`
    this.fadeTime = 0;
    this.loopTimes = new Map(); // loop clip name → its time, kept between showings
  }

  #action(name) {
    if (!this.slots.has(name)) {
      const clip = this.clips[name];
      const pair = [clip, clip.clone()].map((c) => {
        const a = this.mixer.clipAction(c);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.enabled = false;
        return a;
      });
      this.slots.set(name, { pair, next: 0 });
    }
    const slot = this.slots.get(name);
    const a = slot.pair[slot.next];
    slot.next = 1 - slot.next;
    return a;
  }

  /**
   * Shows `pose` this frame: { id, clip, fade (seconds) } with either `time` (seconds into the clip) or
   * `loop` ({ from, to, rate, restart }: loops that part of the clip, `rate` times its speed).
   */
  show(pose, dt) {
    if (this.current?.id !== pose.id) {
      if (this.fading) this.fading.action.enabled = false;
      this.fading = this.current;
      const action = this.#action(pose.clip);
      action.reset();
      action.enabled = true;
      action.paused = true;
      action.play();
      this.current = { id: pose.id, action, time: 0 };
      this.fade = this.fading ? 0 : 1;
      this.fadeTime = pose.fade ?? 0.1;
      if (pose.loop?.restart) this.loopTimes.delete(pose.clip);
    }
    let time = pose.time;
    if (pose.loop) {
      const { from, to, rate = 1 } = pose.loop;
      const span = to - from;
      const t = ((this.loopTimes.get(pose.clip) ?? 0) + dt * rate) % span;
      this.loopTimes.set(pose.clip, t);
      time = from + t;
    }
    this.current.time = time;
    this.current.action.time = time;
  }

  /** Applies the poses (and the crossfade) to the skeleton. */
  update(dt) {
    if (this.fading) {
      this.fade = this.fadeTime > 0 ? Math.min(1, this.fade + dt / this.fadeTime) : 1;
      if (this.fade >= 1) {
        this.fading.action.enabled = false;
        this.fading = null;
      }
    }
    const w = this.fade;
    // Ease the blend, so that a crossfade starts and ends softly.
    const eased = w * w * (3 - 2 * w);
    this.current?.action.setEffectiveWeight(this.fading ? eased : 1);
    this.fading?.action.setEffectiveWeight(1 - eased);
    this.mixer.update(0);
  }
}
