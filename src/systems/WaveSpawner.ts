import type Phaser from "phaser";
import type { DataStore, EnemyDef, WaveDef } from "../core/DataStore";
import { pickWaveSpawnPoint } from "../world/defenseSpawns";

export type WaveSpawnCallbacks = {
  spawnEnemy: (x: number, y: number, def: EnemyDef, defId: string) => void;
  markSpawnPlanComplete: () => void;
};

/** Timed wave groups via Phaser `delayedCall` (AGENTS.md / REFACTOR_PLAN PR11). */
export function scheduleDefenseWave(
  scene: Phaser.Scene,
  store: DataStore,
  wave: WaveDef,
  callbacks: WaveSpawnCallbacks,
  e2eMode: boolean,
): void {
  let maxAt = 0;
  let total = 0;
  for (const group of wave.groups) {
    const enemyDef = store.enemies[group.enemyId];
    if (!enemyDef) continue;
    for (let i = 0; i < group.count; i++) {
      total += 1;
      const at = group.atMs + i * group.intervalMs;
      maxAt = Math.max(maxAt, at);
      scene.time.delayedCall(at, () => {
        const { x, y } = pickWaveSpawnPoint(e2eMode);
        callbacks.spawnEnemy(x, y, enemyDef, group.enemyId);
      });
    }
  }
  if (total === 0) {
    callbacks.markSpawnPlanComplete();
    return;
  }
  scene.time.delayedCall(maxAt + 50, () => {
    callbacks.markSpawnPlanComplete();
  });
}

export type { WaveSpawnCallbacks as DefenseWaveSpawnCallbacks };