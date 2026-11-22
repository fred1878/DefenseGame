import type { ShadowformMechanics } from "../core/normalizeSpellMechanics";

function unsetShadowform(): ShadowformMechanics {
  return new Proxy({} as ShadowformMechanics, {
    get() {
      throw new Error(
        "SHADOWFORM_MECHANICS not loaded — Boot must apply public/data/spell-mechanics.json",
      );
    },
  });
}

export let SHADOWFORM_MECHANICS: ShadowformMechanics = unsetShadowform();

export function applyShadowformMechanics(mechanics: ShadowformMechanics): void {
  SHADOWFORM_MECHANICS = mechanics;
}