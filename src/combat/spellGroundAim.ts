import { clampGroundTarget, nearestEnemy, type EnemyHitTarget } from "./spellMechanics";

export type GroundAimEnemy = EnemyHitTarget & { alive: boolean };

function focusedEnemyPosition(
  focusEnemyId: string | null,
  enemies: readonly GroundAimEnemy[],
  playerX: number,
  playerY: number,
  maxStrikeRange: number,
): { x: number; y: number } | null {
  if (!focusEnemyId) return null;
  const e = enemies.find((en) => en.id === focusEnemyId && en.alive);
  if (!e) return null;
  const d = Math.hypot(e.x - playerX, e.y - playerY);
  if (d > maxStrikeRange) return null;
  return { x: e.x, y: e.y };
}

function nearestEnemyInStrikeRange(
  playerX: number,
  playerY: number,
  enemies: readonly GroundAimEnemy[],
  maxStrikeRange: number,
): { x: number; y: number } | null {
  const living = enemies.filter((e) => e.alive);
  const hit = nearestEnemy(playerX, playerY, living, maxStrikeRange);
  return hit ? { x: hit.x, y: hit.y } : null;
}

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
  const strikeRange = strikeMode === "melee" ? meleeRange : rangedRange;
  const autoTarget =
    focusedEnemyPosition(
      focusEnemyId,
      enemies,
      playerX,
      playerY,
      strikeRange,
    ) ?? nearestEnemyInStrikeRange(playerX, playerY, enemies, strikeRange);

  let tx: number;
  let ty: number;
  if (autoTarget) {
    tx = autoTarget.x;
    ty = autoTarget.y;
  } else {
    const living = enemies.filter((e) => e.alive);
    const nearest = nearestEnemy(playerX, playerY, living, groundMaxRange);
    if (nearest) {
      tx = nearest.x;
      ty = nearest.y;
    } else {
      tx = playerX + Math.cos(facingRad) * groundMaxRange * 0.55;
      ty = playerY + Math.sin(facingRad) * groundMaxRange * 0.55;
    }
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