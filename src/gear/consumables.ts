import bundledConsumables from "../../public/data/consumables.json";
import type { SpellDefinition } from "../content/spells";
import { normalizeConsumables } from "../core/normalizeConsumables";
import type { SaveGame } from "../core/saveTypes";

import type {
  ConsumableDef,
  ConsumableKind,
  ConsumablesConfig,
} from "./consumableTypes";

let active: ConsumablesConfig | null = null;

export function setConsumablesConfig(config: ConsumablesConfig): void {
  active = config;
}

/** Active consumables; falls back to the bundled `consumables.json` before Boot. */
export function getConsumablesConfig(): ConsumablesConfig {
  if (!active) active = normalizeConsumables(bundledConsumables);
  return active;
}

export function consumableCount(save: SaveGame, id: string): number {
  return save.consumables[id] ?? 0;
}

/** Add `qty` (clamped to `maxStack`); returns how many actually fit. */
export function addConsumable(
  save: SaveGame,
  id: string,
  qty: number,
  config: ConsumablesConfig = getConsumablesConfig(),
): { save: SaveGame; added: number } {
  const def = config.items[id];
  if (!def) return { save, added: 0 };
  const have = consumableCount(save, id);
  const added = Math.max(0, Math.min(qty, def.maxStack - have));
  if (added === 0) return { save, added };
  return {
    save: { ...save, consumables: { ...save.consumables, [id]: have + added } },
    added,
  };
}

/** Spend one charge; null when none are left. */
export function spendConsumable(save: SaveGame, id: string): SaveGame | null {
  const have = consumableCount(save, id);
  if (have <= 0) return null;
  const consumables = { ...save.consumables };
  if (have === 1) delete consumables[id];
  else consumables[id] = have - 1;
  return { ...save, consumables };
}

/** First owned consumable of `kind`, in `consumables.json` order (what the HUD button uses). */
export function quickConsumable(
  save: SaveGame,
  kind: ConsumableKind,
  config: ConsumablesConfig = getConsumablesConfig(),
): ConsumableDef | null {
  for (const def of Object.values(config.items)) {
    if (def.kind === kind && consumableCount(save, def.id) > 0) return def;
  }
  return null;
}

/** Total charges of a kind (HUD badge). */
export function consumableKindCount(
  save: SaveGame,
  kind: ConsumableKind,
  config: ConsumablesConfig = getConsumablesConfig(),
): number {
  let n = 0;
  for (const def of Object.values(config.items)) {
    if (def.kind === kind) n += consumableCount(save, def.id);
  }
  return n;
}

/** Spell-shaped blast def so bombs reuse spell blast damage, knockback and on-hit status. */
export function bombBlastSpellDef(def: ConsumableDef): SpellDefinition | null {
  const b = def.bomb;
  if (!b) return null;
  const onHit: NonNullable<SpellDefinition["onHit"]> = {};
  if (b.dotDps !== undefined) onHit.dotDps = b.dotDps;
  if (b.dotMs !== undefined) onHit.dotMs = b.dotMs;
  if (b.slowPct !== undefined) onHit.slowPct = b.slowPct;
  if (b.slowMs !== undefined) onHit.slowMs = b.slowMs;
  if (b.stunMs !== undefined) onHit.stunMs = b.stunMs;
  return {
    id: `consumable_${def.id}`,
    name: def.name,
    shortLabel: def.name,
    mechanicType: "blast",
    castableInDefense: false,
    implementationPhase: 0,
    cooldownMs: def.cooldownMs,
    channelMs: 0,
    baseDamage: b.damage,
    blastRadiusWu: b.radiusWu,
    blastKnockbackWu: b.knockbackWu,
    damageFlavor: b.flavor,
    onHit,
    iconFile: "",
  };
}

/** Short description line for shop / bag lists. */
export function consumableEffectLine(def: ConsumableDef): string {
  if (def.kind === "heal") return `Heals ${def.healHp ?? 0} HP`;
  const b = def.bomb;
  if (!b) return "Bomb";
  const extras: string[] = [];
  if (b.dotDps) extras.push(`burn ${b.dotDps}/s`);
  if (b.slowPct) extras.push(`slow ${b.slowPct}%`);
  if (b.stunMs) extras.push(`stun ${Math.round(b.stunMs / 100) / 10}s`);
  return [`${b.damage} ${b.flavor} damage in an area`, ...extras].join(", ");
}
