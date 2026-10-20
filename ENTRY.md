# Local two-player fight

## Run

Use Node 24 or later. `npm ci --ignore-scripts`, `npm run dev`; for the production site use `npm run build` and `npm run preview`. Everything is served locally, including the supplied GLB. No wallet, account, API, CDN, or network service is required.

`node --test test/*.test.mjs` exercises immutable transitions, every move's exact startup and range, simultaneous lethal trades, pause boundaries, fixed-seed stress inputs, gamepad mapping, and real CLI failures. `node .launchpad/checks/round-1/run.mjs` runs the supplied checks with a locally installed Playwright browser; qualification uses the pinned container gate.

After `npm run build`, `node test/browser-controls.mjs` runs a real Chromium regression: movement must keep working while New match, resumed Pause and Sound hold focus, while typing in an editable field must not move either fighter. It serves only `dist/` on an ephemeral loopback port. Use the pinned Playwright image when Chromium is not installed locally.

## Play

Player 1: A/D walk; U/I punch; J/K kick. Player 2: left/right arrows; numpad 4/5 punch; numpad 1/2 kick. Holding back blocks high and mid attacks; low kicks break the guard. Forward + right kick gives the high kick. Held attacks repeat when recovery ends. Standard gamepads 0 and 1 map to players 1 and 2, including hot connection and disconnection. Opposing horizontal controls cancel. Attack priority is LP, RP, LK, RK when multiple buttons are held.

Pause/Resume or Escape controls the local page clock. New match resets the match. Blur and visibility changes release keys. Sound is off by default; enable it for locally synthesized hit and block cues. Reduced-motion preferences disable camera shake. Health and wins remain readable without relying on color.

## Structure and configuration

`src/engine/fight.mjs` is DOM-free. The state is immutable, including history; one call performs precisely one frame. Terminal match states return unchanged. The simulator separately counts all input frames, including those after match completion, as required by ARCHITECTURE.md. Contact collection precedes damage application so trades remain simultaneous.

`src/input/controls.mjs` merges keyboard and standard gamepad input. `src/scene/arena.js` owns model loading, skeleton cloning, materials, lights, clip sampling and framing. Every move clip is sampled by the engine's move frame and finishes within the move's duration. Rendering never decides whether a hit connects. The model's hitbox meshes remain hidden.

The gameplay constants in `src/engine/rules.mjs` are the fixed protocol and remain unchanged. Configure visual palette and interface dimensions with the CSS variables in `src/style.css`; scene lights, camera, model height and device pixel cap are presentation settings in the scene/page modules. Audio is optional and contains no media files. Vite's required shared-three.js alias and native configuration loader remain intact.

## Verification limits

Software WebGL2 and simulated Gamepad API checks establish offline fallback and input mapping. A physical controller and a hardware WebGPU adapter require separate hardware verification. No win or submission is implied by local checks.
