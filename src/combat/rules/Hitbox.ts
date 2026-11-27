import Phaser from "phaser";

export type Team = "player" | "enemy" | "neutral";

export type CircleHitbox = {
  x: number;
  y: number;
  radius: number;
  team: Team;
  damage: number;
  ownerId?: string;
};

export function circlesOverlap(
  a: CircleHitbox,
  b: { x: number; y: number; radius: number },
): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy <= r * r;
}

export function arcHitboxHitsTarget(
  originX: number,
  originY: number,
  facingAngleRad: number,
  range: number,
  arcHalfRad: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
): boolean {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.hypot(dx, dy);
  if (dist > range + targetRadius) return false;
  const angleToTarget = Math.atan2(dy, dx);
  let delta = angleToTarget - facingAngleRad;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return (
    Math.abs(delta) <= arcHalfRad + Math.atan2(targetRadius, Math.max(dist, 1))
  );
}

/** Earliest intersection parameter t ∈ [0, 1] along segment (x0,y0)→(x1,y1) with a circle, or null. */
export function segmentFirstCircleHitT(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  radius: number,
): number | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-8) {
    return Phaser.Math.Distance.Between(x0, y0, cx, cy) <= radius ? 0 : null;
  }
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  const inv = 1 / (2 * a);
  const t1 = (-b - disc) * inv;
  const t2 = (-b + disc) * inv;
  const hits: number[] = [];
  if (t1 >= 0 && t1 <= 1) hits.push(t1);
  if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-6) hits.push(t2);
  if (hits.length === 0) return null;
  return Math.min(...hits);
}
