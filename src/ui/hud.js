import { FPS, ROUND_FRAMES, MOVES } from '../engine/rules.mjs';
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const players = [1, 2].map((i) => ({ hp: $(`hp${i}`), device: $(`device${i}`), wins: $(`wins${i}`).children, move: $(`move${i}`), bar: document.querySelector(`.p${i} .health`), hit: $(`hit${i}`), until: 0 }));
  let lastAnnouncement = '';
  return {
    announce(title, sub = '', rematch = false) {
      const key = `${title}:${sub}:${rematch}`;
      if (key === lastAnnouncement) return;
      lastAnnouncement = key;
      $('announcement-title').textContent = title;
      $('announcement-sub').textContent = sub;
      $('announcement').classList.toggle('hidden', !title);
      $('rematch').hidden = !rematch;
    },
    hit(event, now) {
      const p = players[event.attacker === 'p1' ? 0 : 1];
      p.hit.textContent = event.blocked ? 'GUARD' : `${event.move === 'lk' ? 'LOW' : 'HIT'} −${event.damage}`;
      p.until = now + 450;
    },
    update(state, connected, now) {
      const round = state.rounds.length + (state.phase === 'fight' ? 1 : 0);
      $('round').textContent = `ROUND ${String(round).padStart(2, '0')}`;
      $('timer').textContent = String(Math.max(0, Math.ceil((ROUND_FRAMES - state.roundFrame) / FPS))).padStart(2, '0');
      document.querySelector('.clock').classList.toggle('urgent', state.roundFrame >= 3000);
      players.forEach((p, i) => {
        const id = i === 0 ? 'p1' : 'p2'; const f = state[id];
        p.hp.textContent = f.hp;
        p.bar.setAttribute('aria-valuenow', f.hp);
        for (const bar of p.bar.children) bar.style.transform = `scaleX(${f.hp / 100})`;
        [...p.wins].forEach((w, n) => w.classList.toggle('won', state.roundWins[id] > n));
        p.device.textContent = connected[i] ? `GAMEPAD ${i + 1}` : 'KEYBOARD';
        p.move.textContent = f.hp === 0 ? 'SIGNAL LOST' : f.move ? MOVES[f.move.key].name.toUpperCase() : f.stun ? f.reaction?.blocked ? 'GUARD' : 'HIT' : f.blocking ? 'GUARD' : f.motion === 'forward' ? 'ADVANCING' : 'READY';
        p.hit.classList.toggle('visible', now < p.until);
      });
    },
  };
}
