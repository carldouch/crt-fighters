// Fractions measured at the attacking limb's maximum forward reach in the bundled clips.
// That pose coincides with the engine's first active frame, rather than stretching the
// whole clip uniformly and showing a hit during the wind-up.
const contact = { leftpunch: 0.565, rightpunch: 0.445, lowkick: 0.415, middlekick: 0.43, highkick: 0.375 };

export function moveClipTime(rule, frame, duration) {
  const peak = contact[rule.anim];
  if (frame < rule.startup) return duration * peak * frame / rule.startup;
  if (frame < rule.startup + rule.active) return duration * peak;
  const recovery = (frame - rule.startup - rule.active + 1) / rule.recovery;
  return duration * (peak + (1 - peak) * recovery);
}
