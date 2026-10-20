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

## Local versus

The match starts as soon as the model loads. Amber is player 1; Cyan is player 2.
Hold an attack to repeat it whenever the fighter recovers. Use **Controls** for
both keyboard layouts and standard gamepad bindings. Gamepads occupy their fixed
API slots (0 and 1), and can be used alongside either keyboard layout. Opposing
directions cancel; simultaneous attacks use the priority `lp`, `rp`, `lk`, `rk`.
A brief keyboard tap is retained until the next simulation tick.

Escape opens the controls and pauses the match. Changing tabs clears held keys
and discards elapsed background time. The simulation uses a 60 Hz accumulator;
rendered positions interpolate between its states. A stalled display can catch
up at most 250 ms per rendered frame. Sound is optional, synthesized locally,
and enabled only by clicking **Sound**. After a match, press Enter or **Rematch**.

## Implementation

- `src/engine/fight.mjs` is a pure state transition with integer positions and
  frame counters. Both hit candidates are captured before damage is applied.
  Completed matches return their existing state unchanged. JSON serialization
  contains all state needed to resume simulation; there is no hidden clock.
- `src/engine/replay.mjs` validates a complete recording before playing it. The
  CLI prints only the documented result, including the number of supplied
  frames even when the engine has already finished. Duplicate button tokens
  are rejected as malformed input.
- `src/input/controls.mjs` owns keyboard state and Gamepad API translation.
  Blur clears held keys; a disconnected controller immediately releases input.
- `src/scene/` reads the engine. Each fighter has an independent cloned skeleton
  and mixer. Horizontal root motion is removed from the supplied clips. Each
  move's contact pose is measured from its striking limb at load time and
  aligned to the first active simulation frame; the remainder of the clip fits
  its recovery. The supplied low-kick clip strikes with the right foot.
  Clip blending, sparks, camera movement and sound never change combat results.
- `src/ui/` presents health, round wins, results and optional audio. The display
  textures are local player identifiers; NFT loading belongs to a later round.

No asset, font or service is requested from an external host. The original
`rules.mjs`, model, checks, dependency versions and three.js alias are unchanged.

## Additional tests

Use Node 24 (the pinned runner uses Node 24), or a Node version supported by the
pinned Vite release, for the build. The engine and simulator also run on Node 20.

```sh
node --test test/*.test.mjs
npm run build
node test/browser.mjs
```

The browser review needs the Chromium version corresponding to the pinned
`playwright-core`. It starts a loopback Vite preview with the native config
loader, runs two rounds, checks rematch, keyboard/gamepad input, focus and pause
handling, and captures wide, landscape and narrow views. It refuses page errors
or requests outside its own server. Artifacts go to `/tmp/crt-fighters-review`,
or to `CRT_ARTIFACTS` when set. The official gate supplies its own pinned browser
and runs the separate immutable checks under `.launchpad/checks/`.
