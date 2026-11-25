import {
  CAST_INTERRUPT_STICK_ANGLE_DEG,
  STICK_MOVING_MAGNITUDE_EPS,
} from "../config/spellInput";

function stickMagnitude(x: number, y: number): number {
  return Math.hypot(x, y);
}

function stickBearingDeg(x: number, y: number): number {
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function shortestAngleSeparationDeg(aDeg: number, bDeg: number): number {
  let d = bDeg - aDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}

/**
 * Whether current stick deflection should cancel an in-progress windup/channel.
 * Release (neutral stick) never interrupts; magnitude-only change on the same bearing does not.
 */
export function stickDeflectionInterruptsCast(
  stickX: number,
  stickY: number,
  baselineX: number,
  baselineY: number,
): boolean {
  const curMag = stickMagnitude(stickX, stickY);
  if (curMag <= STICK_MOVING_MAGNITUDE_EPS) {
    return false;
  }

  const baseMag = stickMagnitude(baselineX, baselineY);
  if (baseMag <= STICK_MOVING_MAGNITUDE_EPS) {
    return true;
  }

  return (
    shortestAngleSeparationDeg(
      stickBearingDeg(baselineX, baselineY),
      stickBearingDeg(stickX, stickY),
    ) > CAST_INTERRUPT_STICK_ANGLE_DEG
  );
}
