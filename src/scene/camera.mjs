// The fighting camera: from the side, centred between the fighters, closer as they close in, always
// keeping both whole on screen.
import * as THREE from "three/webgpu";

const FOV = 30;
const MARGIN = 0.9; // metres kept beyond each fighter
const NEAREST = 2.6;
const FARTHEST = 9;

export class FightCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 100);
    this.mid = 0;
    this.distance = 7;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Frames fighters at x1 and x2 (metres), `height` tall; `snap` jumps there at once. */
  frame(x1, x2, height, dt, shake, snap = false) {
    const halfFov = THREE.MathUtils.degToRad(FOV / 2);
    const halfWidth = Math.abs(x2 - x1) / 2 + MARGIN;
    const fitWidth = halfWidth / (Math.tan(halfFov) * this.camera.aspect);
    const fitHeight = (height * 1.9) / 2 / Math.tan(halfFov);
    const distance = THREE.MathUtils.clamp(Math.max(fitWidth, fitHeight), NEAREST, FARTHEST);
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.mid += ((x1 + x2) / 2 - this.mid) * k;
    this.distance += (distance - this.distance) * k;
    this.camera.position.set(this.mid, height * 0.7 + this.distance * 0.05, this.distance).add(shake);
    this.camera.lookAt(this.mid + shake.x, height * 0.55, 0);
  }
}
