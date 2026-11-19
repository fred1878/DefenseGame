import type {
  EnemyArrowRainCombat,
  EnemyChargerCombat,
  EnemyCombatDefaultsBundle,
  EnemyHybridCombat,
  EnemyJavelineerCombat,
  EnemyLobberCombat,
  EnemyMeleeCombat,
  EnemyStationaryRangedCombat,
  EnemyWallCombat,
  EnemyWallSiegeCombat,
  EnemyWardCombat,
} from "./enemyTuning";

/** Authorable shape of `public/data/enemy-combat-defaults.json`. */
export type EnemyCombatDefaultsInput = {
  wall?: Partial<EnemyWallCombat>;
  melee?: Partial<EnemyMeleeCombat>;
  arrowRain?: Partial<EnemyArrowRainCombat>;
  javelineer?: Partial<EnemyJavelineerCombat>;
  stationaryRanged?: Partial<EnemyStationaryRangedCombat>;
  wallSiege?: Partial<EnemyWallSiegeCombat>;
  charger?: Partial<EnemyChargerCombat>;
  lobber?: Partial<EnemyLobberCombat>;
  ward?: Partial<EnemyWardCombat>;
  hybrid?: Partial<EnemyHybridCombat>;
};

export function normalizeEnemyCombatDefaults(
  base: EnemyCombatDefaultsBundle,
  raw: EnemyCombatDefaultsInput,
): EnemyCombatDefaultsBundle {
  return {
    wall: { ...base.wall, ...raw.wall },
    melee: { ...base.melee, ...raw.melee },
    arrowRain: { ...base.arrowRain, ...raw.arrowRain },
    javelineer: { ...base.javelineer, ...raw.javelineer },
    stationaryRanged: {
      ...base.stationaryRanged,
      ...raw.stationaryRanged,
    },
    wallSiege: { ...base.wallSiege, ...raw.wallSiege },
    charger: { ...base.charger, ...raw.charger },
    lobber: { ...base.lobber, ...raw.lobber },
    ward: { ...base.ward, ...raw.ward },
    hybrid: { ...base.hybrid, ...raw.hybrid },
  };
}