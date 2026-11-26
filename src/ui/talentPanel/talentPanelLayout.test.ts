import { describe, expect, it } from "vitest";
import { getTalentCatalog } from "../../talents/talentCatalog";
import { talentFixture } from "../../test/talentFixture";
import {
  branchCenterX,
  layoutTalentTree,
  nodeOffsets,
  TALENT_LAYOUT,
} from "./talentPanelLayout";

describe("talent tree layout", () => {
  it("fits the shipped tree inside the 540×1200 frame", () => {
    const lay = layoutTalentTree(getTalentCatalog(), 540, 1200);
    expect(lay.nodes).toHaveLength(18);
    expect(lay.branchCenters.map(Math.round)).toEqual([137, 287, 437]);
    expect(lay.detailY + TALENT_LAYOUT.detailH).toBeLessThan(
      lay.actionY - TALENT_LAYOUT.actionH / 2,
    );
    for (const n of lay.nodes) {
      expect(n.x - TALENT_LAYOUT.orbR).toBeGreaterThan(TALENT_LAYOUT.pad);
      expect(n.x + TALENT_LAYOUT.orbR).toBeLessThan(540 - TALENT_LAYOUT.pad);
      expect(n.y).toBeLessThan(lay.treeBottom);
    }
  });

  it("spaces pick-one nodes so orbs keep a clear gap", () => {
    const [a, b] = nodeOffsets(2);
    expect(b! - a!).toBe(TALENT_LAYOUT.pairSpacing);
    expect(b! - a! - 2 * TALENT_LAYOUT.orbR).toBeGreaterThanOrEqual(20);
    expect(nodeOffsets(1)).toEqual([0]);
    expect(nodeOffsets(4)[1]! - nodeOffsets(4)[0]!).toBeCloseTo(
      (TALENT_LAYOUT.cellW - 2 * TALENT_LAYOUT.orbR) / 3,
    );
    expect(branchCenterX(0, 540)).toBeCloseTo(137);
  });

  it("connects prerequisites (or the whole previous tier) with elbows", () => {
    const lay = layoutTalentTree(talentFixture(), 540, 1200);
    const pairs = lay.connectors.map((c) => `${c.parentId}>${c.childId}`);
    expect(pairs).toEqual(["a1>a2x", "a1>a2y", "a2x>a3", "a2y>a3", "b1>b2"]);
    const c = lay.connectors[0]!;
    expect(c.points).toHaveLength(4);
    expect(c.points[1]!.y).toBe(c.points[2]!.y);
    expect(c.points[3]!.y).toBeGreaterThan(c.points[0]!.y);
  });

  it("skips prerequisites outside the previous tier", () => {
    const cat = talentFixture();
    cat.branches[0]!.tiers[2]!.nodes[0]!.requires = ["a1"];
    const lay = layoutTalentTree(cat, 540, 1200);
    expect(lay.connectors.some((c) => c.childId === "a3")).toBe(false);
    const empty = layoutTalentTree({ ...cat, branches: [] }, 540, 1200);
    expect(empty.nodes).toEqual([]);
    expect(empty.tierRowTops).toEqual([]);
  });
});
