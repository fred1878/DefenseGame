/** Allowed living enemies per type in endless training (inclusive). */
export const ENDLESS_CONCURRENT_MIN = 3;
export const ENDLESS_CONCURRENT_MAX = 10;

export function clampEndlessConcurrent(value: number): number {
  if (!Number.isFinite(value)) return ENDLESS_CONCURRENT_MIN;
  return Math.min(
    ENDLESS_CONCURRENT_MAX,
    Math.max(ENDLESS_CONCURRENT_MIN, Math.round(value)),
  );
}

/** How many enemies to spawn so `living` reaches `cap`. */
export function endlessSpawnDeficit(living: number, cap: number): number {
  const safeCap = clampEndlessConcurrent(cap);
  const safeLiving = Math.max(0, Math.floor(living));
  return Math.max(0, safeCap - safeLiving);
}

export function countLivingWithDefId(
  entries: ReadonlyArray<{
    defId: string;
    damageable: { alive: boolean };
  }>,
  enemyId: string,
): number {
  return entries.filter(
    (e) => e.damageable.alive && e.defId === enemyId,
  ).length;
}