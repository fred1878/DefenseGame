export type Team = "player" | "enemy" | "neutral";

export type CircleHitbox = {
  x: number;
  y: number;
  radius: number;
  team: Team;
  damage: number;
  ownerId?: string;
};

export function circlesOverlap(a: CircleHitbox, b: { x: number; y: number; radius: number }): boolean {
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
  return Math.abs(delta) <= arcHalfRad + Math.atan2(targetRadius, Math.max(dist, 1));
}