import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFighter } from './fighter.js';

const COLORS = [0xf5a541, 0x66d9ed];
export async function createArena(host) {
  const renderer = new THREE.WebGPURenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  await renderer.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1119);
  scene.fog = new THREE.Fog(0x0b1119, 11, 25);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 50);
  camera.position.set(0, 3.0, 8.3);
  scene.add(new THREE.HemisphereLight(0xd7e8ff, 0x292233, 2.7));
  const key = new THREE.DirectionalLight(0xffedda, 3.1); key.position.set(-2, 7, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x79c9e5, 2); rim.position.set(3, 4, -3); scene.add(rim);
  const solid = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.25 });
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  function box(w, h, d, x, y, z, material) {
    const object = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    object.position.set(x, y, z); scene.add(object); return object;
  }
  const floor = solid(0x192531);
  box(11, 0.25, 5, 0, -0.15, 0, floor);
  box(10.8, 0.035, 0.035, 0, -0.02, 2.5, glow(0x96a5b8));
  const grid = new THREE.GridHelper(10, 20, 0x536173, 0x29394a);
  grid.position.y = -0.015; scene.add(grid);
  for (let i = 0; i < 2; i++) {
    box(0.035, 0.025, 4.7, i ? 4.25 : -4.25, 0, 0, glow(COLORS[i]));
    box(3.5, 0.06, 0.08, i ? 2.7 : -2.7, 0.02, -2.25, glow(COLORS[i]));
  }
  const back = solid(0x111a25);
  for (let i = -6; i <= 6; i++) {
    box(0.07, 4.4, 0.1, i * 1.2, 2.05, -4, back);
    if (i % 2 === 0) box(0.025, 2.4, 0.04, i * 1.2, 1.9, -3.9, glow(i < 0 ? 0x72502c : 0x29616c));
  }
  box(14, 0.025, 0.05, 0, 3.4, -3.8, glow(0x354c61));
  box(14, 0.025, 0.05, 0, 0.45, -3.8, glow(0x354c61));
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/computerboi.glb`);
  const fighters = [createFighter(gltf, 0), createFighter(gltf, 1)];
  for (const f of fighters) scene.add(f.root);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#020509c0'); gradient.addColorStop(0.45, '#02050988'); gradient.addColorStop(1, '#02050900');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadows = COLORS.map(() => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.004; scene.add(mesh); return mesh;
  });
  const sparks = Array.from({ length: 24 }, (_, i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.09), new THREE.MeshBasicMaterial({ color: 0xffedb6, transparent: true, depthWrite: false }));
    mesh.visible = false; scene.add(mesh); return { mesh, life: 0, velocity: new THREE.Vector3(), slot: i };
  });
  let sparkCursor = 0;
  let shake = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cameraX = 0;
  let cameraZ = 8.3;
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
  window.addEventListener('resize', resize);
  function impact(event, state) {
    const defender = event.attacker === 'p1' ? state.p2 : state.p1;
    const direction = event.attacker === 'p1' ? 1 : -1;
    const height = event.move === 'lk' ? 0.48 : event.move === 'rk' ? 1.1 : 1.6;
    for (let i = 0; i < 8; i++) {
      const p = sparks[sparkCursor++ % sparks.length];
      p.life = 0.24;
      p.mesh.position.set(defender.x / 100 - direction * 0.18, height, 0.2);
      p.mesh.material.color.set(event.blocked ? 0x82eaff : 0xffd68a);
      const angle = i * Math.PI * 2 / 8;
      p.velocity.set(Math.cos(angle) * 2.5, Math.sin(angle) * 2.5, 0.5);
      p.mesh.visible = true;
    }
    if (!reduced && !event.blocked) shake = 0.08;
  }
  return {
    renderer, fighters,
    backend: renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2',
    impact,
    render(state, previous, alpha, dt) {
      fighters.forEach((f, i) => { f.update(state, previous, alpha, dt); shadows[i].position.x = f.root.position.x; });
      for (const p of sparks) if (p.life > 0) {
        p.life -= dt; p.mesh.visible = p.life > 0; p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.material.opacity = Math.max(0, p.life / 0.24); p.mesh.scale.setScalar(0.5 + p.life * 4);
      }
      const follow = 1 - Math.exp(-dt * 4);
      cameraX += ((state.p1.x + state.p2.x) / 200 - cameraX) * follow;
      const width = Math.max(4.8, (state.p2.x - state.p1.x) / 100 + 2.8);
      const desiredZ = Math.max(6.6, width / (2 * Math.tan(THREE.MathUtils.degToRad(19)) * camera.aspect));
      cameraZ += (desiredZ - cameraZ) * follow;
      shake = Math.max(0, shake - dt);
      camera.position.set(cameraX + Math.sin(shake * 230) * shake * 0.35, 2.65, cameraZ);
      camera.lookAt(cameraX, 1.05, 0);
      renderer.render(scene, camera);
    },
    dispose() { window.removeEventListener('resize', resize); fighters.forEach((f) => f.dispose()); renderer.dispose(); },
  };
}
