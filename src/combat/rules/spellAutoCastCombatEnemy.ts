import { nearestEnemy } from "./spellMechanics";
import type { GroundAimEnemy } from "./spellGroundAim";

export type AutoCastCombatEnemy = {
  id: string;
  x: number;
  y: number;
};

function focusedEnemyInStrikeRange(
  focusEnemyId: string | null,
  enemies: readonly GroundAimEnemy[],
  playerX: number,
  playerY: number,
  maxStrikeRange: number,
): AutoCastCombatEnemy | null {
  if (!focusEnemyId) return null;
  const e = enemies.find((en) => en.id === focusEnemyId && en.alive);
  if (!e) return null;
  const d = Math.hypot(e.x - playerX, e.y - playerY);
  if (d > maxStrikeRange) return null;
  return { id: e.id, x: e.x, y: e.y };
}

function nearestEnemyInStrikeRange(
  playerX: number,
  playerY: number,
  enemies: readonly GroundAimEnemy[],
  maxStrikeRange: number,
): AutoCastCombatEnemy | null {
  const living = enemies.filter((e) => e.alive);
  const hit = nearestEnemy(playerX, playerY, living, maxStrikeRange);
  return hit ? { id: hit.id, x: hit.x, y: hit.y } : null;
}

/**
 * Shared auto-cast combat target pick for ground AoE and enemy-aimed spells:
 * focus in strike range, else nearest in strike range, else nearest in search range.
 */
export function pickAutoCastCombatEnemy(
  playerX: number,
  playerY: number,
  focusEnemyId: string | null,
  enemies: readonly GroundAimEnemy[],
  strikeMode: "melee" | "ranged",
  meleeRange: number,
  rangedRange: number,
  searchMaxRange: number,
): AutoCastCombatEnemy | null {
  const strikeRange = strikeMode === "melee" ? meleeRange : rangedRange;
  const inStrike =
    focusedEnemyInStrikeRange(
      focusEnemyId,
      enemies,
      playerX,
      playerY,
      strikeRange,
    ) ?? nearestEnemyInStrikeRange(playerX, playerY, enemies, strikeRange);
  if (inStrike) return inStrike;

  const living = enemies.filter((e) => e.alive);
  const extended = nearestEnemy(playerX, playerY, living, searchMaxRange);
  return extended ? { id: extended.id, x: extended.x, y: extended.y } : null;
}
