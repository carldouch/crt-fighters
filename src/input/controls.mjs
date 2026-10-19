const keys = [ { forward: 'KeyD', back: 'KeyA', lp: 'KeyU', rp: 'KeyI', lk: 'KeyJ', rk: 'KeyK' }, { forward: 'ArrowLeft', back: 'ArrowRight', lp: 'Numpad4', rp: 'Numpad5', lk: 'Numpad1', rk: 'Numpad2' } ];
export function readPlayer(index, held, pad) {
  const input = Object.fromEntries(Object.entries(keys[index]).map(([name, code]) => [name, held.has(code)]));
  if (pad?.connected) {
    const down = (n) => Boolean(pad.buttons[n]?.pressed);
    const left = (pad.axes[0] ?? 0) < -0.5 || down(14);
    const right = (pad.axes[0] ?? 0) > 0.5 || down(15);
    input.forward ||= index === 0 ? right : left;
    input.back ||= index === 0 ? left : right;
    for (const [name, button] of [['lp', 2], ['rp', 3], ['lk', 0], ['rk', 1]]) input[name] ||= down(button);
  }
  if (input.forward && input.back) { input.forward = false; input.back = false; }
  return input;
}
export function attachControls(target = window) {
  const held = new Set();
  const codes = new Set(keys.flatMap((map) => Object.values(map)));
  target.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
    if (codes.has(event.code)) { event.preventDefault(); held.add(event.code); }
  });
  target.addEventListener('keyup', (event) => held.delete(event.code));
  target.addEventListener('blur', () => held.clear());
  document.addEventListener('visibilitychange', () => held.clear());
  return { clear: () => held.clear(), sample() {
    const pads = navigator.getGamepads?.() ?? [];
    return { p1: readPlayer(0, held, pads[0]), p2: readPlayer(1, held, pads[1]) };
  } };
}
