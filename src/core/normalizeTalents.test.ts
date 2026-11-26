import { describe, expect, it } from "vitest";
import shipped from "../../public/data/talents.json";
import { talentFixtureRaw } from "../test/talentFixture";
import { normalizeTalents } from "./normalizeTalents";

type Raw = ReturnType<typeof talentFixtureRaw>;
type Branch = { tiers: Array<{ nodes: Array<Record<string, unknown>> }> };

function mutate(fn: (raw: Raw & { branches: Branch[] }) => void): unknown {
  const raw = talentFixtureRaw() as Raw & { branches: Branch[] };
  fn(raw);
  return raw;
}

describe("normalizeTalents", () => {
  it("loads the shipped tree: 3 branches × 5 tiers, pick-one tier III", () => {
    const cat = normalizeTalents(shipped);
    expect(cat.branches.map((b) => b.name)).toEqual([
      "Blade",
      "Marksman",
      "Sorcery",
    ]);
    for (const b of cat.branches) {
      expect(b.tiers).toHaveLength(5);
      expect(b.tiers[2]!.exclusive).toBe(true);
      expect(b.tiers[2]!.nodes).toHaveLength(2);
    }
    expect(cat.config.tierThresholds).toHaveLength(5);
  });

  it("defaults optional fields", () => {
    const cat = normalizeTalents(talentFixtureRaw());
    const b2 = cat.branches[1]!.tiers[1]!.nodes[0]!;
    expect(b2.requires).toEqual([]);
    expect(b2.perRank).toEqual({ modifiers: [], procs: [] });
    expect(cat.branches[0]!.tiers[0]!.exclusive).toBe(false);
    expect(cat.branches[0]!.tiers[1]!.exclusive).toBe(true);
  });

  it.each([
    [
      "bad maxRank",
      (r: Raw & { branches: Branch[] }) => {
        r.branches[0]!.tiers[0]!.nodes[0]!.maxRank = 0;
      },
      /maxRank/,
    ],
    [
      "duplicate id",
      (r: Raw & { branches: Branch[] }) => {
        r.branches[1]!.tiers[0]!.nodes[0]!.id = "a1";
      },
      /Duplicate talent id a1/,
    ],
    [
      "unknown prerequisite",
      (r: Raw & { branches: Branch[] }) => {
        r.branches[0]!.tiers[2]!.nodes[0]!.requires = ["zzz"];
      },
      /requires unknown zzz/,
    ],
    [
      "empty tier",
      (r: Raw & { branches: Branch[] }) => {
        r.branches[1]!.tiers[1]!.nodes = [];
      },
      /at least one node/,
    ],
    [
      "more tiers than thresholds",
      (r: Raw & { branches: Branch[] }) => {
        (r.config as { tierThresholds: number[] }).tierThresholds = [0];
      },
      /tierThresholds lists 1/,
    ],
    [
      "negative config",
      (r: Raw & { branches: Branch[] }) => {
        (r.config as { resetCostGold: number }).resetCostGold = -1;
      },
      /config.resetCostGold/,
    ],
    [
      "bad modifier stat",
      (r: Raw & { branches: Branch[] }) => {
        r.branches[0]!.tiers[0]!.nodes[0]!.perRank = {
          modifiers: [{ stat: "luck", value: 1 }],
        };
      },
      /perRank.modifiers\[0\].stat/,
    ],
  ])("rejects %s", (_name, fn, err) => {
    expect(() => normalizeTalents(mutate(fn))).toThrow(err);
  });
});
