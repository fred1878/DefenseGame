import type { EnemyBehavior } from "./types";
import { meleeChaserBehavior } from "./meleeChaser";
import { arrowRainArcherBehavior } from "./arrowRainArcher";
import { javelineerBehavior } from "./javelineer";

const BEHAVIORS: Record<string, EnemyBehavior> = {
  meleeChaser: meleeChaserBehavior,
  arrowRainArcher: arrowRainArcherBehavior,
  javelineer: javelineerBehavior,
};

export function getEnemyBehavior(behaviorId: string): EnemyBehavior {
  return BEHAVIORS[behaviorId] ?? meleeChaserBehavior;
}