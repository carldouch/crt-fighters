import { ATTACK_BUTTONS } from '../engine/rules.mjs';

export const KEYMAP = {
  KeyS: ['p1', 'block'], ArrowDown: ['p2', 'block'],
  KeyO: ['p2', 'lp'], KeyP: ['p2', 'rp'], KeyL: ['p2', 'lk'], Semicolon: ['p2', 'rk'],
  KeyD: ['p1', 'forward'], KeyA: ['p1', 'back'], KeyU: ['p1', 'lp'], KeyI: ['p1', 'rp'], KeyJ: ['p1', 'lk'], KeyK: ['p1', 'rk'],
  ArrowLeft: ['p2', 'forward'], ArrowRight: ['p2', 'back'], Numpad4: ['p2', 'lp'], Numpad5: ['p2', 'rp'], Numpad1: ['p2', 'lk'], Numpad2: ['p2', 'rk'],
};

/** Resolve conflicting devices to one legal input. Directions cancel; attack priority is lp,rp,lk,rk. */
export function mergeInput(...sources) {
  const result = {};
  for (const s of sources) for (const [k, v] of Object.entries(s ?? {})) if (v) result[k] = true;
  // Dedicated guard aliases the official back action, with priority over attacks.
  if (result.block) return { forward: false, back: true, lp: false, rp: false, lk: false, rk: false };
  if (result.forward && result.back) result.forward = result.back = false;
  const attack = ATTACK_BUTTONS.find((k) => result[k]);
  for (const k of ATTACK_BUTTONS) result[k] = k === attack;
  return result;
}

export function padInput(pad, index) {
  if (!pad || pad.connected === false) return {};
  const pressed = (i) => !!pad.buttons?.[i]?.pressed;
  const x = pad.axes?.[0] ?? 0;
  const left = x < -0.5 || pressed(14);
  const right = x > 0.5 || pressed(15);
  return { forward: index === 0 ? right : left, back: index === 0 ? left : right, lp: pressed(2), rp: pressed(3), lk: pressed(0), rk: pressed(1), block: pressed(4) };
}

export function createControls(target = window) {
  const held = new Set();
  const taps = new Set();
  let pads = [];
  let active = true;
  const down = (event) => {
    if (!KEYMAP[event.code] || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)) return;
    event.preventDefault();
    if (!held.has(event.code)) taps.add(event.code);
    held.add(event.code);
  };
  const up = (event) => { if (KEYMAP[event.code]) { event.preventDefault(); held.delete(event.code); } };
  const clear = () => { held.clear(); taps.clear(); pads = []; };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', clear);
  return {
    clear,
    setActive(value) { active = value; clear(); },
    poll() { try { pads = Array.from(navigator.getGamepads?.() ?? []); } catch { pads = []; } },
    connected: () => [!!pads[0]?.connected, !!pads[1]?.connected],
    sample() {
      if (!active) return { p1: {}, p2: {} };
      const keyboard = { p1: {}, p2: {} };
      for (const code of new Set([...held, ...taps])) { const [p, key] = KEYMAP[code]; keyboard[p][key] = true; }
      taps.clear();
      return { p1: mergeInput(keyboard.p1, padInput(pads[0], 0)), p2: mergeInput(keyboard.p2, padInput(pads[1], 1)) };
    },
    dispose() { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', clear); clear(); },
  };
}
