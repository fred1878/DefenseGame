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

export type ResolvedEnemyCombat = {
  wall: EnemyWallCombat;
  melee: EnemyMeleeCombat;
  arrowRain?: EnemyArrowRainCombat;
  javelineer?: EnemyJavelineerCombat;
  stationaryRanged?: EnemyStationaryRangedCombat;
};

/** Default melee grunt row stats when JSON omits fields. */
export const DEFAULT_ENEMY_BASE = {
  hp: 30,
  speed: 85,
  damage: 8,
} as const;

export const DEFAULT_MELEE_COMBAT: EnemyMeleeCombat = {
  triggerRange: 36,
  range: 26,
  arcDeg: 70,
  windupMs: 380,
  activeMs: 110,
  recoveryMs: 480,
  cooldownMs: 350,
};

export const DEFAULT_WALL_COMBAT: EnemyWallCombat = {
  damage: 6,
  triggerRange: 42,
  hitRange: 34,
};

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

function mergeMelee(partial?: EnemyCombatPartial["melee"]): EnemyMeleeCombat {
  return {
    triggerRange: partial?.triggerRange ?? DEFAULT_MELEE_COMBAT.triggerRange,
    range: partial?.range ?? DEFAULT_MELEE_COMBAT.range,
    arcDeg: partial?.arcDeg ?? DEFAULT_MELEE_COMBAT.arcDeg,
    windupMs: partial?.windupMs ?? DEFAULT_MELEE_COMBAT.windupMs,
    activeMs: partial?.activeMs ?? DEFAULT_MELEE_COMBAT.activeMs,
    recoveryMs: partial?.recoveryMs ?? DEFAULT_MELEE_COMBAT.recoveryMs,
    cooldownMs: partial?.cooldownMs ?? DEFAULT_MELEE_COMBAT.cooldownMs,
  };
}

function mergeWall(partial?: EnemyCombatPartial["wall"]): EnemyWallCombat {
  return {
    damage: partial?.damage ?? DEFAULT_WALL_COMBAT.damage,
    triggerRange: partial?.triggerRange ?? DEFAULT_WALL_COMBAT.triggerRange,
    hitRange: partial?.hitRange ?? DEFAULT_WALL_COMBAT.hitRange,
  };
}

function mergeArrowRain(
  partial?: EnemyCombatPartial["arrowRain"],
): EnemyArrowRainCombat {
  const d = DEFAULT_ARROW_RAIN_COMBAT;
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
  const d = DEFAULT_JAVELINEER_COMBAT;
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
  const d = DEFAULT_STATIONARY_RANGED_COMBAT;
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

export function resolveEnemyCombat(
  behavior: string,
  combat?: EnemyCombatPartial,
): ResolvedEnemyCombat {
  const resolved: ResolvedEnemyCombat = {
    wall: mergeWall(combat?.wall),
    melee: mergeMelee(combat?.melee),
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
  return resolved;
}