import type { DataStore, EnemyDef } from "../../core/DataStore";
import type { EndlessRunSelection } from "../../core/defenseRunMode";
import type { EnemyInstance } from "../../entities/Enemy";
import {
  countLivingWithDefId,
  planEndlessSpawns,
} from "../../systems/endlessSpawnScheduler";
import { pickWaveSpawnPoint } from "../../world/defenseSpawns";

/** HUD header for an endless run, e.g. `Endless · Goblin +2`. */
export function endlessHudHeader(
  store: DataStore,
  selections: readonly EndlessRunSelection[] | null,
): string {
  const sels = selections ?? [];
  if (sels.length === 0) return "Endless";
  const first = store.enemies[sels[0]!.enemyId]?.displayName ?? sels[0]!.enemyId;
  if (sels.length === 1) return `Endless · ${first}`;
  return `Endless · ${first} +${sels.length - 1}`;
}

export function livingCountByEndlessEnemyId(
  selections: readonly EndlessRunSelection[] | null,
  enemies: readonly EnemyInstance[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const sel of selections ?? []) {
    map.set(sel.enemyId, countLivingWithDefId(enemies, sel.enemyId));
  }
  return map;
}

export type EndlessSpawnCapInput = {
  selections: EndlessRunSelection[] | null;
  nightEnded: boolean;
  store: DataStore;
  enemies: readonly EnemyInstance[];
  e2e: boolean;
  spawnEnemyAt: (x: number, y: number, def: EnemyDef, defId: string) => void;
};

/** Top up each endless enemy type to its concurrent cap. */
export function ensureEndlessSpawnCap(input: EndlessSpawnCapInput): void {
  if (!input.selections?.length || input.nightEnded) return;
  const living = livingCountByEndlessEnemyId(input.selections, input.enemies);
  const plan = planEndlessSpawns(input.selections, living);
  for (const entry of plan) {
    if (entry.spawnCount <= 0) continue;
    const def = input.store.enemies[entry.enemyId];
    if (!def) continue;
    for (let i = 0; i < entry.spawnCount; i++) {
      const { x, y } = pickWaveSpawnPoint(input.e2e);
      input.spawnEnemyAt(x, y, def, entry.enemyId);
    }
  }
}
