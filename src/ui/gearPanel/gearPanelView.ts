/**
 * Pure view models shared by the Blacksmith / Trader and Inventory panels:
 * card and tile text, item detail lines and the compare block. Every value
 * comes from the live catalog, save and config (the Figma numbers were
 * placeholders).
 */
import { basePlayerTuning } from "../../config/player";
import type { SaveGame } from "../../core/saveTypes";
import {
  consumableCount,
  consumableEffectLine,
  type ConsumableDef,
} from "../../gear/consumables";
import { compareGear, type CompareRow } from "../../gear/gearCompare";
import { itemTypeLabel, modifierLabel, procLabel } from "../../gear/gearText";
import {
  addItem,
  equipItem,
  equippedSlotOf,
  targetSlotFor,
  unequipSlot,
} from "../../gear/inventory";
import {
  affixContribution,
  armourReduction,
  effectivePlayerTuning,
  gearStatsFor,
  resolveItem,
  type ResolvedItem,
} from "../../gear/itemStats";
import type {
  EquipSlot,
  GearCatalog,
  ItemType,
  OnHitProc,
  SaveGear,
  StatBonus,
  StatModifier,
} from "../../gear/gearTypes";
import {
  iconForConsumable,
  iconForItemType,
  type UiIconName,
} from "../icons/uiIcons";
import { DG_THEME } from "../theme/dgTheme";

/** Name colour for potions / bombs (no rarity). */
export const CONSUMABLE_COLOR = "#FDE68A";

const TYPE_SHORT: Record<ItemType, string> = {
  meleeWeapon: "Melee",
  rangedWeapon: "Ranged",
  helm: "Helm",
  chest: "Chest",
  hands: "Gloves",
  legs: "Legs",
  boots: "Boots",
  ring: "Ring",
  trinket: "Trinket",
};

