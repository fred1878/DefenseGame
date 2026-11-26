import { basePlayerTuning } from "../config/player";
import type { PlayerTuning } from "../config/player";
import { spellById } from "../content/spells";
import { equipItem } from "./inventory";
import type { ItemDraft } from "./itemGen";
import {
  armourReduction,
  effectivePlayerTuning,
  gearStatsFor,
  resolveItem,
  type GearStats,
  type ResolvedItem,
} from "./itemStats";
import type {
  EquipSlot,
  FlatStatId,
  GearCatalog,
  ItemType,
  OnHitProc,
  SaveGear,
  StatModifier,
} from "./gearTypes";

const STAT_LABELS: Record<FlatStatId, { label: string; pct: boolean }> = {
  meleeDamage: { label: "Melee damage", pct: false },
  rangedDamage: { label: "Ranged damage", pct: false },
  damagePct: { label: "Weapon damage", pct: true },
  attackSpeedPct: { label: "Attack speed", pct: true },
  maxHp: { label: "Max HP", pct: false },
  armour: { label: "Armour", pct: false },
  moveSpeedPct: { label: "Move speed", pct: true },
  spellPowerPct: { label: "Spell power", pct: true },
  lifestealPct: { label: "Lifesteal", pct: true },
};

const TYPE_LABELS: Record<ItemType, string> = {
  meleeWeapon: "Melee weapon",
  rangedWeapon: "Ranged weapon",
  helm: "Helm",
  chest: "Chest",
  hands: "Gloves",
  legs: "Legs",
  boots: "Boots",
  ring: "Ring",
  trinket: "Trinket",
};

