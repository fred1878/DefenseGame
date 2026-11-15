import type { EnemyBehavior } from "./types";
import { meleeChaserBehavior } from "./meleeChaser";
import { bruiserBehavior } from "./bruiser";
import { arrowRainArcherBehavior } from "./arrowRainArcher";
import { javelineerBehavior } from "./javelineer";
import { stationaryRangedBehavior } from "./stationaryRanged";

const BEHAVIORS: Record<string, EnemyBehavior> = {
  meleeChaser: meleeChaserBehavior,
  bruiser: bruiserBehavior,
  arrowRainArcher: arrowRainArcherBehavior,
  javelineer: javelineerBehavior,
  stationaryRanged: stationaryRangedBehavior,
};

export function getEnemyBehavior(behaviorId: string): EnemyBehavior {
  return BEHAVIORS[behaviorId] ?? meleeChaserBehavior;
}