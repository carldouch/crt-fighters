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
import { Hud } from "./scene/hud.mjs";
import { loadModel } from "./scene/model.mjs";
import { createRender } from "./scene/post.mjs";
import { COLORS, createStage } from "./scene/stage.mjs";

// The page's state, read by the checks: see ARCHITECTURE.md, "The page".
window.__crt = { ready: false, renderer: null, fight: null };
const status = document.getElementById("status");
const other = { p1: "p2", p2: "p1" };

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
  const hudRoot = document.getElementById("hud");
  const hud = new Hud(hudRoot);

  window.addEventListener("resize", () => {
    view.resize(window.innerWidth / window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = null;
  let round = 0;
  renderer.setAnimationLoop((now) => {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const alpha = game.update(now);
    const { state, previous } = game;
    for (const f of Object.values(fighters)) f.update(state, previous, alpha, dt);
    for (const e of game.takeEvents()) {
      effects.spark(fighters[e.attacker].strikePoint(e.move), e.blocked, e.damage);
      if (!e.blocked) {
        fighters[other[e.attacker]].hurt(0.4 + e.damage / 12);
        hud.hit(other[e.attacker]);
      }
    }
    effects.update(dt);
    const newRound = state.round !== round;
    round = state.round;
    view.frame(fighters.p1.center(), fighters.p2.center(), model.height, dt, effects.shake(), newRound);
    hud.update(state, { renderer: window.__crt.renderer, pads: pads.connected, rematchReady: game.rematchReady }, dt);
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

