import './style.css';
import { createFight, step } from './engine/fight.mjs';
import { FPS } from './engine/rules.mjs';
import { createControls } from './input/controls.mjs';
import { createArena } from './scene/arena.js';
import { createHud } from './ui/hud.js';
import { createAudio } from './ui/audio.js';
import { resultAnnouncement } from './ui/announcement.mjs';

const hud = createHud();
const controls = createControls();
const audio = createAudio();
let state = createFight();
let previous = state;
let paused = false;
let accumulator = 0;
let last = null;
let startAt = 0;
const tick = 1 / FPS;
window.__crt = { ready: false, renderer: null, fight: state };
const dialog = document.getElementById('controls-dialog');
function pause(value) {
  paused = value; accumulator = 0; last = null; controls.setActive(!value); previous = state;
}
function showHelp() { pause(true); if (!dialog.open) dialog.showModal(); }
function closeHelp() { dialog.close(); pause(false); }
document.getElementById('help').addEventListener('click', showHelp);
document.getElementById('close-help').addEventListener('click', closeHelp);
document.getElementById('resume').addEventListener('click', closeHelp);
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeHelp(); });
document.addEventListener('visibilitychange', () => { controls.clear(); accumulator = 0; last = null; previous = state; });
function rematch() {
  if (state.phase !== 'over') return;
  state = createFight(); previous = state; accumulator = 0; last = null; startAt = performance.now(); controls.clear(); window.__crt.fight = state;
}
document.getElementById('rematch').addEventListener('click', rematch);
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Escape' && !dialog.open) { event.preventDefault(); showHelp(); }
  if (event.code === 'Enter' && !dialog.open) rematch();
});
document.getElementById('sound').addEventListener('click', (event) => {
  const enabled = audio.toggle(); event.currentTarget.textContent = `SOUND ${enabled ? 'ON' : 'OFF'}`; event.currentTarget.setAttribute('aria-pressed', String(enabled));
});

try {
  const arena = await createArena(document.getElementById('arena'));
  arena.render(state, state, 1, 0);
  window.__crt.renderer = arena.backend;
  window.__crt.ready = true;
  startAt = performance.now();
  hud.announce('FIGHT', 'ROUND 01 · SIGNAL LIVE');
  arena.renderer.setAnimationLoop((now) => {
    controls.poll(); // Always poll, including while paused and after a match.
    const elapsed = last === null ? 0 : Math.min((now - last) / 1000, 0.25);
    last = now;
    if (!paused && !document.hidden) {
      accumulator += elapsed;
      while (accumulator >= tick) {
        previous = state;
        state = step(state, controls.sample());
        for (let i = previous.events.length; i < state.events.length; i++) {
          const event = state.events[i]; arena.impact(event, state); hud.hit(event, now); audio.hit(event);
        }
        window.__crt.fight = state;
        accumulator -= tick;
        if (state.phase === 'over') { accumulator = 0; break; }
      }
    } else accumulator = 0;
    if (paused) hud.announce('PAUSED', 'TRANSMISSION ON HOLD');
    else if (state.phase !== 'fight') {
      const message = resultAnnouncement(state);
      hud.announce(message.title, message.subtitle, message.rematch);
    } else if (state.roundFrame < 50 && now - startAt < 1400) hud.announce('FIGHT', 'ROUND 01 · SIGNAL LIVE');
    else if (state.roundFrame < 40 && state.rounds.length) hud.announce('FIGHT', `ROUND ${state.rounds.length + 1} · SIGNAL LIVE`);
    else hud.announce('');
    hud.update(state, controls.connected(), now);
    arena.render(state, previous, state.phase === 'fight' ? accumulator / tick : 1, paused || document.hidden ? 0 : elapsed);
  });
} catch (error) {
  window.__crt.error = error.message;
  hud.announce('SIGNAL LOST', 'Unable to start the arena. Reload or try a browser with WebGL 2.');
  console.error(error);
}
