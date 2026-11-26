import { describe, expect, it } from "vitest";
import { talentFixture } from "../test/talentFixture";
import { findTalent } from "./talentLogic";
import {
  formatModifierValue,
  modifierParts,
  nextTierProgress,
  perRankSummary,
  pointsSubtitle,
  rankLabel,
  talentDescription,
  talentDiffRows,
  talentProcLines,
  tierNumeral,
} from "./talentText";

const cat = talentFixture();
const loc = (id: string) => findTalent(cat, id)!;

describe("talentText", () => {
  it("numbers tiers in roman numerals", () => {
    expect(tierNumeral(0)).toBe("I");
    expect(tierNumeral(4)).toBe("V");
    expect(tierNumeral(12)).toBe("13");
  });

  it("labels every modifier kind", () => {
    expect(modifierParts({ stat: "armour", value: 1 })).toEqual({
      label: "Armour",
      pct: false,
      negate: false,
    });
    expect(
      modifierParts({ stat: "elementDamagePct", element: "frost", value: 1 })
        .label,
    ).toBe("Frost damage");
    expect(
      modifierParts({ stat: "spellDamagePct", spell: "meteor", value: 1 })
        .label,
    ).toBe("Meteor damage");
    const cd = { stat: "spellCooldownPct" as const, spell: "meteor", value: 5 };
    expect(modifierParts(cd).negate).toBe(true);
    expect(formatModifierValue(cd, 5)).toBe("−5%");
    expect(formatModifierValue({ stat: "cooldownPct", value: 4 }, 8)).toBe(
      "−8%",
    );
    expect(formatModifierValue({ stat: "meleeDamage", value: 1.5 }, 3)).toBe(
      "+3",
    );
  });

  it("builds current → next rows and marks max rank", () => {
    expect(talentDiffRows(loc("a1"), 1)).toEqual([
      { label: "Melee damage from talent", from: "+3", to: "+6", delta: "▲ 3" },
    ]);
    expect(talentDiffRows(loc("a1"), 2)[0]).toMatchObject({
      to: "",
      delta: "Max",
    });
    expect(talentDiffRows(loc("a2x"), 0)[0]).toMatchObject({
      from: "0%",
      to: "−10%",
      delta: "▲ 10%",
    });
  });

  it("describes procs and per-rank effects", () => {
    expect(talentProcLines(loc("a2y"), 0)).toEqual(["10% on hit: Stun 0.3s"]);
    expect(talentProcLines(loc("a2y"), 1)).toEqual(["10% on hit: Stun 0.3s"]);
    expect(perRankSummary(loc("a1"))).toBe("+3 Melee damage per rank");
    expect(perRankSummary(loc("a2y"))).toBe("on-hit effect");
    expect(perRankSummary(loc("b2"))).toBe("");
    expect(talentDescription(loc("b2"))).toBe(
      "Beta · Tier II — No prerequisite listed.",
    );
    expect(talentDescription(loc("a1"))).toContain(
      "(+3 Melee damage per rank)",
    );
  });

  it("writes the subtitle from the points config", () => {
    expect(pointsSubtitle(cat.config)).toBe(
      "Earn 2 points for every night won, 1 point per loss",
    );
    expect(
      pointsSubtitle({
        ...cat.config,
        pointsPerNightWon: 1,
        pointsPerNightLost: 0,
      }),
    ).toBe("Earn 1 point for every night won");
  });

  it("tracks progress to the next tier in the branch", () => {
    const empty = { ranks: {}, earned: 5 };
    expect(nextTierProgress(cat, empty, loc("a1"))).toEqual({
      label: "Tier II (A Two X / A Two Y) unlocks at 2 pts in Alpha",
      have: 0,
      need: 2,
    });
    const full = { ranks: { b1: 1, b2: 1 }, earned: 5 };
    expect(nextTierProgress(cat, full, loc("b1"))).toEqual({
      label: "Every tier in Beta is open",
      have: 2,
      need: 2,
    });
    expect(rankLabel({ ranks: { a1: 1 }, earned: 1 }, loc("a1"))).toBe(
      "Rank 1 / 2",
    );
  });
});
