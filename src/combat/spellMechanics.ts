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

export function blinkDestination(
  fromX: number,
  fromY: number,
  facingRad: number,
  distance: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): { x: number; y: number } {
  const rawX = fromX + Math.cos(facingRad) * distance;
  const rawY = fromY + Math.sin(facingRad) * distance;
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, rawX)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, rawY)),
  };
}

export const SPELL_SWING_RANGE_WU = 72;
export const SPELL_SWING_ARC_DEG = 110;
export const SPELL_CONE_RANGE_WU = 120;
export const SPELL_CONE_ARC_DEG = 72;
export const CHAIN_LIGHTNING_HOPS = 4;
export const CHAIN_LIGHTNING_HOP_RANGE_WU = 110;
export const BLINK_DISTANCE_WU = 96;
export const ICE_WALL_DISTANCE_WU = 64;
export const ICE_WALL_DURATION_MS = 8000;
export const SHADOWFORM_DURATION_MS = 10000;
export const SHADOWFORM_DAMAGE_MULT = 1.35;
export const FROST_ROOT_MS = 2200;
export const DEEP_FREEZE_ROOT_MS = 2800;

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