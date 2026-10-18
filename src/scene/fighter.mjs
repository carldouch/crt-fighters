// One fighter on screen: a clone of the model, placed and posed from the engine's state every frame.
// The engine decides; this only shows: its position (interpolated between two engine frames), and the
// clip of what the fighter does, timed to the engine's frame counters (see timing.mjs).
import * as THREE from "three/webgpu";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";
import { roundOver } from "../engine/fight.mjs";
import { ANIMS, FPS, MOVES, WALK_BACK, WALK_FORWARD } from "../engine/rules.mjs";
import { Animator } from "./animator.mjs";
import { bone, UNIT } from "./model.mjs";
import { hurtTime, moveKnots, timeAt } from "./timing.mjs";

// The knockout fall plays faster, to land within the pause after the round.
const KO_SPEED = 2.6;
const VICTORY_SPEED = 1.2;
// Walk clips are steps in place, played at the pace of the engine's walking speeds (see model.mjs), so that
// the feet do not slide; at most this much faster than the clip, beyond which the steps would blur.
const MAX_WALK_RATE = 5;
const WALK_SPEED = { forward: WALK_FORWARD * FPS * UNIT, back: WALK_BACK * FPS * UNIT }; // metres per second
// Crossfade times (seconds): short into a strike or a reaction, longer back to the stance.
const FADE = { move: 0.05, hurt: 0.04, guard: 0.05, walk: 0.12, idle: 0.15, end: 0.12 };

export class Fighter {
  /** `look`: { screen: colour of the TV screens, hue: shift of the body's colours (0 keeps them) }. */
  constructor(model, side, look) {
    this.side = side;
    this.model = model;
    this.root = cloneRig(model.root);
    this.root.scale.setScalar(model.scale);
    this.group = new THREE.Group();
    this.group.add(this.root);
    this.group.rotation.y = side === "p1" ? Math.PI / 2 : -Math.PI / 2; // the model faces +z: turn it to face the other fighter
    this.animator = new Animator(this.root, model.clips);
    this.knots = Object.fromEntries(Object.keys(MOVES).map((k) => [k, moveKnots(k, model.strikes[k].time, model.clips[MOVES[k].anim].duration)]));
    this.limbs = Object.fromEntries(Object.entries(model.strikes).map(([k, s]) => [k, bone(this.root, s.limb)]));
    this.hips = bone(this.root, "Hips");
    this.walkRate = Object.fromEntries(["forward", "back"].map((w) => [w, Math.min(MAX_WALK_RATE, WALK_SPEED[w] / model.paces[ANIMS[w]])]));
    this.screens = this.#paint(look);
    this.flash = 0;
  }

  // Gives this fighter its own materials: its TV screens glow in its colour, its body is tinted.
  #paint({ screen, hue }) {
    const screens = [];
    const copies = new Map();
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      if (!copies.has(o.material)) {
        const m = o.material.clone();
        if (m.name === "square") {
          m.emissive = new THREE.Color(screen);
          m.emissiveIntensity = 0.55;
          screens.push(m);
        } else if (hue) m.color.offsetHSL(hue, 0, 0);
        copies.set(o.material, m);
      }
      o.material = copies.get(o.material);
    });
    return screens;
  }

  /** Places and poses the fighter for `state`, `alpha` of the way to the next engine frame. */
  update(state, previous, alpha, dt) {
    const f = state[this.side];
    const p = state.round === previous.round ? previous[this.side] : f; // a new round starts in place
    this.group.position.x = THREE.MathUtils.lerp(p.x, f.x, alpha) * UNIT;
    this.animator.show(this.pose(state, alpha), dt);
    this.animator.update(dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    for (const m of this.screens) m.emissiveIntensity = 0.55 + this.flash * 3;
  }

  /** The pose for `state`: which clip, and its time or its loop (see Animator.show). */
  pose(s, alpha) {
    const f = s[this.side];
    const shown = s.frame - 1; // the frame this state is the result of
    const clip = (name) => this.model.clips[name];
    if (roundOver(s)) {
      const { winner, reason } = s.rounds.at(-1);
      const since = (shown - s.endedAt + alpha) / FPS;
      if (reason === "ko" && f.hp === 0) return { id: `ko:${s.round}`, clip: ANIMS.ko, time: Math.min(since * KO_SPEED, clip(ANIMS.ko).duration), fade: FADE.end };
      if (winner === this.side) return { id: `win:${s.round}`, clip: ANIMS.victory, time: (since * VICTORY_SPEED) % clip(ANIMS.victory).duration, fade: FADE.end };
      // A draw, or a round lost on time: the stance.
    } else if (f.move) {
      const { key, frame } = f.move;
      return { id: `move:${shown - frame}`, clip: MOVES[key].anim, time: timeAt(this.knots[key], frame + alpha), fade: FADE.move };
    } else if (f.stun > 0 && f.hurt) {
      const elapsed = f.hurt.frames - f.stun; // frames since the hit landed
      const id = `hurt:${shown - elapsed}`;
      if (f.hurt.blocked) return { id, clip: ANIMS.back, time: this.model.guardTime, fade: FADE.guard };
      const name = MOVES[f.hurt.move].height === "high" ? ANIMS.hitHigh : ANIMS.hitMid;
      return { id, clip: name, time: hurtTime(elapsed + alpha, clip(name).duration), fade: FADE.hurt };
    } else if (f.walk) {
      const [from, to] = this.model.loops[ANIMS[f.walk]];
      return { id: `walk:${f.walk}`, clip: ANIMS[f.walk], loop: { from, to, rate: this.walkRate[f.walk], restart: true }, fade: FADE.walk };
    }
    return { id: "idle", clip: ANIMS.idle, loop: { from: 0, to: clip(ANIMS.idle).duration }, fade: FADE.idle };
  }

  /** Where the body is on screen (x, metres): the camera frames the bodies, a knocked-out one included. */
  center() {
    return this.hips.getWorldPosition(new THREE.Vector3()).x;
  }

  /** The world position of the hand or foot that strikes with `move`, as posed now. */
  strikePoint(move) {
    return this.limbs[move].getWorldPosition(new THREE.Vector3());
  }

  /** The TV screens flash when this fighter is hit. */
  hurt(strength) {
    this.flash = Math.max(this.flash, strength);
  }
}
