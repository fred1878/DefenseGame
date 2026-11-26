/** Small seeded PRNG (mulberry32) so loot rolls are reproducible in tests. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Weighted pick; returns undefined when nothing has positive weight. */
export function pickWeighted<T>(
  rng: Rng,
  items: readonly T[],
  weight: (item: T) => number,
): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return undefined;
  let roll = rng() * total;
  for (const item of items) {
    const w = Math.max(0, weight(item));
    if (w <= 0) continue;
    if (roll < w) return item;
    roll -= w;
  }
  let last: T | undefined;
  for (const item of items) if (weight(item) > 0) last = item;
  return last;
}

/** Seed from Math.random for gameplay rolls (fixed in e2e visual runs). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
