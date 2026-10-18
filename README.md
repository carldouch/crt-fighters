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
npm test                                      # the unit tests (node:test, no browser)
```

The controls, the engine's rules and the simulator's formats are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Play

| | Player 1 | Player 2 | Gamepad (0 is player 1, 1 is player 2) |
| --- | --- | --- | --- |
| walk | `A` `D` | `←` `→` | stick or d-pad |
| block | hold `A` (back) | hold `→` (back) | hold away from the other fighter |
| left / right punch | `U` `I` | numpad `4` `5`, or `;` `'` | X / Square, Y / Triangle |
| low / middle kick | `J` `K` | numpad `1` `2`, or `.` `/` | A / Cross, B / Circle |
| high kick | `D` + `K` | `←` + numpad `2` | towards + B / Circle |

Holding back blocks punches and the middle and high kicks; the low kick goes through. The match is a best
of 3; once it is over, `Enter` or a gamepad's Start begins a rematch. The corner of the screen shows the
backend in use (WebGPU, or WebGL 2) and the frame rate; `?webgl2` in the address forces WebGL 2.

## How round 1 is built

```
src/engine/fight.mjs     the engine: pure functions of plain data, the frame order of ARCHITECTURE.md
src/engine/replay.mjs    the simulator's input files: checked, replayed, printed (bin/simulate.mjs is the CLI)
src/game.mjs             the page's match: the engine at a fixed 60 steps per second, window.__crt
src/input/               keyboard and gamepads → the engine's buttons
src/scene/               the arena, the fighters and their animations, effects, camera, HUD
```

The page never decides anything: each frame it reads the engine's state and shows it. A fighter's clip and
its time come from the engine's frame counters (`src/scene/fighter.mjs`, `src/scene/timing.mjs`):

- **Strikes land on the frame the engine hits.** When the model loads, `src/scene/model.mjs` finds each
  attack clip's impact, the moment the striking hand or foot is furthest out. A move's first active frame
  shows that pose; the wind-up plays before it and the recovery after, never more than 3 times faster
  than the clip.
- **The model's size and reach follow the engine's numbers.** The model is scaled so that a left punch at
  its full range (100) just reaches the other fighter's body, and each kick keeps as much of its clip's
  step forward as it needs to reach its own range. At the closest distance (60) the two bodies touch.
- **The hips stay over the engine's position.** The clips' travel is removed (the engine moves the
  fighters), except what a kick needs and a knocked-out fighter's fall.
- **Walks keep the feet planted.** The step clips play at the speed at which the foot on the ground keeps
  up with the engine's walking speed (at most 5 times the clip's).
- **Hits and blocks are easy to read:** a spark where the strike lands (warm for a hit, cyan for a block),
  a short camera shake, the hit fighter's screens flashing, its hp bar shaking, a sound (synthesised with
  Web Audio: nothing is loaded; `M` mutes it) and its gamepad rumbling. A hit plays the head or
  body reaction over the hitstun; a block holds a crouched guard over the blockstun. A knockout falls
  within the 90-frame pause, the winner celebrates, and the screen fades between rounds.
- **A hit throws the body away from the side it lands on.** A left punch lands on the other fighter's
  right side and turns it to its left; the right punch and the kicks (thrown with the right foot) turn
  it to its right. The model has one reaction clip per height, which turns one way: for the other side,
  `src/scene/mirror.mjs` reflects the motion of its torso, neck and head through the model's plane of
  symmetry, leaving the hips, legs and arms as they are, so the stance and the feet do not change.
- **Nobody sinks into the floor.** The knockout clip was made for a slimmer body: lying down, the TV
  would go 16 cm under the floor. Each frame the fighter is lifted, if needed, until the TV's (hidden)
  hitbox rests on the floor.

Where the specification leaves a choice, this is what the entry does:

- An event's `type` is `"hit"` or `"block"`, and `damage` is the move's damage (0 for a block).
- The engine treats `forward` and `back` held together as neither, and several attack buttons as the first
  of `lp`, `rp`, `lk`, `rk` (the simulator refuses both). The page sends the newer direction and the
  newest attack press instead.
- A press is kept for 8 engine frames: a tap made while the fighter is busy, or between two engine frames,
  still starts its move as soon as the fighter is free. A held button keeps acting, as the rules say.
- The frame counter keeps counting after the match ends; nothing else changes.
- The simulator refuses a button listed twice and warns, on stderr, about keys it does not know.
- The engine catches up after a slow frame (up to half a second of play), and skips a longer gap, such as
  a tab left in the background, rather than playing it all at once.

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
