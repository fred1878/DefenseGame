import type { EnemyBehavior } from "./types";
import { meleeChaserBehavior } from "./meleeChaser";
import { bruiserBehavior } from "./bruiser";
import { arrowRainArcherBehavior } from "./arrowRainArcher";
import { javelineerBehavior } from "./javelineer";
import { stationaryRangedBehavior } from "./stationaryRanged";
import { wallSiegeBehavior } from "./wallSiege";
import { chargerBehavior } from "./charger";
import { lobberBehavior } from "./lobber";
import { wardBehavior } from "./ward";

const BEHAVIORS: Record<string, EnemyBehavior> = {
  meleeChaser: meleeChaserBehavior,
  bruiser: bruiserBehavior,
  arrowRainArcher: arrowRainArcherBehavior,
  javelineer: javelineerBehavior,
  stationaryRanged: stationaryRangedBehavior,
  wallSiege: wallSiegeBehavior,
  charger: chargerBehavior,
  lobber: lobberBehavior,
  ward: wardBehavior,
};

export function getEnemyBehavior(behaviorId: string): EnemyBehavior {
  return BEHAVIORS[behaviorId] ?? meleeChaserBehavior;
}