import type { OnHitProc, StatModifier } from "../gear/gearTypes";
import type {
  TalentBranchDef,
  TalentCatalog,
  TalentConfig,
  TalentNodeDef,
  TalentTierDef,
} from "../talents/talentTypes";
import {
  ConfigLoadError,
  requireFiniteNumber,
  requireRecord,
} from "./configValidation";
import {
  normalizeOnHitProc,
  normalizeStatModifier,
  requireArray,
  requireString,
} from "./normalizeItems";

export const TALENTS_FILE_BOOT_KEYS = ["config", "branches"] as const;
export const TALENTS_CONFIG_BOOT_KEYS = [
  "pointsPerNightWon",
  "pointsPerNightLost",
  "startingPoints",
  "resetCostGold",
  "tierThresholds",
] as const;
export const TALENTS_BRANCH_BOOT_KEYS = [
  "id",
  "name",
  "icon",
  "tiers",
] as const;
export const TALENTS_TIER_BOOT_KEYS = ["exclusive", "nodes"] as const;
export const TALENTS_NODE_BOOT_KEYS = [
  "maxRank",
  "requires",
  "description",
  "perRank",
  "modifiers",
  "procs",
] as const;

function nonNegative(value: unknown, path: string): number {
  const n = requireFiniteNumber(value, path);
  if (n < 0) throw new ConfigLoadError(`Expected ≥ 0 at ${path}`);
  return n;
}

function normalizeConfig(raw: unknown): TalentConfig {
  const row = requireRecord(raw, "config");
  const tierThresholds = requireArray(
    row.tierThresholds,
    "config.tierThresholds",
  ).map((v, i) => nonNegative(v, `config.tierThresholds[${i}]`));
  return {
    pointsPerNightWon: nonNegative(
      row.pointsPerNightWon,
      "config.pointsPerNightWon",
    ),
    pointsPerNightLost: nonNegative(
      row.pointsPerNightLost,
      "config.pointsPerNightLost",
    ),
    startingPoints: nonNegative(row.startingPoints, "config.startingPoints"),
    resetCostGold: nonNegative(row.resetCostGold, "config.resetCostGold"),
    tierThresholds,
  };
}

function normalizeNode(raw: unknown, path: string): TalentNodeDef {
  const row = requireRecord(raw, path);
  const maxRank = requireFiniteNumber(row.maxRank, `${path}.maxRank`);
  if (!Number.isInteger(maxRank) || maxRank < 1) {
    throw new ConfigLoadError(`Expected integer ≥ 1 at ${path}.maxRank`);
  }
  const perRank = requireRecord(row.perRank, `${path}.perRank`);
  const modifiers: StatModifier[] =
    perRank.modifiers === undefined
      ? []
      : requireArray(perRank.modifiers, `${path}.perRank.modifiers`).map(
          (m, i) => normalizeStatModifier(m, `${path}.perRank.modifiers[${i}]`),
        );
  const procs: OnHitProc[] =
    perRank.procs === undefined
      ? []
      : requireArray(perRank.procs, `${path}.perRank.procs`).map((p, i) =>
          normalizeOnHitProc(p, `${path}.perRank.procs[${i}]`),
        );
  return {
    id: requireString(row.id, `${path}.id`),
    name: requireString(row.name, `${path}.name`),
    icon: requireString(row.icon, `${path}.icon`),
    maxRank,
    requires:
      row.requires === undefined
        ? []
        : requireArray(row.requires, `${path}.requires`).map((r, i) =>
            requireString(r, `${path}.requires[${i}]`),
          ),
    description: requireString(row.description, `${path}.description`),
    perRank: { modifiers, procs },
  };
}

function normalizeTier(raw: unknown, path: string): TalentTierDef {
  const row = requireRecord(raw, path);
  const nodes = requireArray(row.nodes, `${path}.nodes`).map((n, i) =>
    normalizeNode(n, `${path}.nodes[${i}]`),
  );
  if (nodes.length === 0) {
    throw new ConfigLoadError(`Expected at least one node at ${path}.nodes`);
  }
  return { exclusive: row.exclusive === true, nodes };
}

function normalizeBranch(raw: unknown, path: string): TalentBranchDef {
  const row = requireRecord(raw, path);
  return {
    id: requireString(row.id, `${path}.id`),
    name: requireString(row.name, `${path}.name`),
    icon: requireString(row.icon, `${path}.icon`),
    tiers: requireArray(row.tiers, `${path}.tiers`).map((t, i) =>
      normalizeTier(t, `${path}.tiers[${i}]`),
    ),
  };
}

/** Validate `talents.json`: unique ids, known prerequisites, one threshold per tier. */
export function normalizeTalents(raw: unknown): TalentCatalog {
  const file = requireRecord(raw, "talents.json");
  const config = normalizeConfig(file.config);
  const branches = requireArray(file.branches, "branches").map((b, i) =>
    normalizeBranch(b, `branches[${i}]`),
  );
  const ids = new Set<string>();
  for (const b of branches) {
    if (b.tiers.length > config.tierThresholds.length) {
      throw new ConfigLoadError(
        `Branch ${b.id} has ${b.tiers.length} tiers but config.tierThresholds lists ${config.tierThresholds.length}`,
      );
    }
    for (const n of b.tiers.flatMap((t) => t.nodes)) {
      if (ids.has(n.id)) {
        throw new ConfigLoadError(`Duplicate talent id ${n.id}`);
      }
      ids.add(n.id);
    }
  }
  for (const n of branches.flatMap((b) => b.tiers.flatMap((t) => t.nodes))) {
    for (const r of n.requires) {
      if (!ids.has(r)) {
        throw new ConfigLoadError(`Talent ${n.id} requires unknown ${r}`);
      }
    }
  }
  return { config, branches };
}
