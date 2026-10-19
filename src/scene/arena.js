import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MOVES, ANIMS } from '../engine/rules.mjs';

export async function makeArena(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101116');
  scene.fog = new THREE.Fog('#101116', 12, 30);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 3.3, 10.6); camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xd9e6ff, 0x323445, 2.3));
  const key = new THREE.DirectionalLight(0xffeddb, 3); key.position.set(2, 7, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0x67e8ed, 2); fill.position.set(-5, 3, -3); scene.add(fill);
  const mesh = (geometry, color, x, y, z) => {
    const m = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    m.position.set(x, y, z); scene.add(m); return m;
  };
  mesh(new THREE.BoxGeometry(10, 0.3, 5), '#232632', 0, -0.18, 0);
  const grid = new THREE.GridHelper(10, 20, '#5d647a', '#343a4a'); grid.position.y = -0.015; scene.add(grid);
  for (const x of [-4.5, 4.5]) {
    mesh(new THREE.BoxGeometry(0.09, 2.5, 0.09), '#626a7e', x, 1, -2);
    mesh(new THREE.BoxGeometry(0.06, 2.5, 0.06), '#626a7e', x, 1, 2);
  }
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/computerboi.glb`);
  const restMixer = new THREE.AnimationMixer(gltf.scene);
  restMixer.clipAction(gltf.animations.find((clip) => clip.name === ANIMS.idle)).play();
  restMixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  const referenceBounds = new THREE.Box3().setFromObject(gltf.scene);
  const normalization = 2 / referenceBounds.getSize(new THREE.Vector3()).y;
  const fighters = [];
  for (const [index, color] of ['#67e8ed', '#ffbd69'].entries()) {
    const root = new THREE.Group(); const model = clone(gltf.scene);
    model.traverse((node) => {
      if (/hitbox/i.test(node.name)) node.visible = false;
      if (node.isMesh) {
        node.frustumCulled = false;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        node.material = materials.map((m) => { const copy = m.clone(); if (m.name === 'square') { copy.color.set(color); copy.emissive?.set(color); copy.emissiveIntensity = 0.4; } return copy; });
        if (node.material.length === 1) node.material = node.material[0];
      }
    });
    model.scale.multiplyScalar(normalization);
    model.position.y = -referenceBounds.min.y * normalization;
    model.rotation.y = index === 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(model); scene.add(root);
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    const shadow = mesh(new THREE.CircleGeometry(0.48, 24), '#111217', 0, 0.002, 0); shadow.rotation.x = -Math.PI / 2;
    fighters.push({ root, mixer, actions, current: null, shadow });
  }
  let endFrame = 0, endTime = 0;
  return { scene, camera, resize(width, height) { camera.aspect = width / height; camera.updateProjectionMatrix(); },
    update(state, elapsed = 0) {
      if (state.roundFrame === -1 && endFrame === 0) { endFrame = state.frame; endTime = 0; }
      if (state.roundFrame !== -1) { endFrame = 0; endTime = 0; }
      else endTime += elapsed;
      fighters.forEach((view, i) => {
        const id = i === 0 ? 'p1' : 'p2', p = state[id];
        view.root.position.x = p.x / 100; view.shadow.position.x = p.x / 100;
        let name = ANIMS[p.motion] ?? ANIMS.idle, time = state.frame / 60;
        if (p.move) { const r = MOVES[p.move.key]; name = r.anim; time = p.move.frame / (r.startup + r.active + r.recovery) * view.actions[name].getClip().duration; }
        else if (p.stun) {
          name = p.hitHeight === 'high' ? ANIMS.hitHigh : ANIMS.hitMid;
          const lastHit = state.events.findLast((event) => event.attacker !== id);
          time = lastHit ? (state.frame - lastHit.frame) / 60 : 0;
        }
        if (state.roundFrame === -1) {
          const wonRound = state.rounds.at(-1)?.winner;
          name = p.hp === 0 || wonRound && wonRound !== id ? ANIMS.ko : wonRound === id ? ANIMS.victory : ANIMS.idle;
          time = endTime;
        }
        if (view.current !== name) {
          view.mixer.stopAllAction(); view.current = name; view.actions[name].reset().play();
        }
        const action = view.actions[name];
        const duration = action.getClip().duration;
        action.time = p.move || state.roundFrame === -1 ? Math.min(time, duration - 0.001) : time % duration;
        view.mixer.update(0);
      });
    } };
}
