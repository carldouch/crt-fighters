import { ROUND_FRAMES, FPS } from '../engine/rules.mjs';

export function createHUD() {
  const ids = Object.fromEntries([...document.querySelectorAll('[id]')].map((el) => [el.id, el]));
  let lastRound = -1, lastDone = false;
  return {
    error(message) { ids.status.textContent = message; },
    update(state, backend, pads) {
      for (const id of ['p1', 'p2']) {
        ids[`${id}-hp`].style.transform = `scaleX(${state[id].hp / 100})`;
        ids[`${id}-value`].textContent = state[id].hp;
        ids[`${id}-wins`].textContent = '●'.repeat(state.roundWins[id]) + '○'.repeat(Math.max(0, 2 - state.roundWins[id]));
        ids[`${id}-input`].textContent = pads[id === 'p1' ? 0 : 1] ? 'GAMEPAD + KEYBOARD' : 'KEYBOARD';
      }
      ids.timer.textContent = String(Math.ceil((ROUND_FRAMES - state.roundFrame) / FPS)).padStart(2, '0');
      ids.round.textContent = `ROUND ${Math.min(state.rounds.length + (state.roundEnded ? 0 : 1), 3)} / BEST OF 3`;
      ids.backend.textContent = backend.toUpperCase();
      const result = state.rounds.at(-1);
      const overlay = state.roundEnded;
      ids.result.classList.toggle('visible', overlay);
      if (state.rounds.length !== lastRound || state.done !== lastDone) {
        lastRound = state.rounds.length;
        lastDone = state.done;
        ids['result-label'].textContent = state.done ? 'MATCH COMPLETE' : result?.reason === 'ko' ? 'KNOCKOUT' : 'TIME UP';
        const winner = state.done ? state.winner : result?.winner;
        ids['result-title'].textContent = winner ? `PLAYER ${winner === 'p1' ? '01' : '02'} WINS` : 'DOUBLE DRAW';
        ids['result-note'].textContent = state.done ? 'Play again for a rematch' : 'Next round loading';
        ids.rematch.hidden = !state.done;
      }
      ids.status.textContent = overlay ? 'SIGNAL HOLD' : state.roundFrame < 90 ? 'FIGHT' : 'LIVE';
    },
  };
}
