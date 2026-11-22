import {
  enemyCollisionBodyRadius,
  playerBodyRadiusPx,
} from "../entities/entityPhysics";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeEnemyCombatDefaults,
  type EnemyCombatDefaultsInput,
} from "./normalizeEnemyCombatDefaults";

/** Partial combat stats as authored in `public/data/enemies.json` (`combat` object). */
export type EnemyCombatPartial = {
  /** Wall objective attacks (all behaviors). */
  wall?: {
    damage?: number;
    triggerRange?: number;
    hitRange?: number;
  };
  /** Melee arc vs player (`meleeChaser` and javelineer too-close fallback). */
  melee?: {
    triggerRange?: number;
    range?: number;
    /** Extra gap (WU) when chase stops before player body contact — per enemy only, no global default. */
    meleeChaseStandoffWu?: number;
    engageBodySlackPx?: number;
    arcDeg?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
  };
  /** Floor AoE (`arrowRainArcher` behavior). */
  arrowRain?: {
    damage?: number;
    preferredRange?: number;
    attackTriggerRange?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    zoneRadius?: number;
    tickIntervalMs?: number;
    tickDamageScale?: number;
    maxTicks?: number;
  };
  /** Kite + javelin toss (`javelineer` behavior). */
  javelineer?: {
    damage?: number;
    minRange?: number;
    maxRange?: number;
    strafeSpeedMul?: number;
    orbitFlipMs?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    projectileSpeed?: number;
    projectileMaxTravel?: number;
  };
  /** Hold position + straight bolt (`stationaryRanged` behavior). */
  stationaryRanged?: {
    damage?: number;
    preferredRange?: number;
    attackTriggerRange?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    projectileSpeed?: number;
    projectileMaxTravel?: number;
  };
  /** North-wall priority (`wallSiege` behavior). */
  wallSiege?: {
    playerAggroRadius?: number;
  };
  /** Burst dash toward player (`charger` behavior). */
  charger?: {
    chargeDamage?: number;
    /** World units — must be at or beyond this distance to start dash windup. */
    dashMinRange?: number;
    dashTriggerRange?: number;
    dashWindupMs?: number;
    dashDurationMs?: number;
    dashSpeedMul?: number;
    dashCooldownMs?: number;
    /** World units to continue past the windup aim point along the dash line. */
    dashOvershootRange?: number;
  };
  /** Arcing ground blast (`lobber` behavior). */
  lobber?: {
    damage?: number;
    preferredRange?: number;
    attackTriggerRange?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
    projectileSpeed?: number;
    blastRadius?: number;
    blastDamageScale?: number;
  };
  /** Bodyguard screening (`ward` behavior). */
  ward?: {
    protectRadius?: number;
    screenOffsetWu?: number;
    playerAggroRadius?: number;
  };
  /** Close-in melee burst then retreat (`rangedHybrid` behavior). */
  hybrid?: {
    closeMeleeRadius?: number;
    preferredRange?: number;
    maxMeleeSwings?: number;
    retreatRangeSlack?: number;
  };
};

export type EnemyWallCombat = {
  damage: number;
  triggerRange: number;
  hitRange: number;
};

