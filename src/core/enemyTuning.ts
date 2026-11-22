import {
  enemyCollisionBodyRadius,
  playerBodyRadiusPx,
} from "../entities/entityPhysics";
import { ConfigLoadError } from "./configValidation";
import {
  behaviorCombatKitSections,
  requireEnemyArrowRainCombat,
  requireEnemyChargerCombat,
  requireEnemyHybridCombat,
  requireEnemyJavelineerCombat,
  requireEnemyLobberCombat,
  requireEnemyMeleeCombat,
  requireEnemyStationaryRangedCombat,
  requireEnemyWallCombat,
  requireEnemyWallSiegeCombat,
  requireEnemyWardCombat,
} from "./normalizeEnemyCombat";

/** Partial combat stats as authored in `public/data/enemies.json` (`combat` object). */
export type EnemyCombatPartial = {
  /** Wall objective attacks (all behaviors). */
  wall?: {
    damage?: number;
    triggerRangeWu?: number;
    hitRangeWu?: number;
  };
  /** Melee arc vs player (`meleeChaser` and javelineer too-close fallback). */
  melee?: {
    triggerRangeWu?: number;
    rangeWu?: number;
    /** Extra gap (WU) when chase stops before player body contact — per enemy only, no global default. */
    meleeChaseStandoffWu?: number;
    arcDeg?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
  };
  /** Floor AoE (`arrowRainArcher` behavior). */
  arrowRain?: {
    damage?: number;
    preferredRangeWu?: number;
    attackTriggerRangeWu?: number;
    kiteBandSlackWu?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    zoneRadiusWu?: number;
    tickIntervalMs?: number;
    tickDamageScale?: number;
    maxTicks?: number;
  };
  /** Kite + javelin toss (`javelineer` behavior). */
  javelineer?: {
    damage?: number;
    minRangeWu?: number;
    maxRangeWu?: number;
    kiteBandSlackWu?: number;
    strafeSpeedMul?: number;
    orbitFlipMs?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    projectileSpeedWu?: number;
    projectileMaxTravelWu?: number;
  };
  /** Hold position + straight bolt (`stationaryRanged` behavior). */
  stationaryRanged?: {
    damage?: number;
    preferredRangeWu?: number;
    attackTriggerRangeWu?: number;
    kiteBandSlackWu?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    projectileSpeedWu?: number;
    projectileMaxTravelWu?: number;
  };
  /** North-wall priority (`wallSiege` behavior). */
  wallSiege?: {
    playerAggroRadiusWu?: number;
  };
  /** Burst dash toward player (`charger` behavior). */
  charger?: {
    chargeDamage?: number;
    dashMinRangeWu?: number;
    dashTriggerRangeWu?: number;
    dashWindupMs?: number;
    dashDurationMs?: number;
    dashSpeedMul?: number;
    dashCooldownMs?: number;
    dashOvershootRangeWu?: number;
  };
  /** Arcing ground blast (`lobber` behavior). */
  lobber?: {
    damage?: number;
    preferredRangeWu?: number;
    attackTriggerRangeWu?: number;
    kiteBandSlackWu?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    projectileSpeedWu?: number;
    blastRadiusWu?: number;
    blastDamageScale?: number;
  };
  /** Bodyguard screening (`ward` behavior). */
  ward?: {
    protectRadiusWu?: number;
    screenOffsetWu?: number;
    playerAggroRadiusWu?: number;
  };
  /** Close-in melee burst then retreat (`rangedHybrid` behavior). */
  hybrid?: {
    closeMeleeRadiusWu?: number;
    preferredRangeWu?: number;
    maxMeleeSwings?: number;
    retreatRangeSlackWu?: number;
  };
};

export type EnemyWallCombat = {
  damage: number;
  triggerRangeWu: number;
  hitRangeWu: number;
};

export type EnemyMeleeCombat = {
  triggerRangeWu: number;
  rangeWu: number;
  arcDeg: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  /** Per-enemy chase stop gap past combined body radii (WU); required for melee player chasers. */
  meleeChaseStandoffWu?: number;
};

/** Behaviors that must author `combat.melee.meleeChaseStandoffWu` on each enemy row. */
export const MELEE_CHASE_STANDOFF_BEHAVIORS = new Set([
  "meleeChaser",
  "bruiser",
  "wallSiege",
  "charger",
  "ward",
  "rangedHybrid",
]);

/** Ranged kits — no `combat.melee`; phase timings live on the behavior kit block. */
export const RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS = new Set([
  "arrowRainArcher",
  "javelineer",
  "stationaryRanged",
  "lobber",
]);

export function enemyBehaviorRequiresMeleeBlock(behavior: string): boolean {
  return !RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS.has(behavior);
}

export type EnemyArrowRainCombat = {
  damage: number;
  preferredRangeWu: number;
  attackTriggerRangeWu: number;
  kiteBandSlackWu: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  zoneRadiusWu: number;
  tickIntervalMs: number;
  tickDamageScale: number;
  maxTicks: number;
};

export type EnemyJavelineerCombat = {
  damage: number;
  minRangeWu: number;
  maxRangeWu: number;
  kiteBandSlackWu: number;
  strafeSpeedMul: number;
  orbitFlipMs: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  projectileSpeedWu: number;
  projectileMaxTravelWu: number;
};

