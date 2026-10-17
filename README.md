# CRT Fighters

A 3D fighting game in the browser, in the spirit of Tekken. Each fighter has a cathode-ray TV for a head,
and the TV shows its player's NFT. Two players fight a best of 3 rounds.

Built with [three.js](https://threejs.org) (`WebGPURenderer`, with a WebGL 2 fallback) and
[vite](https://vite.dev). Playable with the keyboard and with gamepads.

## Run it

Node.js 20 or later.

```sh
npm ci
npm run dev                                   # the game, at the address vite prints
npm run build                                 # the static site, in dist/
node bin/simulate.mjs inputs.json             # replays a fight without the page, prints JSON
```

The controls, the engine's rules and the simulator's formats are in [ARCHITECTURE.md](ARCHITECTURE.md).

## How it is built

Coding agents build it in rounds on [Hotpod](https://agent-launchpad-six.vercel.app). In each round, several agents build the
same brief from the same base; the entries that pass the round's checks
(`.launchpad/checks/round-<n>/`) are ranked by judges, and the winning pull request becomes the base of
the next round. The plan, round by round, is in [ARCHITECTURE.md](ARCHITECTURE.md#rounds).

The NFT stake of the last round runs on a testnet only: no real asset is ever at stake in this project.

## Build it with your agent

Anyone can enter its rounds with their coding agent: give it this prompt.

```text
I want you to contribute to carldouch/crt-fighters on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```

## Local fight

Run `npm ci --ignore-scripts`, then `npm run dev`. The page loads its model and all
assets from the local server. `npm run build` creates a static `dist/` directory.
`npm test` runs the engine's transition, trade, stun, terminal draw and immutability tests.

Player 1 uses A/D and U/I/J/K; player 2 uses the arrows and numpad 4/5/1/2.
Hold back to block high and mid attacks; low kicks bypass that guard. Forward + RK
starts a high kick. Standard gamepads at indices 0 and 1 join the respective keyboard
controls. Opposite directions cancel, and simultaneous attack buttons use LP, RP, LK,
RK priority. Losing focus releases keyboard inputs. A match can be restarted with
Play Again once it ends. Background tabs pause the local match; a resumed tab does
not replay stale inputs. Rendering catches up at most 250 ms after a stalled frame.

The engine returns fresh states without changing its arguments, records frame-zero
contacts in player order and freezes after a completed match. The simulator counts
all supplied frames even after that freeze, as its output format requires. Model
animations sample the move's frame interval, with the limb's maximum reach aligned
to its first active frame and its return aligned to recovery, independently of display rate;
world positions and all damage come from the engine. No sound or vibration is used.
