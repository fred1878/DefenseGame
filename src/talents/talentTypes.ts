import type { OnHitProc, StatModifier } from "../gear/gearTypes";

/** Talent points and gold rules (`talents.json` → `config`). */
export type TalentConfig = {
  pointsPerNightWon: number;
  pointsPerNightLost: number;
  /** Points a new save starts with. */
  startingPoints: number;
  resetCostGold: number;
  /** Points spent in the same branch needed to open each tier (index 0 = tier I). */
  tierThresholds: number[];
};

/** What one rank of a talent adds (ranks stack linearly). */
export type TalentEffect = {
  modifiers: StatModifier[];
  procs: OnHitProc[];
};

export type TalentNodeDef = {
  id: string;
  name: string;
  icon: string;
  maxRank: number;
  /** Any one of these at rank ≥ 1 unlocks the node (empty = no prerequisite). */
  requires: string[];
  description: string;
  perRank: TalentEffect;
};

export type TalentTierDef = {
  /** Pick one: learning a node locks the others in this tier. */
  exclusive: boolean;
  nodes: TalentNodeDef[];
};

export type TalentBranchDef = {
  id: string;
  name: string;
  icon: string;
  tiers: TalentTierDef[];
};

export type TalentCatalog = {
  config: TalentConfig;
  branches: TalentBranchDef[];
};

/** Talent progress stored in the save. */
export type SaveTalents = {
  /** Talent id → learned rank (only ranks ≥ 1 are stored). */
  ranks: Record<string, number>;
  /** Total points earned so far (spent = sum of ranks). */
  earned: number;
};

export type TalentNodeState = "locked" | "available" | "partial" | "maxed";
