// The arena: a lit stage the width of the engine's [-400, 400], its edges marked, a backdrop of old TVs.
// Everything is drawn here: the page loads nothing but the model.
import * as THREE from "three/webgpu";
import { STAGE_HALF_WIDTH } from "../engine/rules.mjs";
import { METERS } from "./fighter.mjs";

const EDGE = STAGE_HALF_WIDTH * METERS; // 4 m each side of the centre

export function createArena(scene) {
  scene.background = new THREE.Color(0x07060c);
  scene.fog = new THREE.Fog(0x07060c, 9, 22);

  scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x1a1020, 1.1));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(-2, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5.5, right: 5.5, top: 4, bottom: -1, near: 1, far: 16 });
  scene.add(key, key.target);
  const rimP1 = new THREE.PointLight(0xff3355, 18, 9);
  rimP1.position.set(-4.5, 2.4, -1.5);
  const rimP2 = new THREE.PointLight(0x33aaff, 18, 9);
  rimP2.position.set(4.5, 2.4, -1.5);
  scene.add(rimP1, rimP2);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(EDGE * 2 + 6, 10), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The stage's edges: the fighters stop at these lines.
  for (const x of [-EDGE, EDGE]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 3.2), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    line.position.set(x, 0.01, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x222233, emissive: 0xffd23f, emissiveIntensity: 0.6 }));
    post.position.set(x, 0.7, -1.4);
    scene.add(line, post);
  }

  scene.add(backdrop());
}

/** A dark floor with a fine grid, brighter in the fighting lane. */
function floorTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#121019";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "rgba(120, 90, 255, 0.35)";
  g.lineWidth = 2;
  for (let i = 0; i <= size; i += size / 8) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, size);
    g.moveTo(0, i);
    g.lineTo(size, i);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 5);
  t.anisotropy = 4;
  return t;
}

/** A wall of stacked TV sets behind the stage, their screens glowing. */
function backdrop() {
  const group = new THREE.Group();
  const cols = 15, rows = 4, w = 1.1, h = 0.85;
  const geometry = new THREE.BoxGeometry(w * 0.94, h * 0.92, 0.7);
  const casing = new THREE.MeshStandardMaterial({ color: 0x1b1a22, roughness: 0.8 });
  const colors = [0x1d3a9a, 0x8a1f3d, 0x177a6c, 0x4f2d8f].map((c) => new THREE.Color(c).multiplyScalar(0.45));
  const tvs = new THREE.InstancedMesh(geometry, casing, cols * rows);
  const screens = new THREE.InstancedMesh(new THREE.PlaneGeometry(w * 0.7, h * 0.62), new THREE.MeshBasicMaterial(), cols * rows);
  const m = new THREE.Matrix4();
  for (let r = 0, i = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++, i++) {
      const x = (c - (cols - 1) / 2) * w, y = h / 2 + r * h, z = -4 - Math.abs(c - (cols - 1) / 2) * 0.12;
      tvs.setMatrixAt(i, m.makeTranslation(x, y, z));
      screens.setMatrixAt(i, m.makeTranslation(x, y, z + 0.351));
      screens.setColorAt(i, colors[(c * 7 + r * 3) % colors.length]);
    }
  }
  group.add(tvs, screens);
  return group;
}
