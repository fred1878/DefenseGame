import type Phaser from "phaser";
import type {
  DataStore,
  EnemyDef,
  WaveDef,
  WaveGroup,
} from "../core/DataStore";
import { pickWaveSpawnPoint } from "../world/defenseSpawns";

export type WaveSpawnerCallbacks = {
  spawnEnemy: (x: number, y: number, def: EnemyDef, defId: string) => void;
  markSpawnPlanComplete: () => void;
};

/** HP multiplier at or above which a group's enemies are labelled "Elite". */
export const ELITE_HP_MUL = 2;

function validMul(mul: number | undefined): number {
  return typeof mul === "number" && Number.isFinite(mul) && mul > 0 ? mul : 1;
}

/** Wave group `hpMul` (missing, non-finite or ≤ 0 → 1). */
export function groupHpMul(group: WaveGroup): number {
  return validMul(group.hpMul);
}

/** Wave group `damageMul` (missing, non-finite or ≤ 0 → 1). */
export function groupDamageMul(group: WaveGroup): number {
  return validMul(group.damageMul);
}

/** Combat damage numbers: `damage` and `…Damage` keys (not `…DamageScale`). */
const DAMAGE_KEY = /^damage$|Damage$/;

function scaleDamageFields<T>(value: T, mul: number): T {
  if (Array.isArray(value)) {
    return value.map((v: unknown) => scaleDamageFields(v, mul)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] =
      typeof v === "number" && DAMAGE_KEY.test(k)
        ? Math.max(1, Math.round(v * mul))
        : scaleDamageFields(v, mul);
  }
  return out as T;
}

/**
 * Enemy def with a group's HP and damage multipliers applied (same object at
 * 1× / 1×). HP ≥ `ELITE_HP_MUL` adds the "Elite" nameplate prefix.
 */
export function scaledEnemyDef(
  def: EnemyDef,
  hpMul: number,
  damageMul = 1,
): EnemyDef {
  if (hpMul === 1 && damageMul === 1) return def;
  const scaled: EnemyDef = {
    ...def,
    hp: Math.max(1, Math.round(def.hp * hpMul)),
    displayName:
      hpMul >= ELITE_HP_MUL ? `Elite ${def.displayName}` : def.displayName,
  };
  if (damageMul === 1) return scaled;
  return {
    ...scaled,
    damage: Math.max(1, Math.round(def.damage * damageMul)),
    combat: scaleDamageFields(def.combat, damageMul),
  };
}

/** Timed wave groups via Phaser `delayedCall` (REFACTOR_PLAN PR11 / AGENTS.md). */
export function scheduleWave(
  scene: Phaser.Scene,
  store: DataStore,
  wave: WaveDef,
  callbacks: WaveSpawnerCallbacks,
  e2eMode: boolean,
): void {
  let maxAt = 0;
  let total = 0;
  for (const group of wave.groups) {
    const baseDef = store.enemies[group.enemyId];
    if (!baseDef) continue;
    const enemyDef = scaledEnemyDef(
      baseDef,
      groupHpMul(group),
      groupDamageMul(group),
    );
    for (let i = 0; i < group.count; i++) {
      total += 1;
      const at = group.atMs + i * group.intervalMs;
      maxAt = Math.max(maxAt, at);
      scene.time.delayedCall(at, () => {
        const { x, y } = pickWaveSpawnPoint(e2eMode, scene.registry);
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