export type EnemyStationaryRangedCombat = {
  damage: number;
  preferredRangeWu: number;
  attackTriggerRangeWu: number;
  kiteBandSlackWu: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  projectileSpeedWu: number;
  projectileMaxTravelWu: number;
};

export type EnemyWallSiegeCombat = {
  playerAggroRadiusWu: number;
};

export type EnemyChargerCombat = {
  chargeDamage: number;
  dashMinRangeWu: number;
  dashTriggerRangeWu: number;
  dashWindupMs: number;
  dashDurationMs: number;
  dashSpeedMul: number;
  dashCooldownMs: number;
  dashOvershootRangeWu: number;
};

export type EnemyLobberCombat = {
  damage: number;
  preferredRangeWu: number;
  attackTriggerRangeWu: number;
  kiteBandSlackWu: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  projectileSpeedWu: number;
  blastRadiusWu: number;
  blastDamageScale: number;
};

export type EnemyWardCombat = {
  protectRadiusWu: number;
  screenOffsetWu: number;
  playerAggroRadiusWu: number;
};

export type EnemyHybridCombat = {
  closeMeleeRadiusWu: number;
  preferredRangeWu: number;
  maxMeleeSwings: number;
  retreatRangeSlackWu: number;
};

export type ResolvedEnemyCombat = {
  wall: EnemyWallCombat;
  melee?: EnemyMeleeCombat;
  arrowRain?: EnemyArrowRainCombat;
  javelineer?: EnemyJavelineerCombat;
  stationaryRanged?: EnemyStationaryRangedCombat;
  wallSiege?: EnemyWallSiegeCombat;
  charger?: EnemyChargerCombat;
  lobber?: EnemyLobberCombat;
  ward?: EnemyWardCombat;
  hybrid?: EnemyHybridCombat;
};

/** Arcade contact center distance for an enemy vs the player hurtbox (authored WU sum). */
export function enemyMeleeContactCenterDist(defId: string): number {
  return playerBodyRadiusPx() + enemyCollisionBodyRadius(defId);
}

/** Standoff south of {@link northWallAttackY} for path goals and melee holds — inside hit range (WU). */
export function wallMeleeApproachStandoffWu(
  wall: Pick<EnemyWallCombat, "hitRangeWu" | "triggerRangeWu">,
  slackWu = 2,
): number {
  const fromHit = Math.max(0, wall.hitRangeWu - slackWu);
  const fromTrigger = Math.max(0, wall.triggerRangeWu - 6);
  return Math.min(fromHit, fromTrigger);
}

export function requireMeleeChaseStandoffWu(
  melee: Pick<EnemyMeleeCombat, "meleeChaseStandoffWu">,
  behavior: string,
  enemyId: string,
): number {
  if (!MELEE_CHASE_STANDOFF_BEHAVIORS.has(behavior)) {
    throw new ConfigLoadError(
      `meleeChaseStandoffWu resolved for non-chase behavior ${behavior} (${enemyId})`,
    );
  }
  if (melee.meleeChaseStandoffWu === undefined) {
    throw new ConfigLoadError(
      `Missing number at enemies.${enemyId}.combat.melee.meleeChaseStandoffWu`,
    );
  }
  return melee.meleeChaseStandoffWu;
}

/**
 * Resolve per-enemy combat from an explicit `combat` block in `enemies.json`.
 * Missing required keys throw {@link ConfigLoadError} at boot.
 */
export function resolveEnemyCombat(
  behavior: string,
  combat: EnemyCombatPartial | undefined,
  enemyId: string,
): ResolvedEnemyCombat {
  const root = `enemies.${enemyId}.combat`;
  if (!combat) {
    throw new ConfigLoadError(`Expected object at ${root}`);
  }
  const resolved: ResolvedEnemyCombat = {
    wall: requireEnemyWallCombat(combat.wall, `${root}.wall`),
  };
  if (enemyBehaviorRequiresMeleeBlock(behavior)) {
    resolved.melee = requireEnemyMeleeCombat(
      behavior,
      combat.melee,
      `${root}.melee`,
    );
  }
  for (const section of behaviorCombatKitSections(behavior)) {
    if (section === "arrowRain") {
      resolved.arrowRain = requireEnemyArrowRainCombat(
        combat.arrowRain,
        `${root}.arrowRain`,
      );
    } else if (section === "javelineer") {
      resolved.javelineer = requireEnemyJavelineerCombat(
        combat.javelineer,
        `${root}.javelineer`,
      );
    } else if (section === "stationaryRanged") {
      resolved.stationaryRanged = requireEnemyStationaryRangedCombat(
        combat.stationaryRanged,
        `${root}.stationaryRanged`,
      );
    } else if (section === "wallSiege") {
      resolved.wallSiege = requireEnemyWallSiegeCombat(
        combat.wallSiege,
        `${root}.wallSiege`,
      );
    } else if (section === "charger") {
      resolved.charger = requireEnemyChargerCombat(
        combat.charger,
        `${root}.charger`,
      );
    } else if (section === "lobber") {
      resolved.lobber = requireEnemyLobberCombat(
        combat.lobber,
        `${root}.lobber`,
      );
    } else if (section === "ward") {
      resolved.ward = requireEnemyWardCombat(combat.ward, `${root}.ward`);
    } else if (section === "hybrid") {
      resolved.hybrid = requireEnemyHybridCombat(
        combat.hybrid,
        `${root}.hybrid`,
      );
    }
  }
  return resolved;
}