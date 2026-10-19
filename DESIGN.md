# CRT Fighters

An underground broadcast arena: dark graphite, warm white typography, cyan player one and amber player two. The lit CRT fighters are the focus; interface chrome stays outside their silhouettes.

## Tokens
Background #101116, panel #191c24, ink #f2f1e9, muted #a9adbc, player one #67e8ed, player two #ffbd69, damage #ff605d. System sans headings, system monospace telemetry. Spacing 4, 8, 12, 16, 24, 32 px. Rectangular panels; 44 px minimum controls.

## Layout
Full viewport 3D stage, top HUD with mirrored health bars and central round clock. Bottom command strip, collapsible controls and settings. At narrow widths use smaller HUD labels and wrap controls without covering the fighters.

## Interaction and accessibility
Keyboard codes and gamepad mapping follow ARCHITECTURE.md. Clear held inputs on blur. Escape pauses only the page, with visible resume. Restart is explicit. Sound is opt-in; reduced motion disables camera shake. Focus-visible outlines use white. Status announcements occur on round changes, never every frame.

## Rendering and motion
One shared three.js build, WebGPURenderer with WebGL2 fallback. Model clips sample engine frames, not display time. Fixed 60 Hz simulation with bounded catch-up; page visibility clears accumulated time. Local assets only.
