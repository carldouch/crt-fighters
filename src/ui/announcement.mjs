/** Round and match results are separate: a drawn round can still decide the match. */
export function resultAnnouncement(state) {
  const result = state.rounds.at(-1);
  const matchOver = state.phase === 'over';
  const winner = matchOver ? state.winner : result.winner;
  const name = winner === 'p1' ? 'AMBER' : 'CYAN';
  return {
    title: matchOver ? winner ? `${name} WINS` : 'DRAW' : result.reason === 'ko' ? 'K.O.' : 'TIME',
    subtitle: matchOver ? 'MATCH COMPLETE · FIRST TO TWO' : winner ? `${name} TAKES THE ROUND` : 'ROUND DRAW · BOTH SCORE',
    rematch: matchOver,
  };
}
