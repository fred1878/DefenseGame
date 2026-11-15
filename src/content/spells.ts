import { SPELL_BAR } from "../config/spellBar";
import type { DamageFlavor } from "../combat/DamageSystem";
import bundledSpells from "../../public/data/spells.json";

export type SpellId = string;
export type SpellCastKind = "instant" | "channeled";

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
  channelMs: number;
  kind: SpellCastKind;
  baseDamage?: number;
  projectileSpeed?: number;
  blastRadius?: number;
  healAmount?: number;
  iconFile: string;
  projectileTextureKey?: string;
  projectileFile?: string;
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

export function createDefaultSpellBarAutoCast(): boolean[] {
  return Array.from({ length: SPELL_BAR.slotCount }, () => false);
}

export function spellById(id: SpellId): SpellDefinition | undefined {
  if (!id) return undefined;
  return getSpellCatalog().find((s) => s.id === id);
}

export function spellIconPath(def: SpellDefinition): string {
  return `assets/spells/icons/${def.iconFile}`;
}