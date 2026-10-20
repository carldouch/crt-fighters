// A hit reaction thrown to the other side. The torso, neck and head (the TV) move as in the clip, reflected
// through the model's plane of symmetry (x = 0, the model facing +z): a head snapped back and to the right
// snaps back and to the left. Only their motion is reflected, not their pose: for each bone of the chain,
// its rotation since the clip's first frame, in model space, is reflected and applied to that first frame.
// The fighting stance is not symmetric (left foot and fist forward), so reflecting the pose itself would swap
// the feet; this way the start and end poses stay the clip's own, and the hips, legs and arms are untouched.
import * as THREE from "three/webgpu";

const KEYS_PER_SECOND = 30; // as the model's own clips

// A rotation reflected through the plane x = 0 (S·R·S with S = diag(-1, 1, 1)): turns about the vertical and
// the forward axes reverse, a turn about the side axis (bending back or forward) stays.
const reflect = (q) => q.set(q.x, -q.y, -q.z, q.w);

/**
 * The clip with the motion of `chain` (bones from the hips' child to the head, each the parent of the next)
 * reflected, named `<clip>.mirrored`. `root` is the model in its rest pose, at the origin.
 */
export function mirrorClip(root, clip, chain) {
  for (let i = 1; i < chain.length; i++) if (chain[i].parent !== chain[i - 1]) throw new Error(`${chain[i].name} is not a child of ${chain[i - 1].name}`);
  const rest = [];
  root.traverse((o) => o.isBone && rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  const at = (time) => {
    action.time = time;
    mixer.update(0);
    root.updateMatrixWorld(true);
  };
  const world = (o) => o.getWorldQuaternion(new THREE.Quaternion());

  at(0);
  const start = chain.map(world);
  const startInverse = start.map((q) => q.clone().invert());
  const count = Math.round(clip.duration * KEYS_PER_SECOND) + 1;
  const times = Array.from({ length: count }, (_, i) => Math.min(clip.duration, i / KEYS_PER_SECOND));
  const keys = chain.map(() => []);
  for (const time of times) {
    at(time);
    let parent = world(chain[0].parent); // the hips, as the clip moves them
    chain.forEach((b, i) => {
      const motion = reflect(world(b).multiply(startInverse[i])); // since the first frame, reflected
      const target = motion.multiply(start[i]);
      const local = parent.clone().invert().multiply(target);
      parent = target;
      const k = keys[i];
      const n = k.length;
      // Keep each key on the side of the one before, so that the bone turns the short way between them.
      if (n && k[n - 4] * local.x + k[n - 3] * local.y + k[n - 2] * local.z + k[n - 1] * local.w < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      k.push(local.x, local.y, local.z, local.w);
    });
  }
  mixer.uncacheRoot(root);
  for (const [b, pos, quat, scl] of rest) b.position.copy(pos), b.quaternion.copy(quat), b.scale.copy(scl);
  root.updateMatrixWorld(true);

  const replaced = new Set(chain.map((b) => `${b.name}.quaternion`));
  const tracks = clip.tracks.filter((t) => !replaced.has(t.name)).map((t) => t.clone());
  chain.forEach((b, i) => tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, keys[i])));
  return new THREE.AnimationClip(`${clip.name}.mirrored`, clip.duration, tracks);
}
