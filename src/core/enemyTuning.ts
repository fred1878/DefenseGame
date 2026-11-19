import {
  ENTITY_BODY_RADIUS,
  enemyCollisionBodyRadius,
} from "../entities/entityPhysics";
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
    engageBodySlackPx?: number;
    arcDeg?: number;
    windupMs?: number;
    activeMs?: number;
    recoveryMs?: number;
    cooldownMs?: number;
  };
  /** Floor AoE (`arrowRainArcher` behavior). */
  arrowRain?: {
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
    dashTriggerRange?: number;
    dashWindupMs?: number;
    dashDurationMs?: number;
    dashSpeedMul?: number;
    dashCooldownMs?: number;
  };
  /** Arcing ground blast (`lobber` behavior). */
  lobber?: {
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
    screenBlend?: number;
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
  /** Defaults bundle only — touch slack when deriving engage floors from physics. */
  engageBodySlackPx?: number;
};

export type EnemyArrowRainCombat = {
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
  dashTriggerRange: number;
  dashWindupMs: number;
  dashDurationMs: number;
  dashSpeedMul: number;
  dashCooldownMs: number;
};

export type EnemyLobberCombat = {
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
  screenBlend: number;
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

/** Default melee grunt row stats when JSON omits fields. */
export const DEFAULT_ENEMY_BASE = {
  hp: 30,
  speed: 60,
  damage: 8,
} as const;

export const DEFAULT_MELEE_ENGAGE_BODY_SLACK_PX = 0;

export const DEFAULT_MELEE_COMBAT: EnemyMeleeCombat = {
  triggerRange: 78,
  range: 52,
  arcDeg: 70,
  windupMs: 380,
  activeMs: 110,
  recoveryMs: 480,
  cooldownMs: 350,
  engageBodySlackPx: DEFAULT_MELEE_ENGAGE_BODY_SLACK_PX,
};

/** Arcade contact center distance for a melee archetype vs the player hurtbox. */
export function enemyMeleeContactCenterDist(
  behavior: string,
  defId?: string,
): number {
  return (
    ENTITY_BODY_RADIUS.player + enemyCollisionBodyRadius(behavior, defId)
  );
}

/** Raise authored melee reach so windups can start at collision contact and arcs connect. */
export function clampMeleeEngageForPhysics(
  melee: EnemyMeleeCombat,
  behavior: string,
  defId?: string,
): EnemyMeleeCombat {
  const slack =
    getEnemyCombatDefaults().melee.engageBodySlackPx ??
    DEFAULT_MELEE_ENGAGE_BODY_SLACK_PX;
  const contact = enemyMeleeContactCenterDist(behavior, defId);
  const triggerMin = Math.max(0, contact - slack);
  const rangeMin = enemyCollisionBodyRadius(behavior, defId);
  const { engageBodySlackPx: _omit, ...combat } = melee;
  return {
    ...combat,
    triggerRange: Math.max(melee.triggerRange, triggerMin),
    range: Math.max(melee.range, rangeMin),
  };
}

export const DEFAULT_WALL_COMBAT: EnemyWallCombat = {
  damage: 6,
  triggerRange: 42,
  hitRange: 34,
};

/** Standoff south of {@link northWallAttackY} for path goals and melee holds — inside hit range. */
export function wallMeleeApproachStandoffPx(
  wall: Pick<EnemyWallCombat, "hitRange" | "triggerRange">,
  slackPx = 2,
): number {
  const fromHit = Math.max(0, wall.hitRange - slackPx);
  const fromTrigger = Math.max(0, wall.triggerRange - 6);
  return Math.min(fromHit, fromTrigger);
}

export const DEFAULT_ARROW_RAIN_COMBAT: EnemyArrowRainCombat = {
  preferredRange: 150,
  attackTriggerRange: 168,
  windupMs: 900,
  activeMs: 1200,
  recoveryMs: 520,
  cooldownMs: 2200,
  zoneRadius: 72,
  tickIntervalMs: 300,
  tickDamageScale: 0.55,
  maxTicks: 4,
};

export const DEFAULT_JAVELINEER_COMBAT: EnemyJavelineerCombat = {
  minRange: 52,
  maxRange: 198,
  strafeSpeedMul: 0.92,
  orbitFlipMs: 1400,
  windupMs: 340,
  activeMs: 120,
  recoveryMs: 420,
  cooldownMs: 1100,
  projectileSpeed: 340,
  projectileMaxTravel: 240,
};

export const DEFAULT_STATIONARY_RANGED_COMBAT: EnemyStationaryRangedCombat = {
  attackTriggerRange: 155,
  windupMs: 520,
  activeMs: 80,
  recoveryMs: 480,
  cooldownMs: 1400,
  projectileSpeed: 380,
  projectileMaxTravel: 220,
};

export const DEFAULT_WALL_SIEGE_COMBAT: EnemyWallSiegeCombat = {
  playerAggroRadius: 72,
};

export const DEFAULT_CHARGER_COMBAT: EnemyChargerCombat = {
  dashTriggerRange: 148,
  dashWindupMs: 320,
  dashDurationMs: 420,
  dashSpeedMul: 2.35,
  dashCooldownMs: 2800,
};

export const DEFAULT_LOBBER_COMBAT: EnemyLobberCombat = {
  preferredRange: 128,
  attackTriggerRange: 168,
  windupMs: 680,
  activeMs: 100,
  recoveryMs: 520,
  cooldownMs: 2400,
  projectileSpeed: 260,
  blastRadius: 58,
  blastDamageScale: 0.85,
};

export const DEFAULT_WARD_COMBAT: EnemyWardCombat = {
  protectRadius: 220,
  screenBlend: 0.42,
  playerAggroRadius: 120,
};

export const DEFAULT_HYBRID_COMBAT: EnemyHybridCombat = {
  closeMeleeRadius: 78,
  preferredRange: 118,
  maxMeleeSwings: 3,
  retreatRangeSlack: 16,
};

/** In-code fallback bundle (matches shipped `enemy-combat-defaults.json`). */
export const CODE_ENEMY_COMBAT_DEFAULTS: EnemyCombatDefaultsBundle = {
  wall: DEFAULT_WALL_COMBAT,
  melee: DEFAULT_MELEE_COMBAT,
  arrowRain: DEFAULT_ARROW_RAIN_COMBAT,
  javelineer: DEFAULT_JAVELINEER_COMBAT,
  stationaryRanged: DEFAULT_STATIONARY_RANGED_COMBAT,
  wallSiege: DEFAULT_WALL_SIEGE_COMBAT,
  charger: DEFAULT_CHARGER_COMBAT,
  lobber: DEFAULT_LOBBER_COMBAT,
  ward: DEFAULT_WARD_COMBAT,
  hybrid: DEFAULT_HYBRID_COMBAT,
};

let activeEnemyCombatDefaults: EnemyCombatDefaultsBundle = {
  ...CODE_ENEMY_COMBAT_DEFAULTS,
};

export function getEnemyCombatDefaults(): EnemyCombatDefaultsBundle {
  return activeEnemyCombatDefaults;
}

export function applyEnemyCombatDefaults(raw: EnemyCombatDefaultsInput): void {
  activeEnemyCombatDefaults = normalizeEnemyCombatDefaults(
    CODE_ENEMY_COMBAT_DEFAULTS,
    raw,
  );
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
  };
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
    dashTriggerRange: partial?.dashTriggerRange ?? d.dashTriggerRange,
    dashWindupMs: partial?.dashWindupMs ?? d.dashWindupMs,
    dashDurationMs: partial?.dashDurationMs ?? d.dashDurationMs,
    dashSpeedMul: partial?.dashSpeedMul ?? d.dashSpeedMul,
    dashCooldownMs: partial?.dashCooldownMs ?? d.dashCooldownMs,
  };
}

function mergeLobber(
  partial?: EnemyCombatPartial["lobber"],
): EnemyLobberCombat {
  const d = getEnemyCombatDefaults().lobber;
  return {
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
    screenBlend: partial?.screenBlend ?? d.screenBlend,
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