export function itemTypeShort(type: ItemType): string {
  return TYPE_SHORT[type];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const secs = (ms: number) => `${round1(ms / 1000)}s`;

/** Headline stat for a card: weapon damage + timing, else the first stats. */
export function itemKeyStat(r: ResolvedItem): string {
  const m = r.base.melee;
  if (m) {
    return `${m.damage} dmg · ${secs(m.windupMs + m.activeMs + m.recoveryMs)} swing`;
  }
  const g = r.base.ranged;
  if (g) return `${g.damage} dmg · ${g.rangeWu} range`;
  const parts = [
    ...r.modifiers.map(modifierLabel),
    ...r.procs.map(procLabel),
  ].slice(0, 2);
  return parts.length ? parts.join(" · ") : "No bonuses";
}

export function consumableTypeLabel(def: ConsumableDef): string {
  return def.kind === "heal" ? "Potion" : "Bomb";
}

export type DetailLine = {
  icon: UiIconName;
  text: string;
  color: string;
  /** Affix name ("Fiery", "of Haste") or "" for base stats. */
  tag: string;
};

const FLAVOR_ICON: Record<string, UiIconName> = {
  fire: "flame",
  frost: "snowflake",
  lightning: "zap",
  water: "droplet",
  physical: "target",
};
const FLAVOR_COLOR: Record<string, string> = {
  fire: DG_THEME.schoolFire,
  frost: DG_THEME.schoolFrost,
  lightning: DG_THEME.rarityRare,
  water: DG_THEME.schoolFrost,
};
const STAT_ICON: Record<string, UiIconName> = {
  meleeDamage: "sword",
  rangedDamage: "bow",
  damagePct: "target",
  attackSpeedPct: "wind",
  maxHp: "heart",
  armour: "shield",
  moveSpeedPct: "boots",
  spellPowerPct: "sparkles",
  lifestealPct: "droplet",
  spellDamagePct: "sparkles",
  spellCooldownPct: "sparkles",
};

function modifierLine(m: StatModifier, tag: string): DetailLine {
  if (m.stat === "elementDamagePct") {
    return {
      icon: FLAVOR_ICON[m.element] ?? "star",
      text: modifierLabel(m),
      color: FLAVOR_COLOR[m.element] ?? DG_THEME.textPrimary,
      tag,
    };
  }
  const spell = m.stat === "spellDamagePct" || m.stat === "spellCooldownPct";
  return {
    icon: STAT_ICON[m.stat] ?? "star",
    text: modifierLabel(m),
    color: spell ? DG_THEME.schoolArcane : DG_THEME.textPrimary,
    tag,
  };
}

function procLine(p: OnHitProc, tag: string): DetailLine {
  const icon: UiIconName =
    p.kind === "dot"
      ? (FLAVOR_ICON[p.flavor] ?? "flame")
      : p.kind === "slow"
        ? "snowflake"
        : "zap";
  const color =
    p.kind === "dot"
      ? (FLAVOR_COLOR[p.flavor] ?? DG_THEME.textPrimary)
      : DG_THEME.textPrimary;
  return { icon, text: procLabel(p), color, tag };
}

/** Stat / affix / proc lines for an item, tagged with the affix that gave them. */
export function itemDetailLines(
  catalog: GearCatalog,
  r: ResolvedItem,
): DetailLine[] {
  const base = r.base.modifiers.length + (r.unique?.modifiers.length ?? 0);
  const lines: DetailLine[] = r.modifiers
    .slice(0, base)
    .map((m) => modifierLine(m, ""));
  for (const p of r.unique?.procs ?? []) lines.push(procLine(p, ""));
  for (const rolled of r.item.affixes) {
    const def = catalog.affixes[rolled.id];
    if (!def) continue;
    const c = affixContribution(def, rolled);
    if (c.modifier) lines.push(modifierLine(c.modifier, def.label));
    if (c.proc) lines.push(procLine(c.proc, def.label));
  }
  return lines;
}

/** "Rare melee weapon · ilvl 5 · 21 dmg · 0.49s swing · 86 range" style subline. */
export function itemSubline(r: ResolvedItem): string {
  const head = `${r.rarity.label} ${itemTypeLabel(r.base.type).toLowerCase()} · item level ${r.item.itemLevel}`;
  const m = r.base.melee;
  if (m) {
    return `${head} · ${m.damage} dmg · ${secs(m.windupMs + m.activeMs + m.recoveryMs)} swing · reach ${m.rangeWu}`;
  }
  const g = r.base.ranged;
  if (g) {
    return `${head} · ${g.damage} dmg · ${secs(g.windupMs + g.activeMs + g.recoveryMs)} shot · range ${g.rangeWu}`;
  }
  return head;
}

/** Compare block: what the item replaces and the stat rows. */
export type CompareView = {
  title: string;
  /** Replaced item ("Padded Vest (Common)") or "Empty slot". */
  against: string;
  againstColor: string;
  rows: CompareRow[];
};

function replacedLabel(
  catalog: GearCatalog,
  gear: SaveGear,
  slot: EquipSlot | null,
): { against: string; againstColor: string } {
  const uid = slot ? gear.equipped[slot] : undefined;
  const item = gear.items.find((i) => i.uid === uid);
  const r = item ? resolveItem(catalog, item) : null;
  return r
    ? { against: `${r.name} (${r.rarity.label})`, againstColor: r.rarity.color }
    : { against: "Empty slot", againstColor: DG_THEME.textMuted };
}

/** Compare for equipping an owned item (or removing it, when it is equipped). */
export function ownedItemCompare(
  catalog: GearCatalog,
  gear: SaveGear,
  uid: number,
): CompareView {
  const slot = equippedSlotOf(gear, uid);
  if (slot) {
    return {
      title: "If unequipped",
      against: "Empty slot",
      againstColor: DG_THEME.textMuted,
      rows: compareGear(catalog, gear, unequipSlot(gear, slot)),
    };
  }
  const item = gear.items.find((i) => i.uid === uid);
  const target = item ? targetSlotFor(catalog, gear, item) : null;
  return {
    title: "Compared with equipped",
    ...replacedLabel(catalog, gear, target ?? null),
    rows: compareGear(catalog, gear, equipItem(catalog, gear, uid)),
  };
}

/** Compare for an item that is not owned yet (shop offer). */
export function draftItemCompare(
  catalog: GearCatalog,
  gear: SaveGear,
  r: ResolvedItem,
): CompareView {
  const { uid: _uid, ...rest } = r.item;
  const added = addItem(gear, rest);
  const target = targetSlotFor(catalog, added.gear, {
    ...rest,
    uid: added.uid,
  });
  return {
    title: "Compared with equipped",
    ...replacedLabel(catalog, gear, target ?? null),
    rows: compareGear(catalog, gear, equipItem(catalog, added.gear, added.uid)),
  };
}

/** Owned-consumable detail lines (no compare). */
export function consumableLines(
  save: SaveGame,
  def: ConsumableDef,
): DetailLine[] {
  const icon = iconForConsumable(def);
  return [
    {
      icon,
      text: consumableEffectLine(def),
      color: DG_THEME.textPrimary,
      tag: "",
    },
    {
      icon,
      text: `Carrying ${consumableCount(save, def.id)}/${def.maxStack}`,
      color: DG_THEME.textSecondary,
      tag: "",
    },
    {
      icon: "wind",
      text: `${secs(def.cooldownMs)} cooldown`,
      color: DG_THEME.textSecondary,
      tag: "",
    },
  ];
}

export function consumableSubline(def: ConsumableDef): string {
  return def.kind === "heal"
    ? "Potion · drink in combat (Q)"
    : "Bomb · throw in combat (E)";
}

/** Tile look for an item: icon, rarity border colour, item-level badge. */
export type TileView = {
  icon: UiIconName;
  color: string;
  badge: string;
};

export function itemTile(r: ResolvedItem): TileView {
  return {
    icon: iconForItemType(r.base.type),
    color: r.rarity.color,
    badge: String(r.item.itemLevel),
  };
}

export function consumableTile(def: ConsumableDef, count: number): TileView {
  return {
    icon: iconForConsumable(def),
    color: CONSUMABLE_COLOR,
    badge: count > 0 ? `×${count}` : "",
  };
}

export type StatRow = { label: string; value: string };

const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(round1(v))}%`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Total stats with the equipped gear plus any talent bonus (Inventory hero panel). */
export function totalStatRows(
  catalog: GearCatalog,
  gear: SaveGear,
  max = 8,
  bonus?: StatBonus,
): StatRow[] {
  const s = gearStatsFor(catalog, gear, bonus);
  const t = effectivePlayerTuning(basePlayerTuning(), s);
  const f = s.flat;
  const dr = round1(armourReduction(catalog, f.armour) * 100);
  const rows: StatRow[] = [
    { label: "Max HP", value: String(Math.round(t.maxHp)) },
    { label: "Armour", value: `${f.armour} · ${dr}% DR` },
    { label: "Melee damage", value: String(round1(t.meleeDamage)) },
    { label: "Ranged damage", value: String(round1(t.rangedDamage)) },
    { label: "Attack speed", value: signedPct(f.attackSpeedPct) },
  ];
  const extra: StatRow[] = [];
  for (const [el, v] of Object.entries(s.elementDamagePct)) {
    if (v)
      extra.push({ label: `${capitalize(el)} damage`, value: signedPct(v) });
  }
  if (f.moveSpeedPct) {
    extra.push({ label: "Move speed", value: signedPct(f.moveSpeedPct) });
  }
  if (f.spellPowerPct) {
    extra.push({ label: "Spell power", value: signedPct(f.spellPowerPct) });
  }
  if (f.lifestealPct) {
    extra.push({ label: "Lifesteal", value: `${round1(f.lifestealPct)}%` });
  }
  if (s.procs.length) {
    extra.push({ label: "On-hit effects", value: String(s.procs.length) });
  }
  return [...rows, ...extra].slice(0, max);
}
