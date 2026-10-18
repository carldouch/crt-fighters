// The page: renders the arena with three.js (WebGPU, WebGL 2 as a fallback) and drives the engine.
// The engine (src/engine/) decides everything; this file wires the pieces together:
//   controls (src/input/) → Game (fixed 60 steps per second) → fighters, effects, camera, HUD (src/scene/).
// `?webgl2` in the address forces the WebGL 2 backend.
import * as THREE from "three/webgpu";
import { Game, publicView } from "./game.mjs";
import { Controls } from "./input/controls.mjs";
import { Gamepads } from "./input/gamepads.mjs";
import { Keyboard } from "./input/keyboard.mjs";
import { FightCamera } from "./scene/camera.mjs";
import { Effects } from "./scene/effects.mjs";
import { Fighter } from "./scene/fighter.mjs";
import { FIGHT_FRAME, Hud } from "./scene/hud.mjs";
import { loadModel } from "./scene/model.mjs";
import { createRender } from "./scene/post.mjs";
import { Sound } from "./scene/sound.mjs";
import { COLORS, createStage } from "./scene/stage.mjs";

// The page's state, read by the checks: see ARCHITECTURE.md, "The page".
window.__crt = { ready: false, renderer: null, fight: null };
const status = document.getElementById("status");
const other = { p1: "p2", p2: "p1" };
const CLOCK_MS = 4; // how often the engine's clock checks for a frame due

try {
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: new URLSearchParams(location.search).has("webgl2") });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.prepend(renderer.domElement);
  await renderer.init();
  window.__crt.renderer = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2";

  const scene = new THREE.Scene();
  createStage(scene);
  const view = new FightCamera(window.innerWidth / window.innerHeight);
  const model = await loadModel(`${import.meta.env.BASE_URL}models/computerboi.glb`);
  const fighters = {
    p1: new Fighter(model, "p1", { screen: COLORS.p1, hue: 0 }),
    p2: new Fighter(model, "p2", { screen: COLORS.p2, hue: 0.42 }),
  };
  scene.add(fighters.p1.group, fighters.p2.group);
  const effects = new Effects(scene, view.camera);
  const render = createRender(renderer, scene, view.camera);

  let presses = 0;
  const stamp = () => ++presses; // orders presses across the keyboard and the gamepads
  const pads = new Gamepads(stamp);
  const controls = new Controls([new Keyboard(window, stamp), pads]);
  const game = new Game(controls, (state) => {
    window.__crt.fight = publicView(state);
  });
  const sound = new Sound(window);
  const hudRoot = document.getElementById("hud");
  const hud = new Hud(hudRoot);

  // A window of no size (a collapsed pane) has nothing to draw: the fight goes on, undrawn.
  const drawable = () => window.innerWidth > 0 && window.innerHeight > 0;
  window.addEventListener("resize", () => {
    if (!drawable()) return;
    view.resize(window.innerWidth / window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // The engine keeps its own time, apart from the drawing: a timer steps it as soon as a frame is due, so
  // a slow picture (a weak GPU, software rendering) neither slows the fight nor delays an input. A hidden
  // page pauses it.
  setInterval(() => document.hidden || game.update(performance.now()), CLOCK_MS);
  document.addEventListener("visibilitychange", () => game.pause());

  let last = null;
  let round = 0;
  let seen = game.state; // the state of the last frame drawn
  renderer.setAnimationLoop(() => {
    if (!drawable()) return;
    const now = performance.now();
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const alpha = game.update(now);
    const { state, previous } = game;
    for (const f of Object.values(fighters)) f.update(state, previous, alpha, dt);
    for (const e of game.takeEvents()) {
      const hurt = other[e.attacker];
      effects.spark(fighters[e.attacker].strikePoint(e.move), e.blocked, e.damage);
      sound.hit(e.damage, e.blocked);
      pads.rumble(hurt, e.blocked ? 0.25 : 0.4 + e.damage / 20, e.blocked ? 60 : 120 + e.damage * 6);
      if (!e.blocked) {
        fighters[hurt].hurt(0.4 + e.damage / 12);
        hud.hit(hurt);
      }
    }
    if (state.rounds.length > seen.rounds.length && state.rounds.at(-1).reason === "ko") sound.knockout();
    if (state.round === seen.round && seen.roundFrames < FIGHT_FRAME && state.roundFrames >= FIGHT_FRAME) sound.fight();
    seen = state;
    effects.update(dt);
    const newRound = state.round !== round;
    round = state.round;
    view.frame(fighters.p1.center(), fighters.p2.center(), model.height, dt, effects.shake(), newRound);
    hud.update(state, { renderer: window.__crt.renderer, pads: pads.connected, rematchReady: game.rematchReady, sound: !sound.muted }, dt);
    render();
  });

  status.remove();
  hudRoot.classList.add("on");
  window.__crt.ready = true;
  if (import.meta.env.DEV) window.__crtDev = { model, fighters, game, view, effects, renderer, scene, hud };
} catch (e) {
  status.textContent = `CRT Fighters could not start: ${e.message ?? e}`;
  status.classList.add("error");
  throw e;
}

