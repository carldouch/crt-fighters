// One fighter on the stage: a copy of computerboi.glb at the engine's position, facing the opponent,
// showing the pose pose.js reads from the engine's state.
import * as THREE from "three/webgpu";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { POSE_CLIPS } from "./pose.js";

/** The engine counts centimetres; the scene, metres. */
export const UNIT = 0.01;
/** The fighters' height on the stage, in metres. */
export const HEIGHT = 1.45;

/** Each player's colours, by the model's material names: the TV's casing and its trim. */
const LOOKS = {
  p1: { "Material.005": 0xd8402f, "Material.006": 0xf2b134 },
  p2: { "Material.005": 0x2456d8, "Material.006": 0x35c8ff },
};

export class Fighter {
  /** `gltf` is the loaded model, shared by both fighters; `player` is "p1" or "p2". */
  constructor(gltf, player) {
    this.player = player;
    this.root = new THREE.Group();
    this.root.rotation.y = player === "p1" ? Math.PI / 2 : -Math.PI / 2; // the model faces +z
    this.model = cloneSkinned(gltf.scene);
    this.root.add(this.model);

    this.materials = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.startsWith("hitbox")) {
        o.visible = false; // debugging only: the engine's ranges decide every hit
        return;
      }
      o.frustumCulled = false; // the skinned bounds lag the pose
      o.material = o.material.clone(); // each fighter its own colours and flash
      const m = o.material;
      if (m.name in LOOKS[player]) m.color.set(LOOKS[player][m.name]);
      if (m.name === "square") {
        // The TV's screen glows: round 2 shows the player's NFT on it.
        m.emissive = new THREE.Color(0xffffff);
        m.emissiveMap = m.map;
        m.emissiveIntensity = 0.5;
      } else {
        this.materials.push(m);
      }
    });
    this.flashLeft = 0;
    this.glowing = false;
    this.recoil = 0;
    this.root.add(shadow());
    this.guard = guardShield(player);
    this.root.add(this.guard);
    this.guardFlash = 0;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const name of POSE_CLIPS) {
      const clip = gltf.animations.find((a) => a.name === name);
      if (clip) this.actions[name] = this.mixer.clipAction(clip);
    }
    this.current = null;

    fitHeight(this.model, HEIGHT);
  }

  /**
   * Shows `pose` (from poseOf) at engine position `x`, `dt` seconds after the last call; `guarding` when
   * the fighter blocks (holding back, free) or is in a block's stun.
   */
  update(pose, x, dt, guarding = false) {
    this.root.position.x = x * UNIT;
    this.guardFlash = Math.max(0, this.guardFlash - dt * 4);
    const shield = Math.max(guarding ? 0.22 : 0, this.guardFlash);
    this.guard.visible = shield > 0;
    this.guard.material.opacity = shield;
    const action = this.actions[pose.clip];
    if (action && action !== this.current) {
      action.reset();
      action.setLoop(pose.time === null ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = true;
      action.play();
      if (this.current) this.current.crossFadeTo(action, pose.fade, false);
      this.current = action;
    }
    if (action) {
      action.setEffectiveTimeScale(pose.time === null ? pose.rate : 0);
      if (pose.time !== null) action.time = Math.min(pose.time, action.getClip().duration);
    }
    this.mixer.update(dt);

    // A struck fighter's model jolts back a few centimetres and eases in again: only the picture moves,
    // never the engine's position.
    this.recoil = Math.max(0, this.recoil - dt * RECOIL_EASE);
    this.model.position.z = -this.recoil;
    if (this.flashLeft > 0 || this.glowing) {
      this.flashLeft = Math.max(0, this.flashLeft - dt);
      const glow = (this.flashLeft / FLASH_SECONDS) * 0.45;
      for (const m of this.materials) m.emissive.setScalar(glow);
      this.glowing = this.flashLeft > 0;
    }
  }

  /** The fighter was hit (a white flash and a jolt), or blocked (a smaller jolt). */
  struck(damage, blocked) {
    this.recoil = blocked ? 0.04 : 0.04 + damage * 0.006;
    if (blocked) {
      this.guardFlash = 0.95;
      return;
    }
    this.flashLeft = FLASH_SECONDS;
    this.glowing = true;
  }
}

const FLASH_SECONDS = 0.1;
/** Metres per second the jolt eases back in. */
const RECOIL_EASE = 0.6;

/**
 * A hexagon of light in front of a blocking fighter, turned to the camera: faint while it holds back,
 * bright when it stops a blow.
 */
function guardShield(player) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.27, 6),
    new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  ring.position.set(0, 0.85, 0.3); // the root faces its opponent along +z
  ring.rotation.y = player === "p1" ? -Math.PI / 2 : Math.PI / 2; // undoes the root's turn: faces the camera
  ring.visible = false;
  return ring;
}

/** A soft dark disc on the floor under the fighter. */
function shadow() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const fade = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, "rgba(0,0,0,0.6)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 1.1), // narrow across the stage, long along the fighter's stance
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.005;
  return disc;
}

/** Scales `model` to `height` metres tall in its first pose, its feet on the floor. */
function fitHeight(model, height) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(height / size.y);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model, true);
  model.position.y -= fitted.min.y;
}
