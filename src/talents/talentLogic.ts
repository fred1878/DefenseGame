import type { OnHitProc, StatBonus, StatModifier } from "../gear/gearTypes";
import type {
  SaveTalents,
  TalentBranchDef,
  TalentCatalog,
  TalentNodeDef,
  TalentNodeState,
  TalentTierDef,
} from "./talentTypes";

/** Where a node sits in the tree. */
export type TalentLocation = {
  branch: TalentBranchDef;
  tierIndex: number;
  tier: TalentTierDef;
  node: TalentNodeDef;
};

export function createEmptyTalents(catalog: TalentCatalog): SaveTalents {
  return { ranks: {}, earned: catalog.config.startingPoints };
}

export function findTalent(
  catalog: TalentCatalog,
  id: string,
): TalentLocation | null {
  for (const branch of catalog.branches) {
    for (let tierIndex = 0; tierIndex < branch.tiers.length; tierIndex++) {
      const tier = branch.tiers[tierIndex]!;
      const node = tier.nodes.find((n) => n.id === id);
      if (node) return { branch, tierIndex, tier, node };
    }
  }
  return null;
}

export function talentRank(talents: SaveTalents, id: string): number {
  return talents.ranks[id] ?? 0;
}

export function pointsSpent(talents: SaveTalents): number {
  return Object.values(talents.ranks).reduce((a, b) => a + b, 0);
}

export function pointsAvailable(talents: SaveTalents): number {
  return Math.max(0, talents.earned - pointsSpent(talents));
}

export function branchPointsSpent(
  talents: SaveTalents,
  branch: TalentBranchDef,
): number {
  let n = 0;
  for (const tier of branch.tiers) {
    for (const node of tier.nodes) n += talentRank(talents, node.id);
  }
  return n;
}

/** Points in the branch needed to open tier `tierIndex` (0-based). */
export function tierThreshold(
  catalog: TalentCatalog,
  tierIndex: number,
): number {
  return catalog.config.tierThresholds[tierIndex] ?? 0;
}

export function tierUnlocked(
  catalog: TalentCatalog,
  talents: SaveTalents,
  branch: TalentBranchDef,
  tierIndex: number,
): boolean {
  return (
    branchPointsSpent(talents, branch) >= tierThreshold(catalog, tierIndex)
  );
}

/** Another node in this pick-one tier already has ranks. */
export function choiceTakenElsewhere(
  talents: SaveTalents,
  loc: TalentLocation,
): boolean {
  if (!loc.tier.exclusive) return false;
  return loc.tier.nodes.some(
    (n) => n.id !== loc.node.id && talentRank(talents, n.id) > 0,
  );
}

function prerequisitesMet(talents: SaveTalents, node: TalentNodeDef): boolean {
  if (node.requires.length === 0) return true;
  return node.requires.some((id) => talentRank(talents, id) > 0);
}

/** Why the next rank cannot be learned (ignoring points), or null when it is open. */
export function lockReason(
  catalog: TalentCatalog,
  talents: SaveTalents,
  loc: TalentLocation,
): string | null {
  const { branch, tierIndex, node } = loc;
  if (talentRank(talents, node.id) >= node.maxRank) return "Maxed";
  if (!tierUnlocked(catalog, talents, branch, tierIndex)) {
    return `Needs ${tierThreshold(catalog, tierIndex)} pts in ${branch.name}`;
  }
  if (choiceTakenElsewhere(talents, loc)) return "Choice taken";
  if (!prerequisitesMet(talents, node)) {
    const names = node.requires
      .map((id) => findTalent(catalog, id)?.node.name ?? id)
      .join(" or ");
    return `Needs ${names}`;
  }
  return null;
}

export function nodeState(
  catalog: TalentCatalog,
  talents: SaveTalents,
  loc: TalentLocation,
): TalentNodeState {
  const rank = talentRank(talents, loc.node.id);
  if (rank >= loc.node.maxRank) return "maxed";
  if (rank > 0) return "partial";
  return lockReason(catalog, talents, loc) === null ? "available" : "locked";
}

export function canLearn(
  catalog: TalentCatalog,
  talents: SaveTalents,
  id: string,
): boolean {
  const loc = findTalent(catalog, id);
  if (!loc || pointsAvailable(talents) < 1) return false;
  return lockReason(catalog, talents, loc) === null;
}

/** Learn one rank (unchanged object when not allowed). */
export function learnTalent(
  catalog: TalentCatalog,
  talents: SaveTalents,
  id: string,
): SaveTalents {
  if (!canLearn(catalog, talents, id)) return talents;
  return {
    ...talents,
    ranks: { ...talents.ranks, [id]: talentRank(talents, id) + 1 },
  };
}

