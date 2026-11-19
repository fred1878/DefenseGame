import Phaser from "phaser";
import { arcHitboxHitsTarget } from "./Hitbox";

export type EnemyHitTarget = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

/** Enemies whose center is within `radius + target.radius`. */
export function enemiesInDisk(
  originX: number,
  originY: number,
  radius: number,
  enemies: readonly EnemyHitTarget[],
): EnemyHitTarget[] {
  const out: EnemyHitTarget[] = [];
  for (const e of enemies) {
    const d = Phaser.Math.Distance.Between(originX, originY, e.x, e.y);
    if (d <= radius + e.radius) out.push(e);
  }
  return out;
}

export function enemiesInCone(
  originX: number,
  originY: number,
  facingRad: number,
  range: number,
  halfArcRad: number,
  enemies: readonly EnemyHitTarget[],
): EnemyHitTarget[] {
  return enemies.filter((e) =>
    arcHitboxHitsTarget(
      originX,
      originY,
      facingRad,
      range,
      halfArcRad,
      e.x,
      e.y,
      e.radius,
    ),
  );
}

export function enemiesInSwingArc(
  originX: number,
  originY: number,
  facingRad: number,
  range: number,
  arcHalfDeg: number,
  enemies: readonly EnemyHitTarget[],
): EnemyHitTarget[] {
  const half = Phaser.Math.DegToRad(arcHalfDeg / 2);
  return enemiesInCone(originX, originY, facingRad, range, half, enemies);
}

export function nearestEnemy(
  originX: number,
  originY: number,
  enemies: readonly EnemyHitTarget[],
  maxRange?: number,
): EnemyHitTarget | null {
  let best: EnemyHitTarget | null = null;
  let bestD = Infinity;
  for (const e of enemies) {
    const d = Phaser.Math.Distance.Between(originX, originY, e.x, e.y);
    if (maxRange !== undefined && d > maxRange) continue;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Greedy chain: each hop picks closest unvisited enemy within `hopRange`. */
export function pickChainLightningTargets(
  originX: number,
  originY: number,
  enemies: readonly EnemyHitTarget[],
  hopCount: number,
  hopRange: number,
): EnemyHitTarget[] {
  const picked: EnemyHitTarget[] = [];
  const used = new Set<string>();
  let fromX = originX;
  let fromY = originY;
  for (let hop = 0; hop < hopCount; hop++) {
    let best: EnemyHitTarget | null = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (used.has(e.id)) continue;
      const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y);
      if (d > hopRange) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) break;
    used.add(best.id);
    picked.push(best);
    fromX = best.x;
    fromY = best.y;
  }
  return picked;
}

export type BlinkPlayBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type BlinkObstacleAabb = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function blinkDestination(
  fromX: number,
  fromY: number,
  facingRad: number,
  distance: number,
  bounds: BlinkPlayBounds,
): { x: number; y: number } {
  const rawX = fromX + Math.cos(facingRad) * distance;
  const rawY = fromY + Math.sin(facingRad) * distance;
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, rawX)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, rawY)),
  };
}

function clampToBlinkBounds(
  x: number,
  y: number,
  bounds: BlinkPlayBounds,
): { x: number; y: number } {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  };
}

/** Circle vs axis-aligned rect — true when the circle overlaps the rect. */
export function circleOverlapsObstacleAabb(
  cx: number,
  cy: number,
  radius: number,
  rect: BlinkObstacleAabb,
): boolean {
  const closestX = Math.max(rect.left, Math.min(cx, rect.right));
  const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));
  return Math.hypot(cx - closestX, cy - closestY) < radius;
}

export function isBlinkLandingBlocked(
  cx: number,
  cy: number,
  playerRadius: number,
  obstacles: readonly BlinkObstacleAabb[],
  enemies: readonly EnemyHitTarget[],
): boolean {
  for (const rect of obstacles) {
    if (circleOverlapsObstacleAabb(cx, cy, playerRadius, rect)) return true;
  }
  for (const e of enemies) {
    const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
    if (d < playerRadius + e.radius) return true;
  }
  return false;
}

/**
 * Full blink along `facingRad`, then slide back toward the origin until the
 * landing is in bounds and clear of obstacles and enemies (partial blink).
 */
