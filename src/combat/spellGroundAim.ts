import { clampGroundTarget, type EnemyHitTarget } from "./spellMechanics";
import { pickAutoCastCombatEnemy } from "./spellAutoCastCombatEnemy";

export type GroundAimEnemy = EnemyHitTarget & { alive: boolean };

/**
 * Auto-cast ground/AoE aim: same enemy pick as melee/auto attack (focus in strike
 * range, else nearest in strike range), then nearest living enemy within ground
 * range, then a short offset along facing.
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
    groundMaxRange,
  );

  let tx: number;
  let ty: number;
  if (autoTarget) {
    tx = autoTarget.x;
    ty = autoTarget.y;
  } else {
    tx = playerX + Math.cos(facingRad) * groundMaxRange * 0.55;
    ty = playerY + Math.sin(facingRad) * groundMaxRange * 0.55;
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
  let tx = focus?.x ?? playerX;
  let ty = focus?.y ?? playerY;
  if (!focus) {
    tx = playerX + Math.cos(facingRad) * groundMaxRange * 0.55;
    ty = playerY + Math.sin(facingRad) * groundMaxRange * 0.55;
  }
  return clampGroundTarget(playerX, playerY, tx, ty, groundMaxRange);
}