import type { ShadowformMechanics } from "../config/shadowformMechanics";

export function shadowformActive(endsAt: number, nowMs: number): boolean {
  return endsAt > nowMs;
}

/** Outgoing spell damage uses building mult only; Shadowform is defensive (no outgoing boost). */
export function shadowformMoveSpeedMultiplier(
  active: boolean,
  mechanics: ShadowformMechanics,
  statusMoveSpeedMult = 1,
): number {
  const shadowMul = active ? mechanics.moveSpeedMult : 1;
  return shadowMul * statusMoveSpeedMult;
}

export function scalePlayerIncomingDamage(
  amount: number,
  active: boolean,
  mechanics: ShadowformMechanics,
): number {
  if (!active || amount <= 0) return amount;
  return amount * mechanics.damageTakenMult;
}

export function effectivePlayerAggroRadius(
  baseRadiusWu: number,
  active: boolean,
  mechanics: ShadowformMechanics,
): number {
  if (!active) return baseRadiusWu;
  return baseRadiusWu * mechanics.aggroRadiusMult;
}

export function shadowformBuffRemainingMs(endsAt: number, nowMs: number): number {
  if (!shadowformActive(endsAt, nowMs)) return 0;
  return Math.max(0, endsAt - nowMs);
}