export const SLOT_LABELS: Record<EquipSlot, string> = {
  meleeWeapon: "Melee",
  rangedWeapon: "Ranged",
  helm: "Helm",
  chest: "Chest",
  hands: "Gloves",
  legs: "Legs",
  boots: "Boots",
  ring1: "Ring",
  ring2: "Ring",
  trinket1: "Trinket",
  trinket2: "Trinket",
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Display name for a spell id (catalog name when loaded, else the id prettified). */
export function spellLabel(id: string): string {
  return (
    spellById(id)?.name ??
    id
      .split("_")
      .map((w) => capitalize(w))
      .join(" ")
  );
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(round1(v))}`;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function modifierLabel(m: StatModifier): string {
  if (m.stat === "elementDamagePct") {
    return `${signed(m.value)}% ${capitalize(m.element)} damage`;
  }
  if (m.stat === "spellDamagePct") {
    return `${signed(m.value)}% ${spellLabel(m.spell)} damage`;
  }
  if (m.stat === "spellCooldownPct") {
    return `${signed(-m.value)}% ${spellLabel(m.spell)} cooldown`;
  }
  const meta = STAT_LABELS[m.stat];
  return `${signed(m.value)}${meta.pct ? "%" : ""} ${meta.label}`;
}

const seconds = (ms: number) => `${round1(ms / 1000)}s`;

export function procLabel(p: OnHitProc): string {
  if (p.kind === "dot") {
    const verb = p.flavor === "fire" ? "Burn" : `${capitalize(p.flavor)} DoT`;
    return `${p.chancePct}% on hit: ${verb} ${round1(p.dps)}/s for ${seconds(p.ms)}`;
  }
  if (p.kind === "slow") {
    return `${p.chancePct}% on hit: Slow ${round1(p.slowPct)}% for ${seconds(p.ms)}`;
  }
  return `${p.chancePct}% on hit: Stun ${seconds(p.ms)}`;
}

/** Weapon profile summary (damage, timing, reach). */
export function weaponLine(r: ResolvedItem): string | null {
  const m = r.base.melee;
  if (m) {
    const swing = m.windupMs + m.activeMs + m.recoveryMs;
    return `${capitalize(m.style)} · ${m.damage} dmg · ${seconds(swing)} swing · reach ${m.rangeWu} · ${m.arcDeg}° arc`;
  }
  const g = r.base.ranged;
  if (g) {
    const shot = g.windupMs + g.activeMs + g.recoveryMs;
    return `${capitalize(g.style)} · ${g.damage} dmg · ${seconds(shot)} shot · range ${g.rangeWu}`;
  }
  return null;
}

export function itemTypeLabel(type: ItemType): string {
  return TYPE_LABELS[type];
}

/** Header + stat lines for the item detail box. */
export function itemDetailLines(r: ResolvedItem): string[] {
  const lines = [
    `${r.rarity.label} ${itemTypeLabel(r.base.type)} · item level ${r.item.itemLevel}`,
  ];
  const w = weaponLine(r);
  if (w) lines.push(w);
  for (const m of r.modifiers) lines.push(modifierLabel(m));
  for (const p of r.procs) lines.push(procLabel(p));
  if (r.unique?.note) lines.push(`“${r.unique.note}”`);
  return lines;
}

/** Short summary of current gear totals (Gear panel header). */
export function gearSummaryLines(
  catalog: GearCatalog,
  stats: GearStats,
  tuning: PlayerTuning,
): string[] {
  const f = stats.flat;
  const reduction = Math.round(armourReduction(catalog, f.armour) * 100);
  const lines = [
    `HP ${Math.round(tuning.maxHp)} · Armour ${f.armour} (−${reduction}% dmg) · Speed ${signed(f.moveSpeedPct)}%`,
    `Melee ${round1(tuning.meleeDamage)} · Ranged ${round1(tuning.rangedDamage)} · Atk speed ${signed(f.attackSpeedPct)}%`,
  ];
  const extras: string[] = [];
  if (f.spellPowerPct) extras.push(`Spell power ${signed(f.spellPowerPct)}%`);
  if (f.lifestealPct) extras.push(`Lifesteal ${round1(f.lifestealPct)}%`);
  if (stats.procs.length) extras.push(`${stats.procs.length} on-hit effects`);
  if (extras.length) lines.push(extras.join(" · "));
  return lines;
}

export type StatDiff = {
  label: string;
  delta: number;
  text: string;
  better: boolean;
};

type Measure = {
  label: string;
  value: (s: GearStats, t: PlayerTuning) => number;
  pct?: boolean;
  /** Lower is better (e.g. swing time). */
  lowerIsBetter?: boolean;
  format?: (d: number) => string;
  /** Smallest change worth listing (default 0.05). */
  epsilon?: number;
};

const MEASURES: Measure[] = [
  { label: "Melee damage", value: (_s, t) => t.meleeDamage },
  { label: "Ranged damage", value: (_s, t) => t.rangedDamage },
  {
    label: "Swing time",
    value: (_s, t) => t.meleeWindupMs + t.meleeActiveMs + t.meleeRecoveryMs,
    lowerIsBetter: true,
    epsilon: 50,
    format: (d) => `${d >= 0 ? "+" : "−"}${round2(Math.abs(d) / 1000)}s`,
  },
  {
    label: "Shot time",
    value: (_s, t) => t.rangedWindupMs + t.rangedActiveMs + t.rangedRecoveryMs,
    lowerIsBetter: true,
    epsilon: 50,
    format: (d) => `${d >= 0 ? "+" : "−"}${round2(Math.abs(d) / 1000)}s`,
  },
  { label: "Melee reach", value: (_s, t) => t.meleeStrikeRangeWu },
  { label: "Ranged range", value: (_s, t) => t.rangedMaxRangeWu },
  { label: "Max HP", value: (_s, t) => t.maxHp },
  { label: "Armour", value: (s) => s.flat.armour },
  { label: "Attack speed", value: (s) => s.flat.attackSpeedPct, pct: true },
  { label: "Move speed", value: (s) => s.flat.moveSpeedPct, pct: true },
  { label: "Spell power", value: (s) => s.flat.spellPowerPct, pct: true },
  { label: "Lifesteal", value: (s) => s.flat.lifestealPct, pct: true },
  { label: "On-hit effects", value: (s) => s.procs.length },
];

function keyedDiffs(
  before: Record<string, number>,
  after: Record<string, number>,
  label: (key: string) => string,
  lowerIsBetter = false,
): StatDiff[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: StatDiff[] = [];
  for (const k of [...keys].sort()) {
    const delta = (after[k] ?? 0) - (before[k] ?? 0);
    if (Math.abs(delta) < 0.05) continue;
    const shown = lowerIsBetter ? -delta : delta;
    out.push({
      label: label(k),
      delta,
      text: `${signed(shown)}% ${label(k)}`,
      better: delta > 0,
    });
  }
  return out;
}

/** Stat changes from going `before` → `after` gear (what the compare tooltip lists). */
export function diffGear(
  catalog: GearCatalog,
  before: SaveGear,
  after: SaveGear,
  base: PlayerTuning = basePlayerTuning(),
): StatDiff[] {
  const sb = gearStatsFor(catalog, before);
  const sa = gearStatsFor(catalog, after);
  const tb = effectivePlayerTuning(base, sb);
  const ta = effectivePlayerTuning(base, sa);
  const out: StatDiff[] = [];
  for (const m of MEASURES) {
    const delta = m.value(sa, ta) - m.value(sb, tb);
    if (Math.abs(delta) < (m.epsilon ?? 0.05)) continue;
    const text = m.format
      ? `${m.format(delta)} ${m.label}`
      : `${signed(delta)}${m.pct ? "%" : ""} ${m.label}`;
    out.push({
      label: m.label,
      delta,
      text,
      better: m.lowerIsBetter ? delta < 0 : delta > 0,
    });
  }
  out.push(
    ...keyedDiffs(
      sb.elementDamagePct,
      sa.elementDamagePct,
      (k) => `${capitalize(k)} damage`,
    ),
    ...keyedDiffs(
      sb.spellDamagePct,
      sa.spellDamagePct,
      (k) => `${spellLabel(k)} damage`,
    ),
    ...keyedDiffs(
      sb.spellCooldownPct,
      sa.spellCooldownPct,
      (k) => `${spellLabel(k)} cooldown`,
      true,
    ),
  );
  return out;
}

/** Diff for equipping `uid` (owned) into its target slot. */
export function equipDiff(
  catalog: GearCatalog,
  gear: SaveGear,
  uid: number,
): StatDiff[] {
  return diffGear(catalog, gear, equipItem(catalog, gear, uid));
}

/** Lines appended to the night-end summary for gear drops. */
export function nightDropLines(
  catalog: GearCatalog,
  drops: readonly ItemDraft[],
  soldGold: number,
  maxShown = 4,
): string[] {
  if (drops.length === 0) return [];
  const names = drops
    .map((d) => resolveItem(catalog, { ...d, uid: 0 }))
    .filter((r): r is ResolvedItem => r !== null)
    .map((r) => `• ${r.name} (${r.rarity.label})`);
  const lines = ["Loot found:", ...names.slice(0, maxShown)];
  if (names.length > maxShown)
    lines.push(`…and ${names.length - maxShown} more`);
  if (soldGold > 0) lines.push(`Bag full — extra loot sold for ${soldGold}g`);
  return lines;
}
