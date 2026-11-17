import type { GroundAimEnemy } from "./spellGroundAim";
import { pickAutoCastCombatEnemy } from "./spellAutoCastCombatEnemy";

export type AutoCastEnemyAim = {
  id: string;
  x: number;
  y: number;
};

/**
 * Auto-cast enemy aim: focused combat target in strike range, else nearest in
 * strike range, else nearest within `searchMaxRange` (spell ground range, etc.).
 */
export function resolveAutoCastEnemyAim(
  playerX: number,
  playerY: number,
  focusEnemyId: string | null,
  enemies: readonly GroundAimEnemy[],
  strikeMode: "melee" | "ranged",
  meleeRange: number,
  rangedRange: number,
  searchMaxRange: number,
): AutoCastEnemyAim | null {
  return pickAutoCastCombatEnemy(
    playerX,
    playerY,
    focusEnemyId,
    enemies,
    strikeMode,
    meleeRange,
    rangedRange,
    searchMaxRange,
  );
}