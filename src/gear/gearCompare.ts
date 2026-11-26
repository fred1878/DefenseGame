import { basePlayerTuning, type PlayerTuning } from "../config/player";
import { spellLabel } from "./gearText";
import {
  armourReduction,
  effectivePlayerTuning,
  gearStatsFor,
  type GearStats,
} from "./itemStats";
import type { GearCatalog, SaveGear } from "./gearTypes";

/** One "From → To" compare row (Blacksmith / Inventory detail panels). */
export type CompareRow = {
  label: string;
  from: string;
  to: string;
  /** "▲7" / "▼2.5%" (absolute change, arrow = direction of the value). */
  delta: string;
  /** Whether the change helps the player. */
  better: boolean;
};

type Ctx = { catalog: GearCatalog; s: GearStats; t: PlayerTuning };

type Measure = {
  label: string;
  value: (c: Ctx) => number;
  /** Decimals shown (default 0). */
  digits?: number;
  suffix?: string;
  lowerIsBetter?: boolean;
};

const swingS = (t: PlayerTuning) =>
  (t.meleeWindupMs + t.meleeActiveMs + t.meleeRecoveryMs) / 1000;
const shotS = (t: PlayerTuning) =>
  (t.rangedWindupMs + t.rangedActiveMs + t.rangedRecoveryMs) / 1000;
const perSecond = (dmg: number, s: number) => (s > 0 ? dmg / s : 0);

const MEASURES: Measure[] = [
  { label: "Max HP", value: ({ t }) => t.maxHp },
  { label: "Armour", value: ({ s }) => s.flat.armour },
  {
    label: "Damage reduction",
    value: ({ catalog, s }) => armourReduction(catalog, s.flat.armour) * 100,
    digits: 1,
    suffix: "%",
  },
  {
    label: "Melee DPS",
    value: ({ t }) => perSecond(t.meleeDamage, swingS(t)),
    digits: 1,
  },
  { label: "Melee hit", value: ({ t }) => t.meleeDamage },
  {
    label: "Ranged DPS",
    value: ({ t }) => perSecond(t.rangedDamage, shotS(t)),
    digits: 1,
  },
  { label: "Ranged hit", value: ({ t }) => t.rangedDamage },
  { label: "Melee reach", value: ({ t }) => t.meleeStrikeRangeWu },
  { label: "Ranged range", value: ({ t }) => t.rangedMaxRangeWu },
  {
    label: "Attack speed",
    value: ({ s }) => s.flat.attackSpeedPct,
    suffix: "%",
  },
  { label: "Move speed", value: ({ s }) => s.flat.moveSpeedPct, suffix: "%" },
  {
    label: "Spell power",
    value: ({ s }) => s.flat.spellPowerPct,
    suffix: "%",
  },
  {
    label: "Lifesteal",
    value: ({ s }) => s.flat.lifestealPct,
    digits: 1,
    suffix: "%",
  },
  { label: "On-hit effects", value: ({ s }) => s.procs.length },
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmt(v: number, digits = 0, suffix = ""): string {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return `${digits ? r.toFixed(digits) : String(r)}${suffix}`;
}

function row(
  label: string,
  before: number,
  after: number,
  digits = 0,
  suffix = "",
  lowerIsBetter = false,
): CompareRow | null {
  const f = 10 ** digits;
  const a = Math.round(before * f) / f;
  const b = Math.round(after * f) / f;
  if (a === b) return null;
  const up = b > a;
  return {
    label,
    from: fmt(a, digits, suffix),
    to: fmt(b, digits, suffix),
    delta: `${up ? "▲" : "▼"}${fmt(Math.abs(b - a), digits, suffix)}`,
    better: lowerIsBetter ? !up : up,
  };
}

function keyedRows(
  before: Record<string, number | undefined>,
  after: Record<string, number | undefined>,
  label: (k: string) => string,
  lowerIsBetter = false,
): CompareRow[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .sort()
    .map((k) =>
      row(label(k), before[k] ?? 0, after[k] ?? 0, 0, "%", lowerIsBetter),
    )
    .filter((r): r is CompareRow => r !== null);
}

/** Absolute before/after rows for every stat that changes going `before` → `after`. */
export function compareGear(
  catalog: GearCatalog,
  before: SaveGear,
  after: SaveGear,
  base: PlayerTuning = basePlayerTuning(),
): CompareRow[] {
  const sb = gearStatsFor(catalog, before);
  const sa = gearStatsFor(catalog, after);
  const cb: Ctx = { catalog, s: sb, t: effectivePlayerTuning(base, sb) };
  const ca: Ctx = { catalog, s: sa, t: effectivePlayerTuning(base, sa) };
  const out: CompareRow[] = [];
  for (const m of MEASURES) {
    const r = row(
      m.label,
      m.value(cb),
      m.value(ca),
      m.digits,
      m.suffix,
      m.lowerIsBetter,
    );
    if (r) out.push(r);
  }
  out.push(
    ...keyedRows(
      sb.elementDamagePct,
      sa.elementDamagePct,
      (k) => `${capitalize(k)} damage`,
    ),
    ...keyedRows(
      sb.spellDamagePct,
      sa.spellDamagePct,
      (k) => `${spellLabel(k)} damage`,
    ),
    ...keyedRows(
      sb.spellCooldownPct,
      sa.spellCooldownPct,
      (k) => `${spellLabel(k)} cooldown`,
      true,
    ),
  );
  return out;
}

/** "Gold after purchase / sale" row; `better` is false when gold would go negative. */
export function goldAfterRow(
  label: string,
  gold: number,
  change: number,
): CompareRow {
  const after = gold + change;
  return {
    label,
    from: `${gold}g`,
    to: `${after}g`,
    delta: `${change >= 0 ? "▲" : "▼"}${Math.abs(change)}`,
    better: change >= 0,
  };
}
