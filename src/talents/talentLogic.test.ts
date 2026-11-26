import { describe, expect, it } from "vitest";
import { talentFixture } from "../test/talentFixture";
import {
  awardNightTalentPoints,
  branchPointsSpent,
  canLearn,
  canResetTalents,
  choiceTakenElsewhere,
  createEmptyTalents,
  findTalent,
  learnTalent,
  lockReason,
  nightTalentPoints,
  nodeState,
  normalizeSaveTalents,
  pointsAvailable,
  pointsSpent,
  resetTalents,
  talentBonus,
  talentEffectAt,
  tierThreshold,
  tierUnlocked,
} from "./talentLogic";
import type { SaveTalents } from "./talentTypes";

const cat = talentFixture();
const loc = (id: string) => findTalent(cat, id)!;
const learnAll = (t: SaveTalents, ids: string[]) =>
  ids.reduce((acc, id) => learnTalent(cat, acc, id), t);

describe("talentLogic", () => {
  it("starts with the configured points and nothing learned", () => {
    const t = createEmptyTalents(cat);
    expect(t).toEqual({ ranks: {}, earned: 1 });
    expect(pointsAvailable(t)).toBe(1);
    expect(findTalent(cat, "missing")).toBeNull();
    expect(tierThreshold(cat, 9)).toBe(0);
  });

  it("learns ranks within points, then locks on max rank", () => {
    let t: SaveTalents = { ranks: {}, earned: 3 };
    expect(nodeState(cat, t, loc("a1"))).toBe("available");
    t = learnTalent(cat, t, "a1");
    expect(nodeState(cat, t, loc("a1"))).toBe("partial");
    t = learnTalent(cat, t, "a1");
    expect(nodeState(cat, t, loc("a1"))).toBe("maxed");
    expect(lockReason(cat, t, loc("a1"))).toBe("Maxed");
    expect(learnTalent(cat, t, "a1")).toBe(t);
    expect(pointsSpent(t)).toBe(2);
    expect(branchPointsSpent(t, cat.branches[0]!)).toBe(2);
    expect(canLearn(cat, t, "nope")).toBe(false);
  });

  it("gates tiers by points spent in the same branch", () => {
    const t: SaveTalents = { ranks: { a1: 1 }, earned: 9 };
    expect(tierUnlocked(cat, t, cat.branches[0]!, 1)).toBe(false);
    expect(lockReason(cat, t, loc("a2x"))).toBe("Needs 2 pts in Alpha");
    expect(nodeState(cat, t, loc("a2x"))).toBe("locked");
    // Points in another branch don't count.
    const other = learnTalent(cat, t, "b1");
    expect(canLearn(cat, other, "a2x")).toBe(false);
    expect(canLearn(cat, learnTalent(cat, t, "a1"), "a2x")).toBe(true);
  });

  it("pick-one tiers lock the other choice", () => {
    let t = learnAll({ ranks: {}, earned: 9 }, ["a1", "a1", "a2x"]);
    expect(t.ranks.a2x).toBe(1);
    expect(choiceTakenElsewhere(t, loc("a2y"))).toBe(true);
    expect(choiceTakenElsewhere(t, loc("a1"))).toBe(false);
    expect(lockReason(cat, t, loc("a2y"))).toBe("Choice taken");
    expect(learnTalent(cat, t, "a2y")).toBe(t);
    // Either choice satisfies the next tier's prerequisite.
    t = learnTalent(cat, t, "a3");
    expect(t.ranks.a3).toBe(1);
  });

  it("reports missing prerequisites by name", () => {
    const t: SaveTalents = { ranks: { a1: 2, b1: 1 }, earned: 9 };
    const noPrereq = { ...t, ranks: { ...t.ranks } };
    expect(lockReason(cat, noPrereq, loc("b2"))).toBe("Needs 2 pts in Beta");
    // a3 needs a2x or a2y even with enough branch points.
    const fake: SaveTalents = { ranks: { a1: 2, a2x: 0 }, earned: 9 };
    const branch3 = { ...fake, ranks: { a1: 3 } };
    expect(lockReason(cat, branch3, loc("a3"))).toBe(
      "Needs A Two X or A Two Y",
    );
  });

  it("needs a free point to learn", () => {
    const t: SaveTalents = { ranks: { a1: 1 }, earned: 1 };
    expect(canLearn(cat, t, "a1")).toBe(false);
    expect(nodeState(cat, t, loc("a1"))).toBe("partial");
  });

  it("resets for gold only when something is spent", () => {
    const t = learnAll({ ranks: {}, earned: 3 }, ["a1"]);
    expect(canResetTalents(cat, { ranks: {}, earned: 3 }, 999)).toBe(false);
    expect(canResetTalents(cat, t, 39)).toBe(false);
    expect(resetTalents(cat, t, 39)).toBeNull();
    expect(resetTalents(cat, t, 50)).toEqual({
      talents: { ranks: {}, earned: 3 },
      gold: 10,
    });
  });

  it("awards points per night won / lost", () => {
    const t = createEmptyTalents(cat);
    expect(nightTalentPoints(cat, true)).toBe(2);
    expect(awardNightTalentPoints(cat, t, true).earned).toBe(3);
    expect(awardNightTalentPoints(cat, t, false).earned).toBe(2);
    const none = {
      ...cat,
      config: { ...cat.config, pointsPerNightLost: 0 },
    };
    expect(awardNightTalentPoints(none, t, false)).toBe(t);
  });

  it("scales effects by rank and sums learned talents", () => {
    expect(talentEffectAt(loc("a1").node, 0)).toEqual({
      modifiers: [],
      procs: [],
    });
    expect(talentEffectAt(loc("a2y").node, 2).procs[0]).toMatchObject({
      kind: "stun",
      chancePct: 20,
    });
    const t: SaveTalents = { ranks: { a1: 2, a2y: 1, ghost: 4 }, earned: 9 };
    const bonus = talentBonus(cat, t);
    expect(bonus.modifiers).toEqual([{ stat: "meleeDamage", value: 6 }]);
    expect(bonus.procs).toHaveLength(1);
  });

  describe("normalizeSaveTalents", () => {
    it("credits legacy saves with points for nights already won", () => {
      expect(normalizeSaveTalents(undefined, cat, 4)).toEqual({
        ranks: {},
        earned: 9,
      });
      expect(normalizeSaveTalents("junk", cat, -2).earned).toBe(1);
    });

    it("keeps valid ranks, drops unknown ids and clamps ranks", () => {
      const t = normalizeSaveTalents(
        {
          earned: 7.8,
          ranks: { a1: 9, ghost: 1, a2x: 1, b1: "x", a3: 0 },
        },
        cat,
        0,
      );
      expect(t).toEqual({ earned: 7, ranks: { a1: 2, a2x: 1 } });
    });

    it("refunds the whole tree when saved ranks break the rules", () => {
      const both = normalizeSaveTalents(
        { earned: 9, ranks: { a1: 2, a2x: 1, a2y: 1 } },
        cat,
        0,
      );
      expect(both).toEqual({ earned: 9, ranks: {} });
      const broke = normalizeSaveTalents(
        { earned: 1, ranks: { a1: 2 } },
        cat,
        0,
      );
      expect(broke).toEqual({ earned: 1, ranks: {} });
      expect(
        normalizeSaveTalents({ earned: Number.NaN, ranks: null }, cat, 1),
      ).toEqual({ earned: 3, ranks: {} });
    });
  });
});
