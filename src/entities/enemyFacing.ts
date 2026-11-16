import type { PlayerCardinal } from "../content/assets";
import { cardinalFromAngle, cardinalFromDelta } from "./playerFacing";

/** Ignore micro-slides so idle enemies do not flip cardinals every frame. */
export const ENEMY_FACING_VELOCITY_DEADZONE = 8;

export function cardinalFromVelocity(
  vx: number,
  vy: number,
  deadzone = ENEMY_FACING_VELOCITY_DEADZONE,
): PlayerCardinal | null {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  if (ax < deadzone && ay < deadzone) return null;
  const dx = ax < deadzone ? 0 : vx;
  const dy = ay < deadzone ? 0 : vy;
  return cardinalFromDelta(dx, dy);
}

export function resolveEnemyCardinal(
  vx: number,
  vy: number,
  aimAngleRad: number,
  last: PlayerCardinal,
  combatActive: boolean,
  deadzone = ENEMY_FACING_VELOCITY_DEADZONE,
): PlayerCardinal {
  const fromVel = cardinalFromVelocity(vx, vy, deadzone);
  if (fromVel) return fromVel;
  if (combatActive) return cardinalFromAngle(aimAngleRad);
  return last;
}