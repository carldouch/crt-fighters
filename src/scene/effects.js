// What a hit or a block looks like on the stage: a burst where it lands, white-hot for a hit, cyan for a
// block, sized by the damage.
import * as THREE from "three/webgpu";
import { MOVES } from "../engine/rules.mjs";

/** The height, in metres, where each height of move lands on the fighters (1.45 m tall). */
const LANDS_AT = { high: 1.05, mid: 0.8, low: 0.35 };
const LIFE = 0.28;

export function createEffects(scene) {
  const texture = burstTexture();
  const pool = [];
  return {
    /**
     * A burst for engine event `event` ({ attacker, move, damage, blocked }), on the defender at
     * `x` metres, the attacker coming from `side` (+1 from the left, -1 from the right).
     */
    burst(event, x, side) {
      const move = MOVES[event.move];
      let fx = pool.find((p) => p.life <= 0);
      if (!fx) {
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        fx = { mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material), life: 0, size: 1 };
        scene.add(fx.mesh);
        pool.push(fx);
      }
      fx.life = LIFE;
      fx.size = event.blocked ? 0.75 : 0.45 + move.damage * 0.05;
      fx.mesh.material.color.set(event.blocked ? 0x5fe6ff : 0xffd38a);
      fx.mesh.position.set(x - side * 0.22, LANDS_AT[move.height], 0.35);
      fx.mesh.rotation.z = Math.random() * Math.PI;
      fx.mesh.visible = true;
    },
    update(dt) {
      for (const fx of pool) {
        if (fx.life <= 0) continue;
        fx.life -= dt;
        const t = 1 - Math.max(0, fx.life) / LIFE;
        fx.mesh.scale.setScalar(fx.size * (0.6 + t * 0.9));
        fx.mesh.material.opacity = 1 - t * t;
        fx.mesh.visible = fx.life > 0;
      }
    },
  };
}

/** A star-shaped burst, drawn once on a canvas. */
function burstTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const c = size / 2;
  const glow = g.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.25, "rgba(255,255,255,0.6)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? c * 0.95 : c * 0.28;
    const a = (i / 16) * Math.PI * 2;
    g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
