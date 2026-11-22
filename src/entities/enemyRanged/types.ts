import type { ArrowRainTelegraph } from "../../combat/ArrowRainTelegraph";
import type { EnemyAttackPhase } from "../EnemyCombat";

export type ArrowRainCombatState = {
  telegraph?: ArrowRainTelegraph;
  zoneX: number;
  zoneY: number;
  tickAccumulatorMs: number;
  ticksDealt: number;
};

export type JavelineerCombatState = {
  shotFired: boolean;
};

export type LobberCombatState = {
  lobThrown: boolean;
  /** Ground telegraph stays until the lob detonates. */
  lobAirborne: boolean;
  aimX: number;
  aimY: number;
  telegraph?: ArrowRainTelegraph;
};

export type RangedHybridMode = "ranged" | "melee" | "retreat";

export type RangedHybridCombatState = {
  mode: RangedHybridMode;
  meleeSwings: number;
  shotFired: boolean;
  prevPhase: EnemyAttackPhase;
};

export type StationaryRangedCombatState = {
  shotFired: boolean;
};

export type JavelinSpawnRequest = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  damage: number;
};

export type LobSpawnRequest = JavelinSpawnRequest & {
  blastRadius: number;
  blastDamageScale: number;
};

export function createArrowRainCombatState(): ArrowRainCombatState {
  return {
    zoneX: 0,
    zoneY: 0,
    tickAccumulatorMs: 0,
    ticksDealt: 0,
  };
}

export function createJavelineerCombatState(): JavelineerCombatState {
  return { shotFired: false };
}

export function createLobberCombatState(): LobberCombatState {
  return { lobThrown: false, lobAirborne: false, aimX: 0, aimY: 0 };
}

export function createRangedHybridCombatState(): RangedHybridCombatState {
  return {
    mode: "ranged",
    meleeSwings: 0,
    shotFired: false,
    prevPhase: "idle",
  };
}

export function createStationaryRangedCombatState(): StationaryRangedCombatState {
  return { shotFired: false };
}