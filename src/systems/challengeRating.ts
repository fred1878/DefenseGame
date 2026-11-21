import type { DataStore } from "../core/DataStore";

/** Sum challenge rating for roster rows (count × per-enemy rating). */
export function sumChallengeRating(
  store: DataStore,
  rows: ReadonlyArray<{ enemyId: string; count: number }>,
): number {
  let total = 0;
  for (const row of rows) {
    const n = Math.max(0, Math.floor(row.count));
    if (n <= 0) continue;
    const def = store.enemies[row.enemyId];
    if (!def) continue;
    total += def.challengeRating * n;
  }
  return total;
}