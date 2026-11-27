import { clampEndlessConcurrent } from "../core/endlessLimits";

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
  return entries.filter((e) => e.damageable.alive && e.defId === enemyId)
    .length;
}

export type EndlessSpawnPlanEntry = {
  enemyId: string;
  spawnCount: number;
};

/** Per-type spawn deficit for an endless run with multiple enemy types. */
export function planEndlessSpawns(
  selections: ReadonlyArray<{ enemyId: string; concurrentCap: number }>,
  livingByEnemyId: ReadonlyMap<string, number> | Record<string, number>,
): EndlessSpawnPlanEntry[] {
  const living = (id: string): number => {
    if (livingByEnemyId instanceof Map) return livingByEnemyId.get(id) ?? 0;
    return (livingByEnemyId as Record<string, number>)[id] ?? 0;
  };
  return selections.map((sel) => ({
    enemyId: sel.enemyId,
    spawnCount: endlessSpawnDeficit(living(sel.enemyId), sel.concurrentCap),
  }));
}