export type EnemyMeleeCombat = {
  triggerRange: number;
  range: number;
  arcDeg: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  /** Per-enemy chase stop gap past combined body radii (WU); required for melee player chasers. */
  meleeChaseStandoffWu?: number;
  /** Defaults bundle only — touch slack when deriving engage floors from physics. */
  engageBodySlackPx?: number;
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

export type EnemyArrowRainCombat = {
  damage: number;
  preferredRange: number;
  attackTriggerRange: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  zoneRadius: number;
  tickIntervalMs: number;
  tickDamageScale: number;
  maxTicks: number;
};

export type EnemyJavelineerCombat = {
  damage: number;
  minRange: number;
  maxRange: number;
  strafeSpeedMul: number;
  orbitFlipMs: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  projectileSpeed: number;
  projectileMaxTravel: number;
};

export type EnemyStationaryRangedCombat = {
  damage: number;
  preferredRange: number;
  attackTriggerRange: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  projectileSpeed: number;
  projectileMaxTravel: number;
};

export type EnemyWallSiegeCombat = {
  playerAggroRadius: number;
};

export type EnemyChargerCombat = {
  chargeDamage: number;
  dashMinRange: number;
  dashTriggerRange: number;
  dashWindupMs: number;
  dashDurationMs: number;
  dashSpeedMul: number;
  dashCooldownMs: number;
  dashOvershootRange: number;
};

export type EnemyLobberCombat = {
  damage: number;
  preferredRange: number;
  attackTriggerRange: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  projectileSpeed: number;
  blastRadius: number;
  blastDamageScale: number;
};

export type EnemyWardCombat = {
  protectRadius: number;
  screenOffsetWu: number;
  playerAggroRadius: number;
};

export type EnemyHybridCombat = {
  closeMeleeRadius: number;
  preferredRange: number;
  maxMeleeSwings: number;
  retreatRangeSlack: number;
};

export type ResolvedEnemyCombat = {
  wall: EnemyWallCombat;
  melee: EnemyMeleeCombat;
  arrowRain?: EnemyArrowRainCombat;
  javelineer?: EnemyJavelineerCombat;
  stationaryRanged?: EnemyStationaryRangedCombat;
  wallSiege?: EnemyWallSiegeCombat;
  charger?: EnemyChargerCombat;
  lobber?: EnemyLobberCombat;
  ward?: EnemyWardCombat;
  hybrid?: EnemyHybridCombat;
};

/** Baseline combat tables from `public/data/enemy-combat-defaults.json`. */
export type EnemyCombatDefaultsBundle = {
  wall: EnemyWallCombat;
  melee: EnemyMeleeCombat;
  arrowRain: EnemyArrowRainCombat;
  javelineer: EnemyJavelineerCombat;
  stationaryRanged: EnemyStationaryRangedCombat;
  wallSiege: EnemyWallSiegeCombat;
  charger: EnemyChargerCombat;
  lobber: EnemyLobberCombat;
  ward: EnemyWardCombat;
  hybrid: EnemyHybridCombat;
};

/** Arcade contact center distance for an enemy vs the player hurtbox. */
export function enemyMeleeContactCenterDist(defId: string): number {
  return playerBodyRadiusPx() + enemyCollisionBodyRadius(defId);
}

/** Raise authored melee reach so windups can start at collision contact and arcs connect. */
export function clampMeleeEngageForPhysics(
  melee: EnemyMeleeCombat,
  _behavior: string,
  defId?: string,
): EnemyMeleeCombat {
  const slack = melee.engageBodySlackPx ?? getEnemyCombatDefaults().melee.engageBodySlackPx!;
  if (!defId) {
    const { engageBodySlackPx: _omit, ...combat } = melee;
    return combat;
  }
  const contact = enemyMeleeContactCenterDist(defId);
  const triggerMin = Math.max(0, contact - slack);
  const rangeMin = enemyCollisionBodyRadius(defId);
  const { engageBodySlackPx: _omit, ...combat } = melee;
  return {
    ...combat,
    triggerRange: Math.max(melee.triggerRange, triggerMin),
    range: Math.max(melee.range, rangeMin),
  };
}

/** Standoff south of {@link northWallAttackY} for path goals and melee holds — inside hit range. */
export function wallMeleeApproachStandoffPx(
  wall: Pick<EnemyWallCombat, "hitRange" | "triggerRange">,
  slackPx = 2,
): number {
  const fromHit = Math.max(0, wall.hitRange - slackPx);
  const fromTrigger = Math.max(0, wall.triggerRange - 6);
  return Math.min(fromHit, fromTrigger);
}

let activeEnemyCombatDefaults: EnemyCombatDefaultsBundle | null = null;

export function getEnemyCombatDefaults(): EnemyCombatDefaultsBundle {
  if (!activeEnemyCombatDefaults) {
    throw new ConfigLoadError(
      "Enemy combat defaults not loaded — call DataStore.loadAll or applyEnemyCombatDefaults first",
    );
  }
  return activeEnemyCombatDefaults;
}

export function applyEnemyCombatDefaults(raw: EnemyCombatDefaultsInput): void {
  activeEnemyCombatDefaults = normalizeEnemyCombatDefaults(raw);
}

function mergeMelee(partial?: EnemyCombatPartial["melee"]): EnemyMeleeCombat {
  const d = getEnemyCombatDefaults().melee;
  return {
    triggerRange: partial?.triggerRange ?? d.triggerRange,
    range: partial?.range ?? d.range,
    arcDeg: partial?.arcDeg ?? d.arcDeg,
    windupMs: partial?.windupMs ?? d.windupMs,
    activeMs: partial?.activeMs ?? d.activeMs,
    recoveryMs: partial?.recoveryMs ?? d.recoveryMs,
    cooldownMs: partial?.cooldownMs ?? d.cooldownMs,
    engageBodySlackPx: partial?.engageBodySlackPx ?? d.engageBodySlackPx,
    ...(partial?.meleeChaseStandoffWu !== undefined
      ? { meleeChaseStandoffWu: partial.meleeChaseStandoffWu }
      : {}),
  };
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

function mergeWall(partial?: EnemyCombatPartial["wall"]): EnemyWallCombat {
  const d = getEnemyCombatDefaults().wall;
  return {
    damage: partial?.damage ?? d.damage,
    triggerRange: partial?.triggerRange ?? d.triggerRange,
    hitRange: partial?.hitRange ?? d.hitRange,
  };
}

function mergeArrowRain(
  partial?: EnemyCombatPartial["arrowRain"],
): EnemyArrowRainCombat {
  const d = getEnemyCombatDefaults().arrowRain;
  return {
    damage: partial?.damage ?? d.damage,
    preferredRange: partial?.preferredRange ?? d.preferredRange,
    attackTriggerRange:
      partial?.attackTriggerRange ?? d.attackTriggerRange,
    windupMs: partial?.windupMs ?? d.windupMs,
    activeMs: partial?.activeMs ?? d.activeMs,
    recoveryMs: partial?.recoveryMs ?? d.recoveryMs,
    cooldownMs: partial?.cooldownMs ?? d.cooldownMs,
    zoneRadius: partial?.zoneRadius ?? d.zoneRadius,
    tickIntervalMs: partial?.tickIntervalMs ?? d.tickIntervalMs,
    tickDamageScale: partial?.tickDamageScale ?? d.tickDamageScale,
    maxTicks: partial?.maxTicks ?? d.maxTicks,
  };
}

function mergeJavelineer(
  partial?: EnemyCombatPartial["javelineer"],
): EnemyJavelineerCombat {
  const d = getEnemyCombatDefaults().javelineer;
  return {
    damage: partial?.damage ?? d.damage,
    minRange: partial?.minRange ?? d.minRange,
    maxRange: partial?.maxRange ?? d.maxRange,
    strafeSpeedMul: partial?.strafeSpeedMul ?? d.strafeSpeedMul,
    orbitFlipMs: partial?.orbitFlipMs ?? d.orbitFlipMs,
    windupMs: partial?.windupMs ?? d.windupMs,
    activeMs: partial?.activeMs ?? d.activeMs,
    recoveryMs: partial?.recoveryMs ?? d.recoveryMs,
    cooldownMs: partial?.cooldownMs ?? d.cooldownMs,
    projectileSpeed: partial?.projectileSpeed ?? d.projectileSpeed,
    projectileMaxTravel:
      partial?.projectileMaxTravel ?? d.projectileMaxTravel,
  };
}

function mergeStationaryRanged(
  partial?: EnemyCombatPartial["stationaryRanged"],
): EnemyStationaryRangedCombat {
  const d = getEnemyCombatDefaults().stationaryRanged;
  return {
    damage: partial?.damage ?? d.damage,
    preferredRange: partial?.preferredRange ?? d.preferredRange,
    attackTriggerRange:
      partial?.attackTriggerRange ?? d.attackTriggerRange,
    windupMs: partial?.windupMs ?? d.windupMs,
    activeMs: partial?.activeMs ?? d.activeMs,
    recoveryMs: partial?.recoveryMs ?? d.recoveryMs,
    cooldownMs: partial?.cooldownMs ?? d.cooldownMs,
    projectileSpeed: partial?.projectileSpeed ?? d.projectileSpeed,
    projectileMaxTravel:
      partial?.projectileMaxTravel ?? d.projectileMaxTravel,
  };
}

function mergeWallSiege(
  partial?: EnemyCombatPartial["wallSiege"],
): EnemyWallSiegeCombat {
  const d = getEnemyCombatDefaults().wallSiege;
  return {
    playerAggroRadius:
      partial?.playerAggroRadius ?? d.playerAggroRadius,
  };
}

function mergeCharger(
  partial?: EnemyCombatPartial["charger"],
): EnemyChargerCombat {
  const d = getEnemyCombatDefaults().charger;
  return {
    chargeDamage: partial?.chargeDamage ?? d.chargeDamage,
    dashMinRange: partial?.dashMinRange ?? d.dashMinRange,
    dashTriggerRange: partial?.dashTriggerRange ?? d.dashTriggerRange,
    dashWindupMs: partial?.dashWindupMs ?? d.dashWindupMs,
    dashDurationMs: partial?.dashDurationMs ?? d.dashDurationMs,
    dashSpeedMul: partial?.dashSpeedMul ?? d.dashSpeedMul,
    dashCooldownMs: partial?.dashCooldownMs ?? d.dashCooldownMs,
    dashOvershootRange:
      partial?.dashOvershootRange ?? d.dashOvershootRange,
  };
}

function mergeLobber(
  partial?: EnemyCombatPartial["lobber"],
): EnemyLobberCombat {
  const d = getEnemyCombatDefaults().lobber;
  return {
    damage: partial?.damage ?? d.damage,
    preferredRange: partial?.preferredRange ?? d.preferredRange,
    attackTriggerRange:
      partial?.attackTriggerRange ?? d.attackTriggerRange,
    windupMs: partial?.windupMs ?? d.windupMs,
    activeMs: partial?.activeMs ?? d.activeMs,
    recoveryMs: partial?.recoveryMs ?? d.recoveryMs,
    cooldownMs: partial?.cooldownMs ?? d.cooldownMs,
    projectileSpeed: partial?.projectileSpeed ?? d.projectileSpeed,
    blastRadius: partial?.blastRadius ?? d.blastRadius,
    blastDamageScale: partial?.blastDamageScale ?? d.blastDamageScale,
  };
}

function mergeWard(
  partial?: EnemyCombatPartial["ward"],
): EnemyWardCombat {
  const d = getEnemyCombatDefaults().ward;
  return {
    protectRadius: partial?.protectRadius ?? d.protectRadius,
    screenOffsetWu: partial?.screenOffsetWu ?? d.screenOffsetWu,
    playerAggroRadius:
      partial?.playerAggroRadius ?? d.playerAggroRadius,
  };
}

function mergeHybrid(
  partial?: EnemyCombatPartial["hybrid"],
): EnemyHybridCombat {
  const d = getEnemyCombatDefaults().hybrid;
  return {
    closeMeleeRadius: partial?.closeMeleeRadius ?? d.closeMeleeRadius,
    preferredRange: partial?.preferredRange ?? d.preferredRange,
    maxMeleeSwings: partial?.maxMeleeSwings ?? d.maxMeleeSwings,
    retreatRangeSlack: partial?.retreatRangeSlack ?? d.retreatRangeSlack,
  };
}

/** Merge optional per-enemy `combat` partials onto Boot-loaded `enemy-combat-defaults.json` (not any enemy row). */
export function resolveEnemyCombat(
  behavior: string,
  combat?: EnemyCombatPartial,
  defId?: string,
): ResolvedEnemyCombat {
  const resolved: ResolvedEnemyCombat = {
    wall: mergeWall(combat?.wall),
    melee: clampMeleeEngageForPhysics(
      mergeMelee(combat?.melee),
      behavior,
      defId,
    ),
  };
  if (behavior === "arrowRainArcher") {
    resolved.arrowRain = mergeArrowRain(combat?.arrowRain);
  }
  if (behavior === "javelineer") {
    resolved.javelineer = mergeJavelineer(combat?.javelineer);
  }
  if (behavior === "stationaryRanged") {
    resolved.stationaryRanged = mergeStationaryRanged(
      combat?.stationaryRanged,
    );
  }
  if (behavior === "wallSiege") {
    resolved.wallSiege = mergeWallSiege(combat?.wallSiege);
  }
  if (behavior === "charger") {
    resolved.charger = mergeCharger(combat?.charger);
  }
  if (behavior === "lobber") {
    resolved.lobber = mergeLobber(combat?.lobber);
  }
  if (behavior === "ward") {
    resolved.ward = mergeWard(combat?.ward);
  }
  if (behavior === "rangedHybrid") {
    resolved.stationaryRanged = mergeStationaryRanged(
      combat?.stationaryRanged,
    );
    resolved.hybrid = mergeHybrid(combat?.hybrid);
  }
  return resolved;
}