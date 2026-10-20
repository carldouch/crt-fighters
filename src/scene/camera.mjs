// The camera: from the side, a little above, framing both fighters with a margin and pulling back as they
// part, up to the whole stage. Shakes briefly when a hit lands.
import * as THREE from "three/webgpu";

const HEIGHT = 1.15, LOOK_HEIGHT = 0.6, NEAR = 2.8, FAR = 14;
/** Metres of floor kept visible beyond each fighter: a body, an outstretched leg. */
const MARGIN = 0.9;
/** How fast the camera catches up, per second. */
const CATCH_UP = 6;

export class FightCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 60);
    this.shake = 0;
    this.seed = 0;
    this.target = new THREE.Vector3();
    this.place(-1.5, 1.5, Infinity);
  }

  /** Frames the fighters drawn at x1 and x2 (metres), catching up over `seconds` of display time (Infinity: at once). */
  place(x1, x2, seconds) {
    const ease = 1 - Math.exp(-seconds * CATCH_UP);
    const halfWidth = Math.abs(x2 - x1) / 2 + MARGIN;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = THREE.MathUtils.clamp(halfWidth / (tan * this.camera.aspect), NEAR, FAR);
    this.target.lerp(new THREE.Vector3((x1 + x2) / 2, LOOK_HEIGHT, 0), ease);
    this.camera.position.lerp(new THREE.Vector3(this.target.x, HEIGHT + dist * 0.06, dist), ease);
    if (this.shake > 0.001) {
      this.seed++;
      this.camera.position.x += Math.sin(this.seed * 12.9898) * this.shake;
      this.camera.position.y += Math.sin(this.seed * 78.233) * this.shake;
      this.shake *= Math.exp(-(Number.isFinite(seconds) ? seconds : 1) * 14);
    }
    this.camera.lookAt(this.target);
  }

  hit(damage) {
    this.shake = Math.max(this.shake, 0.009 * damage);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
