/** Every `enemies.json` `behavior` value the game knows (see `ai/behaviors/index.ts`). */
export const ENEMY_BEHAVIOR_IDS = [
  "meleeChaser",
  "bruiser",
  "arrowRainArcher",
  "javelineer",
  "stationaryRanged",
  "wallSiege",
  "charger",
  "lobber",
  "rangedHybrid",
  "ward",
] as const;

export type EnemyBehaviorId = (typeof ENEMY_BEHAVIOR_IDS)[number];

const IDS: ReadonlySet<string> = new Set(ENEMY_BEHAVIOR_IDS);

export function isEnemyBehaviorId(value: unknown): value is EnemyBehaviorId {
  return typeof value === "string" && IDS.has(value);
}
