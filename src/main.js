// The page: renders the fight with three.js (WebGPU, WebGL 2 as a fallback) and runs the engine at a
// fixed 60 steps per second, whatever the display's refresh rate. The engine decides everything; the
// page feeds it inputs and shows its state.
import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { createFight, PLAYERS, step } from "./engine/fight.mjs";
import { FPS } from "./engine/rules.mjs";
import { createKeyboard } from "./input/keyboard.js";
import { readPads, rumble } from "./input/gamepad.js";
import { createControls } from "./input/index.js";
import { createEffects } from "./scene/effects.js";
import { Fighter, UNIT } from "./scene/fighter.js";
import { poseOf } from "./scene/pose.js";
import { createCamera, createStage } from "./scene/stage.js";
import { createHud } from "./ui/hud.js";
import "./ui/hud.css";
import { createSound } from "./ui/sound.js";

const STEP_MS = 1000 / FPS;
/** After a stall (a hidden tab, a slow frame), the engine catches up at most this much, then slows. */
const MAX_CATCH_UP_MS = 250;
const OTHER = { p1: "p2", p2: "p1" };

// The page's state, read by the checks: see ARCHITECTURE.md, "The page".
window.__crt = { ready: false, renderer: null, fight: null };
const status = document.getElementById("status");

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
await renderer.init();
const webgpu = Boolean(renderer.backend.isWebGPUBackend);
window.__crt.renderer = webgpu ? "webgpu" : "webgl2";
renderer.setPixelRatio(webgpu ? Math.min(window.devicePixelRatio, 1.5) : 1);

const stage = createStage();
const scene = stage.scene;
const rig = createCamera();
const effects = createEffects(scene);
const hud = createHud();
const sound = createSound();
const controls = createControls(createKeyboard());
window.addEventListener("gamepadconnected", (e) => {
  const i = e.gamepad?.index;
  if (i === 0 || i === 1) hud.toast(`Gamepad ${i + 1} connected: it plays player ${i + 1}`);
});

// With WebGPU, the neon, the screens and the hit bursts bloom. The WebGL 2 fallback, often software
// rendering, draws the scene alone.
let glow = null;
if (webgpu) {
  glow = new THREE.RenderPipeline(renderer);
  const picture = pass(scene, rig.camera).getTextureNode("output");
  glow.outputNode = picture.add(bloom(picture, 0.5, 0.35, 0.8));
}

const resize = () => {
  rig.camera.aspect = window.innerWidth / window.innerHeight;
  rig.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener("resize", resize);
resize();

status.textContent = "Loading the fighters…";
let gltf;
try {
  gltf = await new GLTFLoader().loadAsync("models/computerboi.glb");
} catch (e) {
  status.textContent = `The fighters could not load: ${e.message ?? e}`;
  throw e;
}
const fighters = { p1: new Fighter(gltf, "p1"), p2: new Fighter(gltf, "p2") };
for (const f of Object.values(fighters)) scene.add(f.root);

let fight = createFight();
let prev = fight;
let endedAt = null; // the engine frame the round ended on, while it has

/** window.__crt.fight: the part of the engine's state the checks read. */
function publish() {
  const { frame, winner, roundWins, p1, p2 } = fight;
  window.__crt.fight = { frame, winner, roundWins: { ...roundWins }, p1: { hp: p1.hp, x: p1.x }, p2: { hp: p2.hp, x: p2.x } };
}

/** One engine frame: the inputs of this frame, the step, then what it changed on the stage. */
function tick(inputs = controls.read()) {
  if (fight.over && fight.frame - endedAt >= FPS && controls.rematch()) {
    fight = prev = createFight();
    endedAt = null;
  }
  prev = fight;
  fight = step(fight, inputs);
  controls.settle(fight);
  if (fight.ended) endedAt ??= fight.frame;
  else endedAt = null;
  react();
  publish();
}

/** What the last step changed, seen and heard: swings, hits and blocks, a knockout, a new round. */
function react() {
  for (const p of PLAYERS) {
    const move = fight[p].move;
    if (move?.frame === 0) sound.swing(move.key.endsWith("k"));
  }
  const pads = fight.events.length ? readPads() : null;
  for (const e of fight.events) {
    const defender = OTHER[e.attacker];
    effects.burst(e, fight[defender].x * UNIT, e.attacker === "p1" ? 1 : -1);
    fighters[defender].struck(e.damage, e.blocked);
    rig.jolt(e.blocked ? 0.015 : 0.015 + e.damage * 0.004);
    sound.impact(e.damage, e.blocked);
    rumble(pads[defender], e.blocked ? 0.25 : 0.4 + e.damage * 0.04);
    rumble(pads[e.attacker], e.blocked ? 0.15 : 0.25);
  }
  if (fight.ended && !prev.ended && fight.rounds.at(-1).reason === "ko") sound.knockout();
  if (!fight.ended && (prev.ended || fight.frame === 1)) sound.bell();
}

let last = performance.now();
let behind = 0;
let held = false; // development only: the engine waits for __dev.play
const rate = { frames: 0, since: performance.now() };
function frame() {
  const now = performance.now();
  const dt = Math.min(now - last, MAX_CATCH_UP_MS);
  last = now;
  behind = held ? 0 : behind + dt;
  while (behind >= STEP_MS) {
    tick();
    behind -= STEP_MS;
  }
  const alpha = behind / STEP_MS;
  const sinceEnd = endedAt === null ? 0 : fight.frame - endedAt + alpha;
  const x = {};
  for (const p of PLAYERS) {
    const me = fight[p];
    x[p] = prev[p].x + (me.x - prev[p].x) * alpha;
    fighters[p].update(poseOf(fight, p, alpha, sinceEnd), x[p], dt / 1000, me.blocking || me.stunBy?.type === "block");
  }
  rig.follow(x.p1 * UNIT, x.p2 * UNIT, dt / 1000, { focus: knockedOut() });
  effects.update(dt / 1000);
  stage.update(dt / 1000);
  hud.update(fight, sinceEnd);
  const pads = readPads();
  hud.devices({ p1: pads.p1 ? "keys + gamepad" : "keys", p2: pads.p2 ? "keys + gamepad" : "keys" });
  if (glow) glow.render();
  else renderer.render(scene, rig.camera);

  rate.frames += 1;
  if (now - rate.since >= 1000) {
    hud.stats(`${webgpu ? "WebGPU" : "WebGL 2"} · ${Math.round((rate.frames * 1000) / (now - rate.since))} fps`);
    Object.assign(rate, { frames: 0, since: now });
  }
}

/** Where the knocked-out fighter lies, in metres, while its round has ended; otherwise null. */
function knockedOut() {
  if (!fight.ended || fight.rounds.at(-1).reason !== "ko") return null;
  const down = PLAYERS.filter((p) => fight[p].hp === 0);
  return down.length === 1 ? fight[down[0]].x * UNIT : null;
}

publish();
rig.follow(fight.p1.x * UNIT, fight.p2.x * UNIT, 0, { snap: true });
await renderer.compileAsync(scene, rig.camera); // compile the shaders now, not on the first frames of the fight
status.textContent = "";
last = performance.now();
renderer.setAnimationLoop(frame);
window.__crt.ready = true;

if (import.meta.env.DEV) {
  const dev = await import("./dev.js");
  dev.install({ THREE, gltf, fighters, step: tick, hold: (on) => (held = on), fight: () => fight });
}
