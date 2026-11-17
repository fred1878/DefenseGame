import type { Damageable } from "../combat/DamageSystem";

export type {
  ArrowRainCombatState,
  JavelineerCombatState,
  LobberCombatState,
  RangedHybridMode,
  RangedHybridCombatState,
  StationaryRangedCombatState,
  JavelinSpawnRequest,
  LobSpawnRequest,
} from "./enemyRanged/types";

export {
  createArrowRainCombatState,
  createJavelineerCombatState,
  createLobberCombatState,
  createRangedHybridCombatState,
  createStationaryRangedCombatState,
} from "./enemyRanged/types";

export { updateArrowRainCombat, playerInsideArrowRain } from "./enemyRanged/arrowRainCombat";
export { updateJavelineerCombat } from "./enemyRanged/javelineerCombat";
export { updateStationaryRangedCombat } from "./enemyRanged/stationaryRangedCombat";
export { updateLobberCombat } from "./enemyRanged/lobberCombat";
export {
  resetHybridCombatPhase,
  updateRangedHybridCombat,
} from "./enemyRanged/rangedHybridCombat";

export type EnemyProjectileTarget = {
  x: number;
  y: number;
  radius: number;
  damageable: Damageable;
};