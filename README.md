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
npm test                                      # the engine's rules, the simulator, the poses and the controls
```

The controls, the engine's rules and the simulator's formats are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Play

| | Player 1 | Player 2 | Gamepad (1 for player 1, 2 for player 2) |
| --- | --- | --- | --- |
| walk forward / back | `D` / `A` | `←` / `→` | stick or d-pad |
| left punch, right punch | `U`, `I` | numpad `4`, `5` | X / Square, Y / Triangle |
| low kick, middle kick | `J`, `K` | numpad `1`, `2` | A / Cross, B / Circle |
| high kick | forward + `K` | forward + numpad `2` | forward + B / Circle |

Hold back to block high and mid attacks; low kicks go under the block. After a match, any attack button
starts a rematch. `F2` shows each fighter's frame data (the move, its frame, its phase, the stun left);
`P` pauses, and while paused `.` steps one engine frame.

## The code

- `src/engine/`: the fight, pure and deterministic. `fight.mjs` steps one frame in the order of
  ARCHITECTURE.md; `replay.mjs` parses and replays a simulation file; `rules.mjs` is the given numbers.
- `src/input/`: the keyboard and the gamepads, read once per engine frame into the engine's inputs.
- `src/scene/`: the arena, the camera, the fighters, the hit flashes. `poses.mjs` turns the engine's
  state into a clip and a time in it; the clips' times come from the engine's frame counts.
- `src/hud/`: the hp bars, the round wins, the clock and the calls. `src/audio/`: sounds made with
  WebAudio.
- `src/main.js`: runs the engine at a fixed 60 steps per second and draws between steps.

## Choices where the brief is silent

- **Strike clips are retimed to the move's frames.** The clips are longer than the moves (the left punch
  clip is 1.07 s, the move 19 frames). `src/scene/poses.mjs` lists, per clip, three times read from the
  skeleton: the limb leaves the guard, is furthest out, is back on guard. The first span plays over the
  move's startup frames, the second over its active and recovery frames.
- **Strikes step in or back.** During a strike the model is offset along the stage so that, at full reach,
  the limb ends at the opponent's chest when the distance is within the move's range, and short of it
  otherwise. The offset is drawn only; the engine's position is unchanged.
- **Reactions.** A high move plays `headhit`, a mid or low one `middlehit`; the clip reaches its peak in 4
  frames and returns over the rest of the stun. A blocked move plays a short part of the same clip.
  A hit flashes the defender and pushes the model back for 10 frames.
- **Input buffer.** An attack pressed while the fighter cannot act is fed to the engine for 6 frames
  (`BUFFER_FRAMES` in `src/input/controls.mjs`). A held button repeats the move, as the engine's rules say.
  Keys and gamepad buttons pressed and released between two engine frames count on the next one. The
  attack that starts a rematch is ignored until it is released.
- **Keyboard and gamepad together** count for the same player; forward and back held together are neither.
  Gamepad 1 is player 1 and gamepad 2 is player 2, as ARCHITECTURE.md says.
- **Events.** A blocked move's event has `damage: 0`. The simulator prints one round or event per line, as
  in ARCHITECTURE.md's example.
- **The simulator** also refuses buttons that are not a string, an empty button (`"lp++rk"`) and a
  `repeat` of `null`.
- **The page loop.** The screen shows the engine's latest frame as it is, with no interpolation between
  frames, so the pose on screen is always the pose of the frame the engine is on. After a stall (a
  background tab) the engine catches up at most 250 ms. Below 45 frames per second for two seconds, the page
  renders at one pixel per CSS pixel.
- **No hit freeze.** The rules have none and the engine runs at a fixed 60 steps per second, so a hit is
  shown by the reaction clip, a flash, a spark, a recoil of the model and a camera shake, all drawn only.

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
