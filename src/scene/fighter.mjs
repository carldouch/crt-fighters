// One fighter on screen: a copy of the model, posed from the engine's state after every engine frame. The
// screen shows the engine's latest frame as it is: the pose on screen is the pose of that frame. The
// engine's x is where the fighter is; what is added (a step into a strike, a recoil from a hit) is drawn on
// top and always comes back to it.
import * as THREE from "three/webgpu";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { MOVES } from "../engine/rules.mjs";
import { poseOf, STRIKES } from "./poses.mjs";

/** Engine units (1 cm) to scene units (1 m). */
export const METERS = 0.01;
/** The model's size: at 60 units, the closest the engine allows, the two TV heads just touch. */
export const MODEL_SCALE = 15;
/** Metres from the floor to the top of the TV head. */
const HEAD_TOP = 1.05;
/** Metres from a fighter's centre to the front of its chest. */
const BODY_DEPTH = 0.12;
/** The most a strike steps the model forward or back, in metres. */
const MAX_LUNGE = 0.3;
/** Engine frames to blend from one clip into the next; a strike cuts in faster than a step. */
const BLEND_FRAMES = { strike: 2, other: 6 };
/** Engine frames the body flashes, and is pushed back, after a hit. */
const FLASH_FRAMES = 5;
const RECOIL_FRAMES = 10;
const HITBOXES = /^hitbox/;
const CASING = "Material.005";
const SCREEN = "square";
const STRIKE_CLIPS = new Set(Object.values(STRIKES).map((s) => s.clip));

export class Fighter {
  /**
   * @param gltf the loaded model, shared by both fighters
   * @param side "p1" (on the left, facing right) or "p2"
   * @param color the player's colour, given to the TV's casing and screens
   */
  constructor(gltf, side, color) {
    this.side = side;
    this.toward = side === "p1" ? 1 : -1; // +x is towards the opponent for player 1
    this.root = new THREE.Group();
    this.model = clone(gltf.scene);
    this.model.scale.setScalar(MODEL_SCALE);
    this.model.rotation.y = this.toward * (Math.PI / 2);
    this.materials = [];
    this.model.traverse((o) => {
      if (HITBOXES.test(o.name)) o.visible = false; // the engine's ranges decide every hit
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // skinned: its bounds do not follow the clips
      o.material = o.material.clone(); // each fighter flashes on its own
      if (o.material.name === CASING) o.material.color = new THREE.Color(color);
      if (o.material.name === SCREEN) o.material.map = screenTexture(color);
      else this.materials.push(o.material);
    });
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = new Map(gltf.animations.map((clip) => [clip.name, this.mixer.clipAction(clip)]));
    for (const a of this.actions.values()) a.play();
    this.walked = 0; // units walked, which sets the walk clip's pace
  }

  /** After each engine frame: shows `state`, the frame after `before`. */
  update(state, before) {
    const f = state[this.side];
    // A new round or a rematch: the fighter is back on its mark, with nothing left of the last pose.
    if (state.round !== before.round || state.frame < before.frame || !this.pose) {
      this.pose = null;
      this.blend = null;
      this.flash = { until: -1, color: HURT };
      this.recoil = { from: -Infinity, metres: 0 };
    } else if (f.walk) {
      this.walked += Math.abs(f.x - before[this.side].x);
    }
    for (const e of state.events) {
      if (e.attacker === this.side) continue;
      this.flash = { until: state.frame + FLASH_FRAMES, color: e.blocked ? GUARD : HURT };
      this.recoil = { from: state.frame, metres: e.blocked ? 0.06 : 0.06 + e.damage * 0.012 };
    }
    const pose = poseOf(state, this.side, this.walked);
    if (this.pose && pose.clip !== this.pose.clip) {
      this.blend = { from: this.pose, frame: state.frame, frames: BLEND_FRAMES[STRIKE_CLIPS.has(pose.clip) ? "strike" : "other"] };
    }
    this.pose = pose;
    this.draw(state);
  }

  draw(state) {
    const f = state[this.side];
    const since = state.frame - this.recoil.from;
    const recoil = since < RECOIL_FRAMES ? this.recoil.metres * (1 - since / RECOIL_FRAMES) ** 2 : 0;
    this.root.position.x = f.x * METERS + this.lunge(f, state[this.side === "p1" ? "p2" : "p1"]) - this.toward * recoil;

    for (const a of this.actions.values()) a.weight = 0;
    let weight = 1;
    if (this.blend) {
      weight = (state.frame - this.blend.frame + 1) / (this.blend.frames + 1);
      if (weight < 1) this.show(this.blend.from.clip, this.blend.from.time, 1 - weight);
      else this.blend = null;
    }
    this.show(this.pose.clip, this.pose.time, Math.min(weight, 1));
    this.mixer.update(0);

    const flash = Math.max(0, this.flash.until - state.frame) / FLASH_FRAMES;
    const guard = f.blocking ? 0.08 : 0; // a faint blue glow while holding back
    for (const m of this.materials) {
      m.emissive.copy(flash > 0 ? this.flash.color : GUARD).multiplyScalar(Math.max(flash * 0.45, guard));
    }
  }

  show(clip, time, weight) {
    const a = this.actions.get(clip);
    a.time = time;
    a.weight = weight;
  }

  /**
   * How far the model steps into a strike (or back from it) so that, at full reach, the limb ends on the
   * opponent's body when the strike is in range, and short of it by the distance it misses by when it is not.
   */
  lunge(f, other) {
    if (!f.move || !this.pose.lean) return 0;
    const { range } = MOVES[f.move.input];
    const shown = Math.min(Math.abs(other.x - f.x), range) * METERS; // where the limb should end
    const reach = STRIKES[f.move.input].reach * MODEL_SCALE + BODY_DEPTH; // where the clip puts it
    return this.toward * THREE.MathUtils.clamp(shown - reach, -MAX_LUNGE, MAX_LUNGE) * this.pose.lean;
  }

  /** Where the top of the head is on screen, in CSS pixels, for the hit callouts. */
  headOnScreen(camera, width, height) {
    const p = new THREE.Vector3(this.root.position.x, HEAD_TOP, 0).project(camera);
    return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
  }
}

const GUARD = new THREE.Color(0x3fa8ff);
const HURT = new THREE.Color(0xffe0c0);

/** The TV's side screens, in the player's colour: a glow with scanlines, until round 2 shows the NFT there. */
function screenTexture(color) {
  const size = 256, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const tint = `#${new THREE.Color(color).getHexString()}`;
  const glow = g.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.75);
  glow.addColorStop(0, tint);
  glow.addColorStop(1, "#05040a");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  g.fillStyle = "rgba(0, 0, 0, 0.35)";
  for (let y = 0; y < size; y += 4) g.fillRect(0, y, size, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
