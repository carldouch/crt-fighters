import * as THREE from 'three/webgpu';
import { createFight, step } from './engine/fight.mjs';
import { FPS } from './engine/rules.mjs';
import { createControls } from './input/controls.js';
import { createArena } from './scene/arena.js';
import { createHUD } from './scene/hud.js';
import './style.css';

const hud = createHUD();
window.__crt = { ready: false, renderer: null, fight: null };
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('arena').appendChild(renderer.domElement);
const controls = createControls();
let fight = createFight(), accumulator = 0, previousTime = null;
document.getElementById('rematch').addEventListener('click', () => {
  fight = createFight();
  accumulator = 0;
  window.__crt.fight = fight;
});
try {
  await renderer.init();
  const backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  const arena = await createArena(renderer);
  const resize = () => arena.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  resize();
  window.__crt = { ready: true, renderer: backend, fight };
  document.getElementById('loading').hidden = true;
  renderer.setAnimationLoop((time) => {
    const dt = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.25);
    previousTime = time;
    const { inputs, pads } = controls.poll();
    accumulator += dt;
    while (accumulator >= 1 / FPS) {
      fight = step(fight, inputs);
      accumulator -= 1 / FPS;
    }
    window.__crt.fight = fight;
    arena.update(fight, dt);
    hud.update(fight, backend, pads);
    renderer.render(arena.scene, arena.camera);
  });
  document.addEventListener('visibilitychange', () => {
    // Background tabs pause the local match rather than accumulating minutes of stale input.
    previousTime = null;
    accumulator = 0;
  });
} catch (error) {
  console.error(error);
  hud.error('Unable to start the arena. Reload with WebGPU or WebGL 2 enabled.');
  document.getElementById('loading').textContent = 'The renderer or fighter model could not be loaded.';
}
