# Enhanced local build

The `chaoschef-enhanced` branch extends competition commit `6a9d50a`. The original checkout, gate transcript, simulator interface, engine rules, official checks, assets and animation timing remain unchanged. Nothing is submitted by building or previewing this branch.

## Compatibility and controls

Local PvP remains the immediate default. Mode and difficulty selectors restart the match; RESTART is available during play. Rematch retains the selected mode, difficulty and seed. In VS CPU, Cyan belongs to the computer and P2 keyboard/gamepad inputs are ignored.

P1: A/D movement, U/I punches, J/K kicks, S block. P2: arrows movement, O/P punches, L/semicolon kicks, ArrowDown block. All original NumPad bindings remain. Both gamepads retain the original face buttons, stick and D-pad; LB/L1 (standard button 4) is dedicated block.

Dedicated BLOCK is an input alias for the frozen back/guard action, including back-walking at 2 cm/frame. It suppresses simultaneous attack and forward inputs across devices. Existing back+attack behavior remains unchanged. High/mid attacks deal zero damage when guarded; low kicks deal full damage. No stamina cost or new cooldown is added. Official blockstun still applies, and guard cannot cancel an active attack or bypass hitstun/recovery. The illuminated BLOCKING badge covers active guard and blocked-hit stun. No combat balance values changed.

## CPU and determinism

The CPU emits only the six official action booleans into the same pure engine used by humans and the CLI. Opponent observations are delayed by 24/12/6 simulation frames (400/200/100 ms) for Easy/Normal/Hard, with decisions every 18/8/3 frames. Easy is hesitant with weak defense. Normal mixes attacks, guard, counters and low kicks against visible guard. Hard anticipates movement from two delayed position samples, predicts known animation recovery, and prioritizes quick counters and whiff punishment. Predictions can be fooled by movement changes. Holding an action through recovery is allowed exactly as with human input; the engine decides when it can execute.

The controller reads public positions, HP, move animation progress, guard and stun. It receives no player input, future state, clock, renderer timing or unseeded randomness. Its own fighter state is known immediately; opponent decisions always use delayed observations. Round transitions clear stale observations. The default seed is 14; pure `createMatch` accepts a seed for replay/testing. Restart resets it. Fixed seed plus identical per-tick P1 inputs reproduces the entire CPU match. This adds no new CLI tokens and does not change the frozen replay format.

## Verification

Run `npm run build`, then regression tests and both browser scripts in the pinned rootless runner. Browser scripts use synthetic standard gamepads and Chromium software WebGL2. They do not substitute for physical MacBook/controller or native WebGPU testing. The production bundle includes the original large Three.js renderer; Vite reports its size warning.

The pressure benchmark uses four deterministic approach-and-repeat attack policies, ten seeds each. It checks a relative difficulty progression, not a guarantee that Hard beats every strategy. Test and gate evidence is stored outside this worktree in `../enhanced-evidence`.
