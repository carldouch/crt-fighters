// The arena: a dark stage with neon edges, posts at the walls the engine stops the fighters at, a giant
// CRT screen behind, and the lights. Everything is generated here: nothing is loaded.
import * as THREE from "three/webgpu";
import { STAGE_HALF_WIDTH } from "../engine/rules.mjs";
import { UNIT } from "./model.mjs";

export const COLORS = { p1: 0x35e0ff, p2: 0xff3df0 };
const WALL = STAGE_HALF_WIDTH * UNIT; // the fighters' positions stay within ±WALL metres
const DEPTH = 3.2;

// A canvas drawn by `draw(ctx, w, h)`, as a texture.
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// The floor's tiles: dark panels with thin glowing seams.
const tiles = () => {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#100e1c";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(120, 90, 255, 0.22)";
    g.lineWidth = 2;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.fillStyle = "rgba(255, 255, 255, 0.025)";
    g.fillRect(8, 8, w - 16, h - 16);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// The giant screen behind the stage: a dim glow under scanlines, so that the fighters stand out.
const screen = () => canvasTexture(1024, 384, (g, w, h) => {
  const bg = g.createRadialGradient(w / 2, h * 0.65, 20, w / 2, h / 2, w * 0.6);
  bg.addColorStop(0, "#2a1f5c");
  bg.addColorStop(0.55, "#120d2a");
  bg.addColorStop(1, "#05040c");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(0, 0, 0, 0.35)";
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
});

// A glowing strip: unlit, and brighter than any lit surface, so that it reads as light (and blooms).
const neon = (color, w, h, d) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5) }));

export function createStage(scene) {
  scene.background = new THREE.Color(0x06050c);
  scene.fog = new THREE.Fog(0x06050c, 6, 22);

  const floorMap = tiles();
  floorMap.repeat.set(16, 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 24), new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.55, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The stage: its edges glow, purple along its length, in each player's colour at their wall.
  const edges = new THREE.Group();
  for (const z of [-DEPTH / 2, DEPTH / 2]) {
    const strip = neon(0x8a5cff, WALL * 2 + 0.6, 0.03, 0.03);
    strip.position.set(0, 0.015, z);
    edges.add(strip);
  }
  for (const [side, x] of [["p1", -1], ["p2", 1]]) {
    const end = neon(COLORS[side], 0.04, 0.03, DEPTH);
    end.position.set(x * (WALL + 0.3), 0.015, 0);
    edges.add(end);
    const post = neon(COLORS[side], 0.06, 2.2, 0.06); // behind the stage, out of the camera's way
    post.position.set(x * (WALL + 0.3), 1.1, -DEPTH / 2);
    edges.add(post);
  }
  scene.add(edges);

  // The giant CRT behind the stage, in its casing.
  const tv = new THREE.Group();
  const casing = new THREE.Mesh(new THREE.BoxGeometry(14.6, 5.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x1b1a24, roughness: 0.4, metalness: 0.3 }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 5.1), new THREE.MeshBasicMaterial({ map: screen(), toneMapped: false }));
  glass.position.z = 0.31;
  tv.add(casing, glass);
  tv.position.set(0, 2.4, -9);
  scene.add(tv);

  // Light: a soft sky, a key light from the front that casts the shadows, a rim in each player's colour.
  scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x2a1840, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-1.5, 6, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 4, bottom: -2, near: 1, far: 20 });
  key.shadow.bias = -0.0005;
  scene.add(key);
  for (const [side, x] of [["p1", -1], ["p2", 1]]) {
    const rim = new THREE.PointLight(COLORS[side], 14, 14, 1.6);
    rim.position.set(x * 5, 2.6, -1.5);
    scene.add(rim);
  }
}
