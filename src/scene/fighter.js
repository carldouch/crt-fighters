import * as THREE from 'three/webgpu';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMS, MOVES } from '../engine/rules.mjs';

/** Map the authored contact pose to the first active engine frame. */
export function moveTime(frame, move, duration, contact) {
  if (frame <= move.startup) return contact * (frame / move.startup);
  const finish = move.startup + move.active + move.recovery;
  return contact + (duration - contact) * Math.min(1, (frame - move.startup) / (finish - move.startup));
}

export function createFighter(gltf, index) {
  const root = new THREE.Group();
  const model = clone(gltf.scene);
  root.add(model);
  const color = new THREE.Color(index === 0 ? '#f5a541' : '#66d9ed');
  const materials = [];
  const display = document.createElement('canvas');
  display.width = display.height = 128;
  const ctx = display.getContext('2d');
  ctx.fillStyle = '#091b22'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = `#${color.getHexString()}`; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 108, 108);
  ctx.fillStyle = `#${color.getHexString()}`; ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center'; ctx.fillText(index ? '02' : '01', 64, 85);
  ctx.fillStyle = '#00000033'; for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1);
  const screen = new THREE.CanvasTexture(display); screen.colorSpace = THREE.SRGBColorSpace; screen.flipY = false; screen.wrapS = THREE.RepeatWrapping; screen.repeat.x = -1; screen.offset.x = 1;
  model.traverse((object) => {
    if (/^hitbox/i.test(object.name)) object.visible = false;
    if (!object.isMesh) return;
    object.frustumCulled = false; // Animated limbs can leave the bind-pose bounds.
    const tint = (original) => {
      const m = original.clone();
      if (m.name === 'square') {
        m.map = screen; m.color.set(0xffffff); m.emissive = color.clone(); m.emissiveMap = screen; m.emissiveIntensity = 0.4;
      } else if (m.color) {
        if (m.name === 'Material.005') m.color.copy(color).multiplyScalar(0.7);
        else if (m.color.g > m.color.r * 2) m.color.set(0x7c9196).lerp(color, 0.25);
        else m.color.lerp(color, 0.35);
        m.roughness = 0.7; m.metalness = 0.15;
      }
      materials.push(m);
      return m;
    };
    object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material);
  });
  const clips = new Map();
  const hips = model.getObjectByName('mixamorigHips');
  for (const original of gltf.animations) {
    const clip = original.clone();
    // This model's armature is rotated 90° around X: local Z is vertical.
    // Preserve vertical motion, removing horizontal root travel from the animation.
    for (const track of clip.tracks) if (/Hips\.position$/.test(track.name)) {
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = hips?.position.x ?? track.values[0];
        track.values[i + 1] = hips?.position.y ?? track.values[1];
      }
    }
    clips.set(clip.name, clip);
  }
  for (const name of [...Object.values(ANIMS), ...Object.values(MOVES).map((m) => m.anim)]) {
    if (!clips.has(name)) throw new Error(`Missing fighter animation: ${name}`);
  }
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map([...clips].map(([name, clip]) => {
    const a = mixer.clipAction(clip); a.play(); a.paused = true; a.setEffectiveWeight(0);
    return [name, a];
  }));
  const idle = actions.get(ANIMS.idle);
  idle.setEffectiveWeight(1);
  mixer.update(0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverseVisible((o) => { if (o.isMesh) { o.computeBoundingBox?.(); box.union(new THREE.Box3().setFromObject(o)); } });
  const height = box.max.y - box.min.y;
  const scale = 1.95 / height;
  model.scale.multiplyScalar(scale);
  model.position.y = -box.min.y * scale;
  // Align the authored forward-leaning stance behind its engine anchor.
  model.position.z = -0.18;
  model.updateMatrixWorld(true);

  // Measure the extension of the authored limb once, independent of the renderer/frame rate.
  const contactTimes = {};
  const position = new THREE.Vector3();
  // The lowkick clip uses the right foot despite its left-kick input binding.
  const limbs = { lp: 'LeftHand', rp: 'RightHand', lk: 'RightFoot', rk: 'RightFoot', 'forward+rk': 'RightFoot' };
  idle.setEffectiveWeight(0);
  for (const [key, move] of Object.entries(MOVES)) {
    const a = actions.get(move.anim);
    const bone = model.getObjectByName(`mixamorig${limbs[key]}`);
    let furthest = -Infinity;
    let at = a.getClip().duration * 0.4;
    a.setEffectiveWeight(1);
    if (bone) for (let i = 1; i <= 90; i++) {
      a.time = a.getClip().duration * i / 100;
      mixer.update(0); model.updateMatrixWorld(true); bone.getWorldPosition(position);
      if (position.z > furthest) { furthest = position.z; at = a.time; }
    }
    contactTimes[key] = at;
    a.setEffectiveWeight(0);
  }
  idle.time = 0; idle.setEffectiveWeight(1); mixer.update(0);
  root.rotation.y = index === 0 ? Math.PI / 2 : -Math.PI / 2;
  let current = ANIMS.idle;
  let previous = null;
  let blend = 1;
  let lastToken = '';
  let endTime = 0;
  let lastEnd = null;
  let cycle = 0;
  const weights = () => { for (const a of actions.values()) a.setEffectiveWeight(0); };
  return {
    root,
    contactTimes,
    update(state, old, alpha, dt) {
      const f = state[index === 0 ? 'p1' : 'p2'];
      const before = old[index === 0 ? 'p1' : 'p2'];
      root.position.x = THREE.MathUtils.lerp(before.x, f.x, alpha) / 100;
      let name = ANIMS.idle;
      let time = 0;
      let token = 'idle';
      cycle += dt;
      if (state.phase !== 'fight') {
        if (lastEnd !== state.endedAt) { endTime = 0; lastEnd = state.endedAt; }
        endTime += dt;
        name = f.hp === 0 ? ANIMS.ko : state.rounds.at(-1)?.winner === (index === 0 ? 'p1' : 'p2') ? ANIMS.victory : ANIMS.idle;
        time = Math.min(endTime * (name === ANIMS.ko ? 2.8 : 1), clips.get(name).duration - 0.001);
        token = `${name}:${state.endedAt}`;
      } else if (f.move) {
        const move = MOVES[f.move.key];
        name = move.anim;
        time = moveTime(f.move.frame + alpha, move, clips.get(name).duration, contactTimes[f.move.key]);
        token = `${name}:${f.move.started}`;
      } else if (f.stun && f.reaction) {
        name = f.reaction.height === 'high' ? ANIMS.hitHigh : ANIMS.hitMid;
        time = clips.get(name).duration * Math.min(1, (state.frame - 1 - f.reaction.at + alpha) / f.reaction.duration);
        if (f.reaction.blocked) time *= 0.22;
        token = `${name}:${f.reaction.at}`;
      } else {
        name = ANIMS[f.motion] ?? ANIMS.idle;
        time = (cycle * (f.motion === 'idle' ? 1 : 2.5)) % clips.get(name).duration;
        token = name;
      }
      if (token !== lastToken) {
        previous = name !== current ? current : null;
        current = name; blend = 0; lastToken = token;
      }
      blend = Math.min(1, blend + dt * (f.move || f.stun ? 45 : 14));
      weights();
      const a = actions.get(current);
      a.time = Math.min(time, clips.get(current).duration - 0.001);
      a.setEffectiveWeight(previous ? blend : 1);
      if (previous) actions.get(previous).setEffectiveWeight(1 - blend);
      mixer.update(0);
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model); for (const m of materials) m.dispose(); screen.dispose(); },
  };
}
