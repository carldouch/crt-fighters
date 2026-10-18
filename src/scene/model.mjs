// The fighter model, public/models/computerboi.glb: loaded once, measured once, cloned for each player.
// What the animations need is measured on the model itself rather than guessed:
// - its scale, so that a left punch at its full range (MOVES.lp.range units) just reaches the other
//   fighter's body, as the engine decides;
// - each move's impact: the time the striking hand or foot is furthest forward, and which limb it is;
// - how much of each clip's forward hip travel to keep, so that every strike reaches as far as its range;
// - the part of each walk clip where the feet move, to loop it.
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ANIMS, MOVES } from "../engine/rules.mjs";

/** Scene metres per engine unit (1 unit = 1 cm). */
export const UNIT = 0.01;
const LIMBS = ["LeftHand", "RightHand", "LeftToeBase", "RightToeBase"];
const SAMPLES = 120;
// A knocked-out fighter keeps some of its fall's travel: it falls away from the other fighter.
const KO_TRAVEL = 0.6;

export const bone = (root, name) => root.getObjectByName(`mixamorig${name}`);

export async function loadModel(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.traverse((o) => {
    // The hitbox meshes are for debugging only: the engine's ranges decide every hit.
    if (o.name.startsWith("hitbox")) o.visible = false;
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; // a skinned mesh's bounds are its bind pose's: a kick could be culled
    }
  });
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const m = measure(root, clips);
  return { root, ...m, clips: withoutTravel(root, clips, m.restHips, m.travel) };
}

// Poses the model with `clip` at `time` (seconds) and returns world positions of its bones.
function poser(root) {
  const mixer = new THREE.AnimationMixer(root);
  const v = new THREE.Vector3();
  return {
    pose(clip, time) {
      mixer.stopAllAction();
      const a = mixer.clipAction(clip);
      a.play();
      a.time = time;
      mixer.update(0);
      root.updateMatrixWorld(true);
    },
    at: (name) => bone(root, name).getWorldPosition(v).clone(),
    dispose: () => mixer.uncacheRoot(root),
  };
}

function measure(root, clips) {
  const hips = bone(root, "Hips");
  const rest = [];
  root.traverse((o) => o.isBone && rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const restHips = hips.position.clone();
  const p = poser(root);

  // The model faces +z. Its size, in its own units, standing in its idle stance.
  p.pose(clips[ANIMS.idle], 0);
  const height = p.at("HeadTop_End").y;
  const body = new THREE.Box3().setFromObject(root.getObjectByName("hitboxbody"), true);
  const halfDepth = (body.max.z - body.min.z) / 2;

  // Each move's impact: the limb furthest forward of the hips, and when; and how far the hips travel.
  const strikes = {};
  for (const [key, move] of Object.entries(MOVES)) {
    const clip = clips[move.anim];
    p.pose(clip, 0);
    const hips0 = p.at("Hips").z;
    let best = null;
    for (let i = 0; i <= SAMPLES; i++) {
      const time = (clip.duration * i) / SAMPLES;
      p.pose(clip, time);
      const h = p.at("Hips");
      for (const limb of LIMBS) {
        const reach = p.at(limb).z - h.z;
        if (!best || reach > best.reach) best = { time, limb, reach, travel: h.z - hips0 };
      }
    }
    strikes[key] = best;
  }

  // The scale at which a left punch, at its range, ends on the front of the other fighter's body.
  const scale = (MOVES.lp.range * UNIT) / (strikes.lp.reach + halfDepth);
  // The share of each move's hip travel to keep for its strike to reach its range (none for punches).
  const travel = { [ANIMS.ko]: KO_TRAVEL };
  for (const [key, move] of Object.entries(MOVES)) {
    const s = strikes[key];
    const missing = (move.range * UNIT) / scale - halfDepth - s.reach;
    travel[move.anim] = s.travel > 1e-6 ? THREE.MathUtils.clamp(missing / s.travel, 0, 1) : 0;
  }

  // The walk clips are one step each, from the stance back to it: loop the part where the feet move.
  const loops = {};
  for (const name of [ANIMS.forward, ANIMS.back]) {
    const clip = clips[name];
    const feet = () => [p.at("LeftFoot"), p.at("RightFoot")].map((f) => f.sub(p.at("Hips")));
    p.pose(clip, 0);
    const still = feet();
    const moving = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const time = (clip.duration * i) / SAMPLES;
      p.pose(clip, time);
      if (feet().some((f, j) => f.distanceTo(still[j]) > height * 0.01)) moving.push(time);
    }
    const step = clip.duration / SAMPLES;
    loops[name] = moving.length ? [Math.max(0, moving[0] - step), Math.min(clip.duration, moving.at(-1) + step)] : [0, clip.duration];
  }

  // There is no blocking clip: a block holds the backward step's lowest crouch, its guard up.
  let guard = { time: 0, y: Infinity };
  for (let i = 0; i <= SAMPLES; i++) {
    const time = (clips[ANIMS.back].duration * i) / SAMPLES;
    p.pose(clips[ANIMS.back], time);
    const y = p.at("Hips").y;
    if (y < guard.y) guard = { time, y };
  }

  p.dispose();
  for (const [o, pos, quat, scl] of rest) o.position.copy(pos), o.quaternion.copy(quat), o.scale.copy(scl);
  root.updateMatrixWorld(true);
  return { scale, height: height * scale, halfDepth: halfDepth * scale, strikes, travel, loops, guardTime: guard.time, restHips };
}

// Copies of the clips where the hips stay over the fighter's position: the engine moves the fighter, the
// clips only pose it. Each clip keeps the `travel` share of its hips' horizontal travel (0 by default)
// and all of their vertical motion.
function withoutTravel(root, clips, restHips, travel) {
  const hips = bone(root, "Hips");
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
  const flat = (v) => v.clone().sub(up.clone().multiplyScalar(v.dot(up)));
  const anchor = flat(restHips);
  const out = {};
  for (const [name, clip] of Object.entries(clips)) {
    const copy = clip.clone();
    const track = copy.tracks.find((t) => t.name === `${hips.name}.position`);
    if (track) {
      const v = track.values;
      const first = new THREE.Vector3(v[0], v[1], v[2]);
      const keep = travel[name] ?? 0;
      for (let i = 0; i < v.length; i += 3) {
        const p = new THREE.Vector3(v[i], v[i + 1], v[i + 2]);
        const moved = flat(p.clone().sub(first)).multiplyScalar(keep);
        const q = anchor.clone().add(moved).add(up.clone().multiplyScalar(p.dot(up)));
        v[i] = q.x, v[i + 1] = q.y, v[i + 2] = q.z;
      }
    }
    out[name] = copy;
  }
  return out;
}
