import { readFileSync } from "node:fs";
import path from "node:path";
import type { EnemyCombatPartial } from "../core/enemyTuning";

const enemies = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/data/enemies.json"), "utf8"),
) as Record<string, { behavior: string; combat: EnemyCombatPartial }>;

/** Canonical shipped row per behavior for tests that only set `behavior`. */
const SHIPPED_ID_BY_BEHAVIOR: Record<string, string> = {
  meleeChaser: "grunt",
  bruiser: "bruiser",
  arrowRainArcher: "arrow_rain_archer",
  javelineer: "javelineer",
  stationaryRanged: "sentry_archer",
  wallSiege: "slow_siege",
  charger: "charger",
  lobber: "lobber",
  ward: "ward",
  rangedHybrid: "reaver",
};

/** Shipped `combat` block from `public/data/enemies.json` for tests. */
export function shippedEnemyCombat(enemyId: string): EnemyCombatPartial {
  const combat = enemies[enemyId]?.combat;
  if (!combat) {
    throw new Error(`Missing combat in shipped enemies.json for ${enemyId}`);
  }
  return combat;
}

/** Combat block for `behavior`, optionally overriding the shipped row id. */
export function shippedEnemyCombatForBehavior(
  behavior: string,
  defId?: string,
): EnemyCombatPartial {
  const byDef =
    defId && enemies[defId]?.behavior === behavior ? defId : undefined;
  const id = byDef ?? SHIPPED_ID_BY_BEHAVIOR[behavior] ?? defId ?? "grunt";
  return shippedEnemyCombat(id);
}
