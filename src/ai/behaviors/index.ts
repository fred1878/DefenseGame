import type { EnemyBehaviorId } from "../../core/enemyBehaviorIds";
import type { EnemyBehavior } from "./types";
import { meleeChaserBehavior } from "./meleeChaser";
import { bruiserBehavior } from "./bruiser";
import { arrowRainArcherBehavior } from "./arrowRainArcher";
import { javelineerBehavior } from "./javelineer";
import { stationaryRangedBehavior } from "./stationaryRanged";
import { wallSiegeBehavior } from "./wallSiege";
import { chargerBehavior } from "./charger";
import { lobberBehavior } from "./lobber";
import { rangedHybridBehavior } from "./rangedHybrid";
import { wardBehavior } from "./ward";

const BEHAVIORS: Record<EnemyBehaviorId, EnemyBehavior> = {
  meleeChaser: meleeChaserBehavior,
  bruiser: bruiserBehavior,
  arrowRainArcher: arrowRainArcherBehavior,
  javelineer: javelineerBehavior,
  stationaryRanged: stationaryRangedBehavior,
  wallSiege: wallSiegeBehavior,
  charger: chargerBehavior,
  lobber: lobberBehavior,
  rangedHybrid: rangedHybridBehavior,
  ward: wardBehavior,
};

/** Behaviour ids are validated at load (`normalizeEnemyRow`), so lookup is total. */
export function getEnemyBehavior(behaviorId: EnemyBehaviorId): EnemyBehavior {
  return BEHAVIORS[behaviorId];
}