export function canResetTalents(
  catalog: TalentCatalog,
  talents: SaveTalents,
  gold: number,
): boolean {
  return pointsSpent(talents) > 0 && gold >= catalog.config.resetCostGold;
}

/** Refund every point for `resetCostGold`; null when not allowed. */
export function resetTalents(
  catalog: TalentCatalog,
  talents: SaveTalents,
  gold: number,
): { talents: SaveTalents; gold: number } | null {
  if (!canResetTalents(catalog, talents, gold)) return null;
  return {
    talents: { ...talents, ranks: {} },
    gold: gold - catalog.config.resetCostGold,
  };
}

/** Points earned for one campaign night. */
export function nightTalentPoints(
  catalog: TalentCatalog,
  won: boolean,
): number {
  const c = catalog.config;
  return won ? c.pointsPerNightWon : c.pointsPerNightLost;
}

export function awardNightTalentPoints(
  catalog: TalentCatalog,
  talents: SaveTalents,
  won: boolean,
): SaveTalents {
  const n = nightTalentPoints(catalog, won);
  return n > 0 ? { ...talents, earned: talents.earned + n } : talents;
}

function scaleModifier(m: StatModifier, rank: number): StatModifier {
  return { ...m, value: m.value * rank };
}

/** Procs don't stack by rank; higher ranks raise their chance. */
function scaleProc(p: OnHitProc, rank: number): OnHitProc {
  return { ...p, chancePct: p.chancePct * rank };
}

/** Effect of `rank` ranks of one node. */
export function talentEffectAt(node: TalentNodeDef, rank: number): StatBonus {
  if (rank <= 0) return { modifiers: [], procs: [] };
  return {
    modifiers: node.perRank.modifiers.map((m) => scaleModifier(m, rank)),
    procs: node.perRank.procs.map((p) => scaleProc(p, rank)),
  };
}

/** Every learned talent as a stat bonus for the gear stat aggregation. */
export function talentBonus(
  catalog: TalentCatalog,
  talents: SaveTalents,
): StatBonus {
  const modifiers: StatModifier[] = [];
  const procs: OnHitProc[] = [];
  for (const branch of catalog.branches) {
    for (const tier of branch.tiers) {
      for (const node of tier.nodes) {
        const rank = Math.min(node.maxRank, talentRank(talents, node.id));
        const e = talentEffectAt(node, rank);
        modifiers.push(...e.modifiers);
        procs.push(...e.procs);
      }
    }
  }
  return { modifiers, procs };
}

/**
 * Repair a loaded talent block: drop unknown ids, clamp ranks, and refund the
 * whole tree if the saved ranks no longer fit the rules (data changed).
 * Saves from before talents existed get points for the nights already won.
 */
export function normalizeSaveTalents(
  raw: unknown,
  catalog: TalentCatalog,
  nightsWon: number,
): SaveTalents {
  const r =
    raw && typeof raw === "object" ? (raw as Partial<SaveTalents>) : null;
  const fallbackEarned =
    catalog.config.startingPoints +
    Math.max(0, nightsWon) * catalog.config.pointsPerNightWon;
  const earned =
    r && typeof r.earned === "number" && Number.isFinite(r.earned)
      ? Math.max(0, Math.floor(r.earned))
      : fallbackEarned;
  const rawRanks = r?.ranks && typeof r.ranks === "object" ? r.ranks : {};
  const wanted: Record<string, number> = {};
  for (const [id, v] of Object.entries(rawRanks)) {
    const loc = findTalent(catalog, id);
    if (!loc || typeof v !== "number" || !Number.isFinite(v)) continue;
    const rank = Math.min(loc.node.maxRank, Math.floor(v));
    if (rank > 0) wanted[id] = rank;
  }
  // Replay tier by tier so thresholds / prerequisites / pick-one still hold.
  let rebuilt: SaveTalents = { ranks: {}, earned };
  for (const branch of catalog.branches) {
    for (const tier of branch.tiers) {
      for (const node of tier.nodes) {
        for (let i = 0; i < (wanted[node.id] ?? 0); i++) {
          rebuilt = learnTalent(catalog, rebuilt, node.id);
        }
      }
    }
  }
  const valid = Object.entries(wanted).every(
    ([id, rank]) => talentRank(rebuilt, id) === rank,
  );
  return valid ? rebuilt : { ranks: {}, earned };
}
