import * as THREE from 'three/webgpu';
import { createFight, step } from './engine/fight.mjs';
import { attachControls } from './input/controls.mjs';
import { makeArena } from './scene/arena.js';
import './style.css';

let fight = createFight(), paused = false, sound = false, audio = null;
const controls = attachControls();
const status = document.querySelector('#status');
window.__crt = { ready: false, renderer: null, fight };
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.domElement.setAttribute('aria-label', 'Two CRT fighters in the arena');
document.querySelector('#arena').append(renderer.domElement);

function announce() {
  status.textContent = paused ? 'Paused' : fight.over ? fight.winner ? `PLAYER ${fight.winner === 'p1' ? 1 : 2} WINS` : 'MATCH DRAW' : fight.pause ? 'ROUND COMPLETE' : `ROUND ${fight.rounds.length + 1} / BEST OF 3`;
}
document.querySelector('#restart').onclick = () => { fight = createFight(); controls.clear(); paused = false; announce(); };
function togglePause() { paused = !paused; controls.clear(); document.querySelector('#pause').textContent = paused ? 'Resume' : 'Pause'; announce(); }
document.querySelector('#pause').onclick = togglePause;
window.addEventListener('keydown', (e) => { if (e.code === 'Escape') togglePause(); });
document.querySelector('#sound').onchange = (e) => { sound = e.target.checked; if (sound) { audio ??= new AudioContext(); audio.resume(); } };
function impact(blocked) {
  if (!sound || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = blocked ? 'triangle' : 'square';
  oscillator.frequency.setValueAtTime(blocked ? 340 : 120, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(45, audio.currentTime + 0.1);
  gain.gain.setValueAtTime(0.06, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
  oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.13);
}
try {
  await renderer.init();
  window.__crt.renderer = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  const arena = await makeArena(renderer);
  const resize = () => { renderer.setSize(innerWidth, innerHeight); arena.resize(innerWidth, innerHeight); };
  window.addEventListener('resize', resize); resize();
  let previous = performance.now(), accumulated = 0, flash = 0;
  document.addEventListener('visibilitychange', () => { previous = performance.now(); accumulated = 0; });
  announce(); window.__crt.ready = true;
  renderer.setAnimationLoop((now) => {
    const inputs = controls.sample();
    const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.25);
    accumulated += elapsed; previous = now;
    while (accumulated >= 1 / 60) {
      if (!paused && !document.hidden) {
        const before = fight; fight = step(fight, inputs);
        if (fight.events.length !== before.events.length) { flash = 8; impact(fight.events.at(-1).blocked); }
        if (fight.rounds.length !== before.rounds.length || fight.pause !== before.pause && fight.pause === 0) announce();
      }
      accumulated -= 1 / 60;
    }
    window.__crt.fight = fight;
    arena.update(fight, paused || document.hidden ? 0 : elapsed);
    for (const id of ['p1', 'p2']) {
      document.querySelector(`#${id}-hp`).value = fight[id].hp;
      document.querySelector(`#${id}-health`).textContent = `${fight[id].hp} HP`;
      document.querySelector(`#${id}-wins`).textContent = `${fight.roundWins[id]} / 2`;
    }
    document.querySelector('#clock').textContent = String(Math.ceil(Math.max(0, 3600 - Math.max(0, fight.roundFrame)) / 60)).padStart(2, '0');
    if (flash > 0) flash--;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    arena.camera.position.x = flash && !reduced ? Math.sin(flash * 2) * 0.025 : 0;
    renderer.render(arena.scene, arena.camera);
  });
} catch (error) {
  status.textContent = `Unable to start the arena: ${error.message}. WebGL 2 or WebGPU is required.`;
  window.__crt.error = error.message;
}
