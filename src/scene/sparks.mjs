// Hit and block flashes, where and when the engine says a strike landed, at the height of the move (head,
// body or legs): an orange starburst for a hit, a blue guard ring for a block. Timed in engine frames.
import * as THREE from "three/webgpu";
import { MOVES } from "../engine/rules.mjs";
import { METERS } from "./fighter.mjs";

/** Metres above the floor where high, mid and low moves land on the model. */
const HEIGHTS = { high: 0.8, mid: 0.5, low: 0.18 };
const FRAMES = 14;

export class Sparks {
  constructor(scene) {
    this.scene = scene;
    this.live = [];
    this.hit = new THREE.SpriteMaterial({ map: burst(), color: 0xffb347, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.block = new THREE.MeshBasicMaterial({ color: 0x6fd0ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
    this.ring = new THREE.RingGeometry(0.75, 1, 32);
  }

  /** One flash per engine event, on the defender's side that faces the attacker. */
  add(event, state) {
    const defender = state[event.attacker === "p1" ? "p2" : "p1"];
    const toward = event.attacker === "p1" ? -1 : 1;
    const object = event.blocked ? new THREE.Mesh(this.ring, this.block.clone()) : new THREE.Sprite(this.hit.clone());
    if (event.blocked) object.rotation.y = toward * 0.7; // the ring turns towards the attacker
    object.position.set(defender.x * METERS + toward * 0.2, HEIGHTS[MOVES[event.move].height], 0.1);
    this.scene.add(object);
    this.live.push({ object, born: state.frame, size: event.blocked ? 0.3 : 0.25 + event.damage * 0.035 });
  }

  /** Grows and fades each flash; `frame` is the engine's frame plus the display's share of the next one. */
  update(frame) {
    this.live = this.live.filter(({ object, born, size }) => {
      const t = (frame - born) / FRAMES;
      if (t >= 1 || t < 0) {
        this.scene.remove(object);
        object.material.dispose();
        return false;
      }
      object.scale.setScalar(size * (0.5 + Math.sqrt(t)));
      object.material.opacity = 1 - t * t;
      return true;
    });
  }
}

/** A white starburst on a transparent square, drawn once. */
function burst() {
  const size = 128, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.25, "rgba(255,255,255,0.7)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 14 : 62, a = (i / 16) * Math.PI * 2;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
