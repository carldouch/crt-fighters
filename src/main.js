// The page: renders the arena with three.js (WebGPU, WebGL 2 as a fallback) and drives the engine at a
// fixed 60 steps per second, whatever the display's refresh rate. The engine decides; this file only
// feeds it inputs and shows its state.
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createFight, step, summary } from "./engine/fight.mjs";
import { FPS } from "./engine/rules.mjs";
import { createControls } from "./input/controls.mjs";
import { createKeyboard } from "./input/keyboard.mjs";
import { createArena } from "./scene/arena.mjs";
import { FightCamera } from "./scene/camera.mjs";
import { Fighter } from "./scene/fighter.mjs";
import { Sparks } from "./scene/sparks.mjs";
import { createHud } from "./hud/hud.mjs";
import { createSounds } from "./audio/sounds.mjs";

const STEP_MS = 1000 / FPS; // the engine's frame; the screen shows its latest frame, as it is
/** The most time the engine catches up on in one display frame: after a stall the fight resumes, it does not fast-forward. */
const MAX_LAG_MS = 250;
/** Below this frame rate for two seconds, the page drops to one pixel per CSS pixel. */
const LOW_FPS = 45;
/** Milliseconds after the page opens before the frame rate counts: shaders compile meanwhile. */
const SETTLE_MS = 4000;
/** Frames after the match before an attack button starts a rematch. */
const REMATCH_DELAY = 60;

// The page's state, for tests and debugging: see ARCHITECTURE.md, "The page".
window.__crt = { ready: false, renderer: null, fight: null };

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
createArena(scene);
const view = new FightCamera(window.innerWidth / window.innerHeight);
const sparks = new Sparks(scene);
const hud = createHud(document.getElementById("hud"));
const sounds = createSounds();

window.addEventListener("resize", () => {
  view.resize(window.innerWidth / window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const [gltf] = await Promise.all([new GLTFLoader().loadAsync("models/computerboi.glb"), renderer.init()]);
window.__crt.renderer = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2";
const fighters = [new Fighter(gltf, "p1", 0xff3355), new Fighter(gltf, "p2", 0x33aaff)];
for (const f of fighters) scene.add(f.root);

const keyboard = createKeyboard();
const controls = createControls(keyboard);
let state = createFight();
let before = state;
let cut = false; // the camera cuts instead of panning: a new round, a rematch
window.__crt.fight = summary(state);

/** One engine frame: read the inputs, step, then show what happened. */
function advance() {
  const inputs = controls.read();
  before = state;
  // The engine's match stays over for good; a rematch is a new fight, started by the press that asked for it.
  if (state.over && state.frame - state.roundEndFrame > REMATCH_DELAY && anyAttack(inputs)) {
    state = createFight();
    controls.clear();
    cut = true;
  } else {
    state = step(state, inputs);
    if (state.round !== before.round) cut = true; // a new round: the camera cuts to it
  }
  controls.started(state);
  for (const f of fighters) f.update(state, before);
  sounds.frame(state, before);
  for (const e of state.events) {
    sparks.add(e, state);
    if (!e.blocked) view.hit(e.damage);
    const defender = fighters[e.attacker === "p1" ? 1 : 0];
    hud.callout(e, defender.headOnScreen(view.camera, window.innerWidth, window.innerHeight));
  }
  window.__crt.fight = summary(state);
}

const anyAttack = (inputs) => ["p1", "p2"].some((s) => inputs[s].lp || inputs[s].rp || inputs[s].lk || inputs[s].rk);

let last = performance.now();
let lag = 0;
const fps = { frames: 0, since: last, value: 0, slow: 0 };

// Frame by frame: P pauses the fight, and while it is paused "." steps one engine frame.
let paused = false;
let stepsAsked = 0;
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    paused = !paused;
    if (!paused) keyboard.take(); // keys tapped during the pause do not fire on resume
  }
  else if (e.code === "Period" && paused) stepsAsked++;
});

function frame(now) {
  const elapsed = now - last;
  lag = paused ? 0 : Math.min(lag + elapsed, MAX_LAG_MS);
  last = now;
  controls.poll();
  for (; stepsAsked > 0; stepsAsked--) advance();
  while (lag >= STEP_MS) {
    advance();
    lag -= STEP_MS;
  }
  sparks.update(state.frame);
  view.place(fighters[0].root.position.x, fighters[1].root.position.x, cut ? Infinity : elapsed / 1000);
  cut = false;
  renderer.render(scene, view.camera);
  fps.frames++;
  if (now - fps.since >= 1000) {
    fps.value = Math.round((fps.frames * 1000) / (now - fps.since));
    fps.frames = 0;
    fps.since = now;
    // A slow GPU, two seconds running after the start: fewer pixels, rather than a fight that stutters.
    fps.slow = fps.value < LOW_FPS ? fps.slow + 1 : 0;
    if (fps.slow >= 2 && now > SETTLE_MS && renderer.getPixelRatio() > 1) renderer.setPixelRatio(1);
  }
  hud.update(state, controls.devices, `${window.__crt.renderer} · ${fps.value} fps · ${renderer.getPixelRatio()}x`);
}

// Draw the first frame before saying ready: input is read from the next one.
for (const f of fighters) f.update(state, before);
view.place(fighters[0].root.position.x, fighters[1].root.position.x, Infinity);
renderer.render(scene, view.camera);
last = performance.now();
renderer.setAnimationLoop(frame);
window.__crt.ready = true;
