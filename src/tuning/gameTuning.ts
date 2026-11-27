import type { EnemyAiTuning } from "../config/enemy";
import type { PlayerTuning } from "../config/player";
import type { ShadowformMechanics } from "../config/shadowformMechanics";
import type { SpellInputTuning } from "../config/spellInput";
import type { HitFlashConfig } from "../core/data/normalizeHitFlash";
import type { GameplayTuning } from "../core/data/normalizeGameplay";

/** `entity-physics.json` after normalising. */
export type EntityPhysicsTuning = {
  enemyPathClearanceMarginWu: number;
  staticObstacleNavClearanceWu: number;
  knockbackVelocityCapMult: number;
};

/**
 * Gameplay tuning loaded from `public/data/*.json` at Boot (and by the test
 * setup / sim). Each slot is set once per load and frozen; readers call
 * `tuning("enemyAi").playerAggroRadiusWu` instead of importing mutable
 * `export let` globals. Reading a slot before it is loaded throws.
 */
export type GameTuning = {
  enemyAi: EnemyAiTuning;
  entityPhysics: EntityPhysicsTuning;
  spellInput: SpellInputTuning;
  hitFlash: HitFlashConfig;
  shadowform: ShadowformMechanics;
  /** `player.json` without gear (see `playerTuning()` for the active values). */
  player: PlayerTuning;
  /** Global rules from `gameplay.json` (wall, spawn band, shared combat, feel). */
  gameplay: GameplayTuning;
};

type TuningKey = keyof GameTuning;

const SOURCE: Record<TuningKey, string> = {
  enemyAi: "public/data/enemy-ai.json",
  entityPhysics: "public/data/entity-physics.json",
  spellInput: "public/data/spell_input.json",
  hitFlash: "public/data/hit-flash.json",
  shadowform: "shadowform fields from public/data/spells.json",
  player: "public/data/player.json",
  gameplay: "public/data/gameplay.json",
};

const slots: Partial<Record<TuningKey, unknown>> = {};

export function setTuning<K extends TuningKey>(
  key: K,
  value: GameTuning[K],
): void {
  slots[key] = deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function tuning<K extends TuningKey>(key: K): Readonly<GameTuning[K]> {
  const value = slots[key] as Readonly<GameTuning[K]> | undefined;
  if (value === undefined) {
    throw new Error(
      `${key} tuning not loaded — Boot must apply ${SOURCE[key]}`,
    );
  }
  return value;
}