export function resolveBlinkLanding(
  fromX: number,
  fromY: number,
  facingRad: number,
  distance: number,
  bounds: BlinkPlayBounds,
  playerRadius: number,
  obstacles: readonly BlinkObstacleAabb[],
  enemies: readonly EnemyHitTarget[],
): { x: number; y: number; moved: boolean } {
  const ideal = blinkDestination(fromX, fromY, facingRad, distance, bounds);
  const landingOk = (x: number, y: number) =>
    !isBlinkLandingBlocked(x, y, playerRadius, obstacles, enemies);

  if (landingOk(ideal.x, ideal.y)) {
    const moved = ideal.x !== fromX || ideal.y !== fromY;
    return { x: ideal.x, y: ideal.y, moved };
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rawX = fromX + (ideal.x - fromX) * mid;
    const rawY = fromY + (ideal.y - fromY) * mid;
    const { x, y } = clampToBlinkBounds(rawX, rawY, bounds);
    if (landingOk(x, y)) lo = mid;
    else hi = mid;
  }

  const rawX = fromX + (ideal.x - fromX) * lo;
  const rawY = fromY + (ideal.y - fromY) * lo;
  const { x, y } = clampToBlinkBounds(rawX, rawY, bounds);
  const moved = Math.hypot(x - fromX, y - fromY) > 0.5;
  return { x, y, moved };
}

export type SpellMechanicsTuning = {
  swingRangeWu: number;
  swingArcDeg: number;
  coneRangeWu: number;
  coneArcDeg: number;
  chainLightningHops: number;
  chainLightningHopRangeWu: number;
  blinkDistanceWu: number;
  iceWallDistanceWu: number;
  iceWallDurationMs: number;
  shadowformDurationMs: number;
  shadowformDamageMult: number;
  frostRootMs: number;
  deepFreezeRootMs: number;
};

/** Code defaults when `public/data/spell-mechanics.json` is absent (also pre-Boot). */
export const SPELL_MECHANICS_DEFAULTS: SpellMechanicsTuning = {
  swingRangeWu: 72,
  swingArcDeg: 110,
  coneRangeWu: 120,
  coneArcDeg: 72,
  chainLightningHops: 4,
  chainLightningHopRangeWu: 110,
  blinkDistanceWu: 96,
  iceWallDistanceWu: 64,
  iceWallDurationMs: 8000,
  shadowformDurationMs: 10000,
  shadowformDamageMult: 1.35,
  frostRootMs: 7000,
  deepFreezeRootMs: 2800,
};

export let SPELL_SWING_RANGE_WU = SPELL_MECHANICS_DEFAULTS.swingRangeWu;
export let SPELL_SWING_ARC_DEG = SPELL_MECHANICS_DEFAULTS.swingArcDeg;
export let SPELL_CONE_RANGE_WU = SPELL_MECHANICS_DEFAULTS.coneRangeWu;
export let SPELL_CONE_ARC_DEG = SPELL_MECHANICS_DEFAULTS.coneArcDeg;
export let CHAIN_LIGHTNING_HOPS = SPELL_MECHANICS_DEFAULTS.chainLightningHops;
export let CHAIN_LIGHTNING_HOP_RANGE_WU =
  SPELL_MECHANICS_DEFAULTS.chainLightningHopRangeWu;
export let BLINK_DISTANCE_WU = SPELL_MECHANICS_DEFAULTS.blinkDistanceWu;
export let ICE_WALL_DISTANCE_WU = SPELL_MECHANICS_DEFAULTS.iceWallDistanceWu;
export let ICE_WALL_DURATION_MS = SPELL_MECHANICS_DEFAULTS.iceWallDurationMs;
export let SHADOWFORM_DURATION_MS =
  SPELL_MECHANICS_DEFAULTS.shadowformDurationMs;
export let SHADOWFORM_DAMAGE_MULT =
  SPELL_MECHANICS_DEFAULTS.shadowformDamageMult;
export let FROST_ROOT_MS = SPELL_MECHANICS_DEFAULTS.frostRootMs;
export let DEEP_FREEZE_ROOT_MS = SPELL_MECHANICS_DEFAULTS.deepFreezeRootMs;

export function applySpellMechanics(tuning: SpellMechanicsTuning): void {
  SPELL_SWING_RANGE_WU = tuning.swingRangeWu;
  SPELL_SWING_ARC_DEG = tuning.swingArcDeg;
  SPELL_CONE_RANGE_WU = tuning.coneRangeWu;
  SPELL_CONE_ARC_DEG = tuning.coneArcDeg;
  CHAIN_LIGHTNING_HOPS = tuning.chainLightningHops;
  CHAIN_LIGHTNING_HOP_RANGE_WU = tuning.chainLightningHopRangeWu;
  BLINK_DISTANCE_WU = tuning.blinkDistanceWu;
  ICE_WALL_DISTANCE_WU = tuning.iceWallDistanceWu;
  ICE_WALL_DURATION_MS = tuning.iceWallDurationMs;
  SHADOWFORM_DURATION_MS = tuning.shadowformDurationMs;
  SHADOWFORM_DAMAGE_MULT = tuning.shadowformDamageMult;
  FROST_ROOT_MS = tuning.frostRootMs;
  DEEP_FREEZE_ROOT_MS = tuning.deepFreezeRootMs;
}

export function clampGroundTarget(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxRange: number,
): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy);
  if (d <= maxRange || d < 0.001) return { x: toX, y: toY };
  const s = maxRange / d;
  return { x: fromX + dx * s, y: fromY + dy * s };
}