import Phaser from "phaser";
import { COMBAT_AUDIO } from "../config/audio";
import type { SpellDefinition } from "../content/spells";

export const FIRE_WHOOSH_SFX_KEY = "sfx_fire_whoosh_01";

/** Fire impact / release spells that resolve through {@link resolveSpellEffect}. */
export function spellPlaysFireWhooshOnResolve(def: SpellDefinition): boolean {
  return def.damageFlavor === "fire" && def.mechanicType !== "channeled_area";
}

/** Ground channeled fire (e.g. flamestrike) opening burst when the channel zone starts. */
export function spellPlaysFireWhooshOnChanneledAreaStart(def: SpellDefinition): boolean {
  return def.damageFlavor === "fire" && def.mechanicType === "channeled_area";
}

/** Linger / post-impact ground fire (e.g. flamestrike afterburn). */
export function spellPlaysFireWhooshOnChannelLinger(def: SpellDefinition): boolean {
  return def.damageFlavor === "fire" && (def.lingerMs ?? 0) > 0;
}

export function playFireWhooshSfx(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists(FIRE_WHOOSH_SFX_KEY)) return;
  scene.sound.play(FIRE_WHOOSH_SFX_KEY, { volume: COMBAT_AUDIO.fireWhooshVolume });
}