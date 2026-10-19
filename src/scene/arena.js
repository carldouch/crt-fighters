import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MOVES, ANIMS, FPS } from '../engine/rules.mjs';
import { moveClipTime } from './animation-time.js';

const COLORS = [0xff8b46, 0x66e6ef];
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, ...extra });
function box(scene, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  scene.add(mesh);
  return mesh;
}

export async function createArena(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1219);
  scene.fog = new THREE.Fog(0x0a1219, 14, 35);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xe2f6ff, 0x40524a, 2.8));
  const key = new THREE.DirectionalLight(0xffeddc, 3.5);
  key.position.set(-2, 6, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x83eaff, 2);
  fill.position.set(3, 4, -2);
  scene.add(fill);
  box(scene, [80, 0.1, 60], [0, -0.34, -10], material(0x111e25));
  box(scene, [9.5, 0.3, 4], [0, -0.18, 0], material(0x26333b, { metalness: 0.35 }));
  box(scene, [9.2, 0.015, 3.7], [0, -0.015, 0], material(0x35474b));
  const strip = (color) => new THREE.MeshBasicMaterial({ color });
  for (const z of [-1.88, 1.88]) box(scene, [9.35, 0.035, 0.025], [0, -0.06, z], strip(0x6e8b8d));
  for (const [i, x] of [-4.65, 4.65].entries()) {
    box(scene, [0.045, 0.04, 3.75], [x, -0.04, 0], strip(COLORS[i]));
    for (const z of [-1.85, 1.85]) {
      box(scene, [0.17, 0.6, 0.17], [x, 0.1, z], material(0x26323c));
      box(scene, [0.18, 0.045, 0.18], [x, 0.43, z], strip(COLORS[i]));
    }
  }
  for (let x = -4; x <= 4; x++) box(scene, [0.012, 0.008, 3.4], [x, 0, 0], strip(0x4b6062));
  for (const z of [-1.5, -0.75, 0, 0.75, 1.5]) box(scene, [8.9, 0.008, 0.012], [0, 0, z], strip(0x4b6062));
  box(scene, [0.04, 0.012, 3.4], [0, 0.008, 0], strip(0xb2b8a2));
  for (const x of [-7, -5.5, 5.5, 7]) {
    box(scene, [0.55, 5, 0.7], [x, 2, -4.5], material(0x1b2a34));
    box(scene, [0.06, 3, 0.04], [x, 2.2, -4.12], strip(x < 0 ? COLORS[0] : COLORS[1]));
  }
  const gltf = await new GLTFLoader().loadAsync('/models/computerboi.glb');
  const fighters = COLORS.map((color, index) => {
    const root = new THREE.Group();
    const model = clone(gltf.scene);
    model.traverse((object) => {
      if (!object.isMesh) return;
      if (object.name.toLowerCase().startsWith('hitbox')) { object.visible = false; return; }
      object.frustumCulled = false;
      const tint = (source) => {
        const mat = source.clone();
        if (source.name === 'square') {
          mat.color.setHex(color);
          mat.emissive?.setHex(color);
          mat.emissiveIntensity = 0.65;
        }
        return mat;
      };
      object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material);
    });
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const scale = 2 / (bounds.max.y - bounds.min.y);
    model.scale.multiplyScalar(scale);
    model.position.y -= bounds.min.y * scale;
    root.add(model);
    root.rotation.y = index === 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(root);
    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.31, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.025;
    scene.add(marker);
    return { root, mixer, actions, marker, animationId: null, endElapsed: 0 };
  });
  const spark = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.11, 12), new THREE.MeshBasicMaterial({ color: 0xffefb7, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false }));
  scene.add(spark);
  let lastEvent = -1, impactAge = 1;
  const target = new THREE.Vector3();

  function resize(width, height) {
    camera.aspect = width / height;
    camera.position.set(0, 2.75, camera.aspect < 1.2 ? 12.5 / camera.aspect : 10.5);
    camera.lookAt(0, 0.85, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  function update(state, dt) {
    fighters.forEach((visual, index) => {
      const id = index === 0 ? 'p1' : 'p2', f = state[id];
      visual.root.position.x = f.x / 100;
      visual.marker.position.x = f.x / 100;
      visual.endElapsed = state.roundEnded ? visual.endElapsed + dt : 0;
      let name = ANIMS.idle, time = state.frame / FPS, animationId = 'idle', loop = true;
      if (state.roundEnded) {
        const result = state.rounds.at(-1);
        name = f.hp === 0 ? ANIMS.ko : result?.winner === id ? ANIMS.victory : ANIMS.idle;
        animationId = `end:${state.rounds.length}:${name}`;
        time = visual.endElapsed;
        loop = name !== ANIMS.ko;
      } else if (f.stun && f.reaction && !f.reaction.blocked) {
        name = f.reaction.height === 'high' ? ANIMS.hitHigh : ANIMS.hitMid;
        animationId = `hit:${f.reaction.frame}`;
        const duration = visual.actions.get(name)?.getClip().duration ?? 1;
        time = duration * (state.frame - f.reaction.frame - 1) / f.reaction.duration;
        loop = false;
      } else if (f.move) {
        const rule = MOVES[f.move.key];
        name = rule.anim;
        animationId = `move:${f.move.key}:${state.frame - f.move.frame}`;
        const duration = visual.actions.get(name)?.getClip().duration ?? 1;
        time = moveClipTime(rule, f.move.frame, duration);
        loop = false;
      } else if (f.walking) {
        name = ANIMS[f.walking];
        animationId = f.walking;
      }
      const action = visual.actions.get(name);
      if (action) {
        if (visual.animationId !== animationId) {
          visual.mixer.stopAllAction();
          action.reset().play();
          action.paused = true;
          visual.animationId = animationId;
        }
        const duration = action.getClip().duration;
        action.time = loop ? time % duration : Math.min(time, duration - 0.00001);
        visual.mixer.update(0);
      }
      // The engine owns translation; the clips animate only the local skeleton.
      visual.marker.material.opacity = f.blocking ? 1 : 0.45;
    });
    const event = state.events.at(-1);
    if (event && event.frame !== lastEvent) {
      lastEvent = event.frame;
      impactAge = 0;
      spark.material.color.setHex(event.blocked ? 0x7eeaff : 0xffe0a0);
      const defender = event.attacker === 'p1' ? state.p2 : state.p1;
      spark.position.set(defender.x / 100, event.move === 'lk' ? 0.55 : 1.4, 0.5);
    }
    impactAge += dt;
    spark.material.opacity = Math.max(0, 1 - impactAge / 0.18);
    spark.scale.setScalar(1 + impactAge * 5);
    spark.quaternion.copy(camera.quaternion);
    const midpoint = (state.p1.x + state.p2.x) / 200;
    target.set(midpoint * 0.18, 0.95, 0);
    camera.lookAt(target);
  }
  return { scene, camera, resize, update };
}
