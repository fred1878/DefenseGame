import type { DataStore } from "../core/DataStore";

/** Enemy ids that appear in defense wave spawns (playable in endless). */
export function listPlayableDefenseEnemyIds(store: DataStore): string[] {
  const ids = new Set<string>();
  for (const wave of Object.values(store.waves)) {
    for (const group of wave.groups) {
      if (store.enemies[group.enemyId]) ids.add(group.enemyId);
    }
  }
  return [...ids].sort((a, b) => {
    const na = store.enemies[a]?.displayName ?? a;
    const nb = store.enemies[b]?.displayName ?? b;
    return na.localeCompare(nb);
  });
}