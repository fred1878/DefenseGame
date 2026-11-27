import { FLAT_STAT_LABELS, procLabel, spellLabel } from "../gear/gearText";
import type { OnHitProc, StatModifier } from "../gear/gearTypes";
import {
  branchPointsSpent,
  talentRank,
  tierThreshold,
  type TalentLocation,
} from "./talentLogic";
import type { SaveTalents, TalentCatalog, TalentConfig } from "./talentTypes";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function tierNumeral(tierIndex: number): string {
  return ROMAN[tierIndex] ?? String(tierIndex + 1);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Display label + unit for a modifier; cooldowns read as a reduction. */
export function modifierParts(m: StatModifier): {
  label: string;
  pct: boolean;
  /** Shown value is negated (cooldown reductions). */
  negate: boolean;
} {
  if (m.stat === "elementDamagePct") {
    return { label: `${cap(m.element)} damage`, pct: true, negate: false };
  }
  if (m.stat === "spellDamagePct") {
    return {
      label: `${spellLabel(m.spell)} damage`,
      pct: true,
      negate: false,
    };
  }
  if (m.stat === "spellCooldownPct") {
    return {
      label: `${spellLabel(m.spell)} cooldown`,
      pct: true,
      negate: true,
    };
  }
  const meta = FLAT_STAT_LABELS[m.stat];
  return { ...meta, negate: m.stat === "cooldownPct" };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function formatModifierValue(m: StatModifier, value: number): string {
  const p = modifierParts(m);
  if (value === 0) return `0${p.pct ? "%" : ""}`;
  const v = p.negate ? -value : value;
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${round1(Math.abs(v))}${p.pct ? "%" : ""}`;
}

/** One "from → to" line in the detail panel. */
export type TalentDiffRow = {
  label: string;
  from: string;
  to: string;
  delta: string;
};

/** Current → next-rank values of every modifier on a node (next = null when maxed). */
export function talentDiffRows(
  loc: TalentLocation,
  rank: number,
): TalentDiffRow[] {
  const next = Math.min(rank + 1, loc.node.maxRank);
  const atMax = rank >= loc.node.maxRank;
  return loc.node.perRank.modifiers.map((m) => {
    const p = modifierParts(m);
    return {
      label: `${p.label} from talent`,
      from: formatModifierValue(m, m.value * rank),
      to: atMax ? "" : formatModifierValue(m, m.value * next),
      delta: atMax
        ? "Max"
        : `▲ ${round1(Math.abs(m.value))}${p.pct ? "%" : ""}`,
    };
  });
}

/** Proc lines at the next (or current when maxed) rank. */
export function talentProcLines(loc: TalentLocation, rank: number): string[] {
  const shown = Math.max(1, Math.min(loc.node.maxRank, rank + 1));
  return loc.node.perRank.procs.map((p: OnHitProc) =>
    procLabel({ ...p, chancePct: p.chancePct * shown }),
  );
}

/** One rank's effect as a short phrase ("+2 Melee damage per rank"). */
export function perRankSummary(loc: TalentLocation): string {
  const node = loc.node;
  const suffix = node.maxRank > 1 ? " per rank" : "";
  const parts = node.perRank.modifiers.map(
    (m) => `${formatModifierValue(m, m.value)} ${modifierParts(m).label}`,
  );
  if (node.perRank.procs.length) parts.push("on-hit effect");
  return parts.length ? `${parts.join(", ")}${suffix}` : "";
}

/** "Sorcery · Tier I — description (+5% Spell power per rank)". */
export function talentDescription(loc: TalentLocation): string {
  const summary = perRankSummary(loc);
  return `${loc.branch.name} · Tier ${tierNumeral(loc.tierIndex)} — ${loc.node.description}${summary ? ` (${summary})` : ""}`;
}

/** Header subtitle from the points config. */
export function pointsSubtitle(config: TalentConfig): string {
  const won = config.pointsPerNightWon;
  const lost = config.pointsPerNightLost;
  const pts = (n: number) => `${n} point${n === 1 ? "" : "s"}`;
  const base = `Earn ${pts(won)} for every night won`;
  return lost > 0 ? `${base}, ${pts(lost)} per loss` : base;
}

/** Progress toward the next locked tier in the node's branch. */
export function nextTierProgress(
  catalog: TalentCatalog,
  talents: SaveTalents,
  loc: TalentLocation,
): { label: string; have: number; need: number } {
  const spent = branchPointsSpent(talents, loc.branch);
  const tiers = loc.branch.tiers;
  for (let i = 0; i < tiers.length; i++) {
    const need = tierThreshold(catalog, i);
    if (spent < need) {
      const names = tiers[i]!.nodes.map((n) => n.name).join(" / ");
      return {
        label: `Tier ${tierNumeral(i)} (${names}) unlocks at ${need} pts in ${loc.branch.name}`,
        have: spent,
        need,
      };
    }
  }
  return {
    label: `Every tier in ${loc.branch.name} is open`,
    have: spent,
    need: Math.max(1, spent),
  };
}

/** "Rank 2 / 3". */
export function rankLabel(talents: SaveTalents, loc: TalentLocation): string {
  return `Rank ${talentRank(talents, loc.node.id)} / ${loc.node.maxRank}`;
}
