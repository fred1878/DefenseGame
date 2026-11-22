/** Per-defense-tick multipliers while Shadowform (or future buffs) are active. */

let aggroRadiusMult = 1;
let damageTakenMult = 1;

export function setShadowformRuntimeMults(opts: {
  aggroRadiusMult: number;
  damageTakenMult: number;
}): void {
  aggroRadiusMult = opts.aggroRadiusMult;
  damageTakenMult = opts.damageTakenMult;
}

export function resetShadowformRuntimeMults(): void {
  aggroRadiusMult = 1;
  damageTakenMult = 1;
}

export function playerAggroRadiusWu(baseRadiusWu: number): number {
  return baseRadiusWu * aggroRadiusMult;
}

export function playerIncomingDamageMult(): number {
  return damageTakenMult;
}