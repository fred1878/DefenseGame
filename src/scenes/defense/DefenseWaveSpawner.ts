import type Phaser from "phaser";
import type { DataStore, WaveDef } from "../../core/DataStore";
import {
  scheduleWave,
  type WaveSpawnerCallbacks,
} from "../../systems/WaveSpawner";

export type DefenseWaveSpawnCallbacks = WaveSpawnerCallbacks;

/** @deprecated Import `scheduleWave` from `src/systems/WaveSpawner.ts`. */
export function scheduleDefenseWave(
  scene: Phaser.Scene,
  store: DataStore,
  wave: WaveDef,
  callbacks: DefenseWaveSpawnCallbacks,
  e2eMode: boolean,
): void {
  scheduleWave(scene, store, wave, callbacks, e2eMode);
}

export { scheduleWave };
