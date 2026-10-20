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
npm test                                      # the engine, the input files, the controls and the poses
node .launchpad/checks/round-1/run.mjs        # the round's checks (the page's need playwright-core's Chromium)
```

The controls, the engine's rules and the simulator's formats are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Play

| | Player 1 | Player 2 | Gamepad |
| --- | --- | --- | --- |
| walk | `A` `D` | `←` `→` | stick or d-pad |
| left punch, right punch | `U` `I` | numpad `4` `5` | X, Y (Square, Triangle) |
| low kick, middle kick | `J` `K` | numpad `1` `2` | A, B (Cross, Circle) |
| high kick | `D` + `K` | `←` + numpad `2` | towards the opponent + B |
| block (high and mid) | hold `A` | hold `→` | away from the opponent |

Gamepad 1 plays player 1 and gamepad 2 player 2, alongside the keyboard; gamepads rumble on hits. An
attack pressed while the fighter is still busy (recovering, stunned) is kept for it for 8 frames, so a
tap is never lost. `M` mutes the sound (it starts with the first key pressed, as browsers require). Once
a match is over, `Enter`, `Space` or a gamepad's Start starts the next one. The renderer in use and the
frame rate are under the clock.

## The code

```
src/engine/rules.mjs     the fixed numbers and moves (given)
src/engine/fight.mjs     the engine: createFight() and step(state, inputs), the six steps of a frame in order
src/engine/replay.mjs    input files: checked whole, then replayed (bin/simulate.mjs does the reading and printing)
src/input/               the keyboard and the gamepads, turned into the engine's buttons (index.js: the buffer)
src/scene/pose.js        what each model shows, read from the engine's state alone
src/scene/clips.js       where each clip's strike, reaction and walk sit, against the engine's frames
src/scene/               the fighters (fighter.js), the arena and camera (stage.js), the hit bursts (effects.js)
src/ui/                  the hp bars, round wins, clock and banners (hud.js); the sounds, synthesized (sound.js)
src/main.js              the loop: 60 engine steps a second, inputs read each step, then one render
src/dev.js               npm run dev only: __dev.measureClips(), __dev.play(frames)
test/                    npm test: node's test runner, no browser
```

The page never decides anything: hits, blocks, knockouts and positions all come from `step()`. What it
adds is only seen and heard: the bursts, the struck fighter's flash and jolt (its model, not its
position), the guard of light in front of a blocking fighter, the camera closing in on a knockout, the
curtain that hides the fighters' return to their marks between rounds, and, with WebGPU, a bloom on the
neon, the screens and the bursts. The WebGL 2 fallback draws the same scene without the bloom.

**In sync with the engine.** A move's clip is not played at its own speed: its time is computed from the
move's frame (`moveClipTime` in `src/scene/clips.js`). The wind-up fills the startup frames, the limb
reaches the move's range on the first active frame (the frame the engine can register the hit), the
follow-through fills the active frames and the return to guard fills the recovery. Reactions play over
the stun's frames the same way. The numbers come from measuring the model's limbs in each clip
(`__dev.measureClips()` in `npm run dev`), at the fighters' height on the stage (1.45 m, so that the
punches' and kicks' reach matches the engine's ranges).

**Where ARCHITECTURE.md is silent**, this entry chose:

- holding `forward` and `back` together (keyboard and gamepad at once) holds neither: no walk, no block;
- several attack buttons at once on the page: `lp`, then `rp`, `lk`, `rk` (an input file can hold one);
- a blocked attack's event has `"type": "block"`, a hit's `"type": "hit"`;
- a fighter in blockstun or hitstun is not free, so it neither walks nor blocks until its stun is over;
- the engine's `frame` keeps counting after the match is over (nothing else changes), so `frame` is the
  number of frames read, as the simulator prints it;
- the simulator prints its JSON on one line; it refuses a button written twice (`lp+lp`), an empty one
  (`lp+`) and a `p1` or `p2` that is not a string, with the frame and the reason;
- the page renders at the display's rate and interpolates the positions between two engine frames; after
  a stall it catches up at most 250 ms of engine frames, then slows down rather than jump;
- there is no blocking clip in the model: a blocked blow plays the first part of the head's reaction,
  smaller, with the guard lit.

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
