export type ShadowformMechanics = {
  moveSpeedMult: number;
  damageTakenMult: number;
  aggroRadiusMult: number;
};

function unsetShadowform(): ShadowformMechanics {
  return new Proxy({} as ShadowformMechanics, {
    get() {
      throw new Error(
        "SHADOWFORM_MECHANICS not loaded — Boot must apply shadowform fields from spells.json",
      );
    },
  });
}

export let SHADOWFORM_MECHANICS: ShadowformMechanics = unsetShadowform();

export function applyShadowformMechanics(mechanics: ShadowformMechanics): void {
  SHADOWFORM_MECHANICS = mechanics;
}
