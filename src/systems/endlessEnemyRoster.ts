import type { DataStore, EnemyDef } from "../core/DataStore";
import { clampEndlessConcurrent } from "./endlessSpawnScheduler";

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

/** Per-id defaults when JSON omits `endlessConcurrent`. */
const ENDLESS_CONCURRENT_BY_ID: Record<string, number> = {
  grunt: 10,
  skirmisher: 9,
  fast_sapper: 9,
  charger: 8,
  bruiser: 6,
  reaver: 5,
  arrow_rain_archer: 4,
  sentry_archer: 4,
  javelineer: 3,
  lobber: 3,
  slow_siege: 3,
  ward: 3,
};

const ENDLESS_CONCURRENT_BY_BEHAVIOR: Record<string, number> = {
  meleeChaser: 9,
  bruiser: 6,
  charger: 8,
  arrowRainArcher: 4,
  stationaryRanged: 4,
  rangedHybrid: 5,
  javelineer: 3,
  lobber: 3,
  wallSiege: 3,
  ward: 3,
};

const DEFAULT_ENDLESS_CONCURRENT = 5;

/** Target concurrent living count for one endless enemy type. */
export function getEndlessConcurrentCap(
  enemyId: string,
  def?: Pick<EnemyDef, "behavior" | "endlessConcurrent">,
): number {
  if (def?.endlessConcurrent !== undefined) {
    return clampEndlessConcurrent(def.endlessConcurrent);
  }
  const byId = ENDLESS_CONCURRENT_BY_ID[enemyId];
  if (byId !== undefined) return clampEndlessConcurrent(byId);
  const behavior = def?.behavior;
  if (behavior && ENDLESS_CONCURRENT_BY_BEHAVIOR[behavior] !== undefined) {
    return clampEndlessConcurrent(ENDLESS_CONCURRENT_BY_BEHAVIOR[behavior]);
  }
  return clampEndlessConcurrent(DEFAULT_ENDLESS_CONCURRENT);
}