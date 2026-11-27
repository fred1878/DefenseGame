import type Phaser from "phaser";
import type { DataStore, EnemyDef, WaveDef } from "../../core/data/DataStore";
import { e2eCampaignWavesFromQuery, isE2EEnabled } from "../../e2e/e2eMode";
import { scheduleWave, waveSpawnTotal } from "../../systems/WaveSpawner";

/** Enemies spawned so far / planned for this night's wave (top HUD counter). */
export type DefenseWaveProgress = { spawned: number; total: number };

export type DefenseSpawnPlanInput = {
  scene: Phaser.Scene;
  store: DataStore;
  wave: WaveDef | undefined;
  endless: boolean;
  wavePlanner: boolean;
  progress: DefenseWaveProgress;
  setSpawnPlanComplete: (done: boolean) => void;
  spawnEnemyAt: (x: number, y: number, def: EnemyDef, defId: string) => void;
  ensureEndlessSpawnCap: () => void;
};

/** Start the night's spawning: endless top-up, a scheduled wave, or none. */
export function startDefenseSpawnPlan(input: DefenseSpawnPlanInput): void {
  const { wave, wavePlanner, progress } = input;
  if (input.endless) {
    input.setSpawnPlanComplete(true);
    input.ensureEndlessSpawnCap();
  } else if (
    wave &&
    (!isE2EEnabled() || wavePlanner || e2eCampaignWavesFromQuery())
  ) {
    // E2E skips campaign waves (tests spawn their own enemies), but a wave
    // planner run is an explicit player-built plan, so it always runs, and
    // `campaignWaves=1` opts a validation run into the real night.
    progress.spawned = 0;
    progress.total = waveSpawnTotal(input.store, wave);
    scheduleWave(
      input.scene,
      input.store,
      wave,
      {
        spawnEnemy: (x, y, def, defId) => {
          progress.spawned += 1;
          return input.spawnEnemyAt(x, y, def, defId);
        },
        markSpawnPlanComplete: () => input.setSpawnPlanComplete(true),
      },
      isE2EEnabled() && !e2eCampaignWavesFromQuery(),
    );
  } else if (isE2EEnabled()) {
    input.setSpawnPlanComplete(false);
  } else {
    input.setSpawnPlanComplete(true);
  }
}
