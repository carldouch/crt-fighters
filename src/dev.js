// Development tools, loaded by `npm run dev` only (never in the build), from the browser's console:
//   __dev.measureClips()   how far and when each clip's limbs go: the numbers of src/scene/clips.js
//   __dev.play(frames)      holds the page and steps it through frames in the simulator's format
//   __dev.resume()          lets the page run again
import { parseScript } from "./engine/replay.mjs";
import { ANIMS, MOVES } from "./engine/rules.mjs";
import { REACTIONS, WALKS } from "./scene/clips.js";

/** `page` gives the page's parts: { THREE, gltf, fighters, step(inputs), hold(on), fight() }. */
export function install(page) {
  window.__dev = {
    ...page,
    play(frames) {
      page.hold(true);
      for (const { inputs, repeat } of parseScript({ frames })) for (let i = 0; i < repeat; i++) page.step(inputs);
    },
    resume() {
      page.hold(false);
    },
    measureClips: () => measureClips(page),
  };
}

/**
 * Samples clips at 60 frames per second on player 1 (facing +x), in centimetres from its centre:
 * - each move: the reach of its furthest limb along the stage, every 3 frames (`curve`), when it first
 *   reaches the move's range (`contact`) and when it is furthest (`peak`);
 * - each reaction: how far back the head goes (`curve`) and when it is furthest (`peak`);
 * - each walk: how far the feet travel along the stage in the clip (`stride`).
 */
function measureClips({ THREE, gltf, fighters }) {
  const fighter = fighters.p1;
  const { mixer, model, root } = fighter;
  const bone = (n) => model.getObjectByName(`mixamorig${n}`);
  const limbs = ["LeftHand", "RightHand", "LeftToeBase", "RightToeBase"].map(bone);
  const head = bone("Head");
  const v = new THREE.Vector3();
  const x = (b) => (b.getWorldPosition(v).x - root.position.x) * 100;
  const clipOf = (name) => gltf.animations.find((c) => c.name === name);
  const sample = (name, read) => {
    const clip = clipOf(name);
    const rows = [];
    for (let i = 0; i <= Math.round(clip.duration * 60); i++) {
      mixer.stopAllAction();
      const a = mixer.clipAction(clip).reset().play();
      a.time = i / 60;
      mixer.update(0);
      root.updateMatrixWorld(true);
      rows.push({ t: i / 60, v: read() });
    }
    return rows;
  };
  const at = (rows, pick) => +rows.reduce((a, b) => (pick(b.v, a.v) ? b : a)).t.toFixed(3);
  const curve = (rows) => rows.filter((_, i) => i % 3 === 0).map((r) => Math.round(r.v)).join(" ");
  const out = { moves: {}, reactions: {}, walks: {} };
  for (const [key, move] of Object.entries(MOVES)) {
    const rows = sample(move.anim, () => Math.max(...limbs.map(x)));
    const contact = rows.find((r) => r.v >= move.range);
    out.moves[key] = { clip: move.anim, range: move.range, contact: contact ? +contact.t.toFixed(3) : null, peak: at(rows, (a, b) => a > b), curve: curve(rows) };
  }
  for (const [kind, r] of Object.entries(REACTIONS)) {
    const rows = sample(r.clip, () => x(head));
    out.reactions[kind] = { clip: r.clip, peak: at(rows, (a, b) => a < b), curve: curve(rows) };
  }
  for (const name of [ANIMS.ko, ANIMS.victory]) {
    const hips = bone("Hips");
    const rows = sample(name, () => hips.getWorldPosition(v).y * 100);
    out.reactions[name] = { clip: name, lowest: at(rows, (a, b) => a < b), curve: curve(rows) };
  }
  for (const [kind, w] of Object.entries({ ...WALKS, idle: { clip: ANIMS.idle } })) {
    const feet = [bone("LeftToeBase"), bone("RightToeBase")];
    const rows = sample(w.clip, () => feet.map(x));
    const travel = feet.map((_, i) => Math.max(...rows.map((r) => r.v[i])) - Math.min(...rows.map((r) => r.v[i])));
    out.walks[kind] = { clip: w.clip, duration: +clipOf(w.clip).duration.toFixed(3), stride: travel.map(Math.round) };
  }
  mixer.stopAllAction();
  fighter.current = null;
  return out;
}
