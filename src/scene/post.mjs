// The glow of the neon and the hit sparks: a bloom over the brightest pixels, on the WebGPU backend. The
// WebGL 2 fallback often runs on a weak or software GPU: it renders the scene directly, without it.
import * as THREE from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const STRENGTH = 0.7;
const RADIUS = 0.35;
const THRESHOLD = 0.75;

/** A render function for `scene` seen by `camera`. */
export function createRender(renderer, scene, camera) {
  if (!renderer.backend.isWebGPUBackend) return () => renderer.render(scene, camera);
  const pipeline = new THREE.RenderPipeline(renderer);
  const color = pass(scene, camera).getTextureNode("output");
  pipeline.outputNode = color.add(bloom(color, STRENGTH, RADIUS, THRESHOLD));
  return () => pipeline.render();
}
