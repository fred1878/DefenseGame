/** Visual-only scatter so stacked AoE telegraphs (arrow rain, lobber) do not sit on one pixel. */
const JITTER_MIN_PX = 1;
const JITTER_MAX_PX = 5;

/** Random offset 1–5 px from `x`,`y` in a uniform random direction. */
export function jitterTelegraphCenter(
  x: number,
  y: number,
  random: () => number = Math.random,
): { x: number; y: number } {
  const dist = JITTER_MIN_PX + random() * (JITTER_MAX_PX - JITTER_MIN_PX);
  const angle = random() * Math.PI * 2;
  return {
    x: x + Math.cos(angle) * dist,
    y: y + Math.sin(angle) * dist,
  };
}
