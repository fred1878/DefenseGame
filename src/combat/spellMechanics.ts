import Phaser from "phaser";
import { arcHitboxHitsTarget } from "./Hitbox";

export type EnemyHitTarget = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

export type BlinkLandingResolveTuning = {
  binarySearchIterations: number;
  partialMoveEpsilonPx: number;
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
  resolveTuning: BlinkLandingResolveTuning,
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
  for (let i = 0; i < resolveTuning.binarySearchIterations; i++) {
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
  const moved =
    Math.hypot(x - fromX, y - fromY) > resolveTuning.partialMoveEpsilonPx;
  return { x, y, moved };
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
