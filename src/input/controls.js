const maps = [
  { forward: 'KeyD', back: 'KeyA', lp: 'KeyU', rp: 'KeyI', lk: 'KeyJ', rk: 'KeyK' },
  { forward: 'ArrowLeft', back: 'ArrowRight', lp: 'Numpad4', rp: 'Numpad5', lk: 'Numpad1', rk: 'Numpad2' },
];
const attackKeys = ['lp', 'rp', 'lk', 'rk'];

export function createControls() {
  const held = new Set(), codes = new Set(maps.flatMap((map) => Object.values(map)));
  const onKey = (event) => {
    if (!codes.has(event.code)) return;
    event.preventDefault();
    if (event.type === 'keydown') held.add(event.code);
    else held.delete(event.code);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) held.clear(); });
  return {
    poll() {
      const pads = navigator.getGamepads?.() ?? [];
      const inputs = {};
      maps.forEach((map, index) => {
        const pad = pads[index];
        const pressed = (n) => !!pad?.buttons?.[n]?.pressed;
        const left = (pad?.axes?.[0] ?? 0) < -0.5 || pressed(14);
        const right = (pad?.axes?.[0] ?? 0) > 0.5 || pressed(15);
        const buttons = Object.fromEntries(Object.entries(map).map(([action, code]) => [action, held.has(code)]));
        buttons.forward ||= index === 0 ? right : left;
        buttons.back ||= index === 0 ? left : right;
        [2, 3, 0, 1].forEach((n, i) => { buttons[attackKeys[i]] ||= pressed(n); });
        if (buttons.forward && buttons.back) buttons.forward = buttons.back = false;
        const attack = attackKeys.find((key) => buttons[key]);
        attackKeys.forEach((key) => { buttons[key] = key === attack; });
        inputs[index === 0 ? 'p1' : 'p2'] = buttons;
      });
      return { inputs, pads: [!!pads[0], !!pads[1]] };
    },
  };
}
