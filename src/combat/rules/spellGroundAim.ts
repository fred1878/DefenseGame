import { tuning } from "../../tuning/gameTuning";
import {
  clampGroundTarget,
  nearestEnemy,
  type EnemyHitTarget,
} from "./spellMechanics";
import { pickAutoCastCombatEnemy } from "./spellAutoCastCombatEnemy";

export type GroundAimEnemy = EnemyHitTarget & { alive: boolean };

/** No-enemy ground aim lands this fraction of max range ahead (`spell_input.json`). */
function facingRangeFrac(): number {
  return tuning("spellInput").groundAimFacingRangeFrac;
}

/** Strike-range rules first; tier-3 search is all living enemies (aim clamped to ground max). */
export const AUTO_CAST_GROUND_ENEMY_SEARCH_RANGE = Number.POSITIVE_INFINITY;

/**
 * Auto-cast ground/AoE aim: same enemy pick as melee/auto attack (focus in strike
 * range, else nearest in strike range), then nearest living enemy for direction
 * (any distance). Within ground max range aim at the enemy; beyond it, max range
 * along that vector. With no enemies, a short offset along facing.
 */
export function resolveAutoCastGroundAim(
  playerX: number,
  playerY: number,
  facingRad: number,
  focusEnemyId: string | null,
  enemies: readonly GroundAimEnemy[],
  strikeMode: "melee" | "ranged",
  meleeRange: number,
  rangedRange: number,
  groundMaxRange: number,
): { x: number; y: number } {
  const autoTarget = pickAutoCastCombatEnemy(
    playerX,
    playerY,
    focusEnemyId,
    enemies,
    strikeMode,
    meleeRange,
    rangedRange,
    AUTO_CAST_GROUND_ENEMY_SEARCH_RANGE,
  );

  let tx: number;
  let ty: number;
  if (autoTarget) {
    tx = autoTarget.x;
    ty = autoTarget.y;
  } else {
    const reach = groundMaxRange * facingRangeFrac();
    tx = playerX + Math.cos(facingRad) * reach;
    ty = playerY + Math.sin(facingRad) * reach;
  }
  return clampGroundTarget(playerX, playerY, tx, ty, groundMaxRange);
}

/**
 * Initial reticle for manual ground casts: focused enemy (any range) or facing offset.
 */
export function resolveManualDefaultGroundAim(
  playerX: number,
  playerY: number,
  facingRad: number,
  focusEnemyId: string | null,
  enemies: readonly GroundAimEnemy[],
  groundMaxRange: number,
): { x: number; y: number } {
  const focus = focusEnemyId
    ? enemies.find((e) => e.id === focusEnemyId && e.alive)
    : null;
  if (focus) {
    return clampGroundTarget(
      playerX,
      playerY,
      focus.x,
      focus.y,
      groundMaxRange,
    );
  }
  const living = enemies.filter((e) => e.alive);
  const nearest = nearestEnemy(playerX, playerY, living, groundMaxRange);
  if (nearest) {
    return clampGroundTarget(
      playerX,
      playerY,
      nearest.x,
      nearest.y,
      groundMaxRange,
    );
  }
  const reach = groundMaxRange * facingRangeFrac();
  const tx = playerX + Math.cos(facingRad) * reach;
  const ty = playerY + Math.sin(facingRad) * reach;
  return clampGroundTarget(playerX, playerY, tx, ty, groundMaxRange);
}
