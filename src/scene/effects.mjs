// What makes a hit readable: a spark where the strike lands (warm for a hit, cyan for a block) and a
// short shake of the camera, stronger for heavier hits.
import * as THREE from "three/webgpu";

const LIFE = 0.24; // seconds a spark lasts
const HIT = new THREE.Color(0xffb347);
const BLOCK = new THREE.Color(0x5fe8ff);
const disk = new THREE.CircleGeometry(0.16, 24);
const ring = new THREE.RingGeometry(0.15, 0.19, 32);
const ray = new THREE.PlaneGeometry(0.34, 0.025);

const glow = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false });

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.sparks = [];
    this.trauma = 0; // 0 to 1: how hard the camera shakes
    this.time = 0;
  }

  /** A spark at `point` (world space). `damage` sets its size and the camera's shake. */
  spark(point, blocked, damage) {
    const color = blocked ? BLOCK : HIT;
    const group = new THREE.Group();
    const parts = [new THREE.Mesh(disk, glow(color)), new THREE.Mesh(ring, glow(color))];
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(ray, glow(color));
      r.rotation.z = (i / 6) * Math.PI * 2 + 0.3;
      r.position.set(Math.cos(r.rotation.z) * 0.22, Math.sin(r.rotation.z) * 0.22, 0);
      parts.push(r);
    }
    group.add(...parts);
    group.position.copy(point);
    group.renderOrder = 10;
    this.scene.add(group);
    this.sparks.push({ group, parts, age: 0, size: blocked ? 0.65 : 0.55 + damage / 16 });
    this.trauma = Math.min(1, this.trauma + (blocked ? 0.15 : 0.25 + damage / 30));
  }

  update(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 2.5);
    this.sparks = this.sparks.filter((s) => {
      s.age += dt;
      const k = s.age / LIFE;
      if (k >= 1) {
        this.scene.remove(s.group);
        for (const p of s.parts) p.material.dispose();
        return false;
      }
      s.group.quaternion.copy(this.camera.quaternion);
      s.group.scale.setScalar(s.size * (0.6 + k * 1.2));
      for (const p of s.parts) p.material.opacity = (1 - k) * (1 - k);
      return true;
    });
  }

  /** The camera's offset for the shake now (smooth noise, scaled by trauma squared). */
  shake() {
    const a = this.trauma * this.trauma * 0.06;
    const t = this.time * 40;
    return new THREE.Vector3(Math.sin(t * 1.3) * a, Math.sin(t * 1.7 + 1) * a, 0);
  }
}
