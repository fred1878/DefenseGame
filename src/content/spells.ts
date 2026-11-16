import { SPELL_BAR } from "../config/spellBar";
import type { DamageFlavor } from "../combat/DamageSystem";
import type { SpellTargetMode } from "./spellTargeting";
import bundledSpells from "../../public/data/spells.json";

export type SpellId = string;
export type SpellCastKind = "instant" | "channeled";

export type SpellOnHitEffects = {
  slowPct?: number;
  slowMs?: number;
  dotDps?: number;
  dotMs?: number;
  rootMs?: number;
};

export type SpellMechanicType =
  | "projectile"
  | "projectile_aoe"
  | "tracking_projectile"
  | "swing"
  | "tracking_swing"
  | "cone"
  | "blast"
  | "channeled"
  | "channeled_area"
  | "ice_wall"
  | "buff"
  | "blink"
  | "instant_targeted"
  | "heal";

export type SpellDefinition = {
  id: SpellId;
  name: string;
  shortLabel: string;
  mechanicType: SpellMechanicType;
  castableInDefense: boolean;
  implementationPhase: number;
  cooldownMs: number;
  /** Windup before channel or instant resolution (MobileRPG startupDuration). */
  castMs?: number;
  channelMs: number;
  kind: SpellCastKind;
  channelTickMs?: number;
  targetMode?: SpellTargetMode;
  requireEnemyTarget?: boolean;
  centerOnCaster?: boolean;
  groundTargetMaxRangeWu?: number;
  burstDamage?: number;
  lingerMs?: number;
  lingerTickMs?: number;
  coneRangeWu?: number;
  onHit?: SpellOnHitEffects;
  baseDamage?: number;
  projectileSpeed?: number;
  blastRadius?: number;
  healAmount?: number;
  iconFile: string;
  projectileTextureKey?: string;
  projectileFile?: string;
  blastTextureKey?: string;
  blastFile?: string;
  damageFlavor?: DamageFlavor;
};

type SpellsJson = { spells: SpellDefinition[] };

let activeCatalog: SpellDefinition[] = normalizeCatalog(
  (bundledSpells as SpellsJson).spells,
);

function normalizeCatalog(rows: SpellDefinition[]): SpellDefinition[] {
  return rows.map((row) => ({
    ...row,
    kind: row.channelMs > 0 ? "channeled" : "instant",
  }));
}

export function setSpellCatalog(rows: readonly SpellDefinition[]): void {
  activeCatalog = normalizeCatalog([...rows]);
}

export function getSpellCatalog(): readonly SpellDefinition[] {
  return activeCatalog;
}

export function createDefaultSpellBarSlots(): SpellId[] {
  const castable = getSpellCatalog()
    .filter((s) => s.castableInDefense)
    .map((s) => s.id);
  const slots: SpellId[] = castable.slice(0, SPELL_BAR.slotCount);
  while (slots.length < SPELL_BAR.slotCount) slots.push("");
  return slots;
}

export { createDefaultAutoCastSpellIds as createDefaultSpellBarAutoCast } from "./spellBarAutoCast";

export function spellById(id: SpellId): SpellDefinition | undefined {
  if (!id) return undefined;
  return getSpellCatalog().find((s) => s.id === id);
}

export function spellIconPath(def: SpellDefinition): string {
  return `assets/spells/icons/${def.iconFile}`;
}