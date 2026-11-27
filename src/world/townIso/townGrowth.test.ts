import { describe, expect, it } from "vitest";
import { TOWN_GROWTH_PLACEHOLDER } from "../../config/townGrowth";
import type { TownBuildingDef } from "../../core/data/townBuildingTypes";
import {
  townBuildingArtTier,
  townGrowthScore,
  townGrowthView,
} from "./townGrowth";

const def = (extra: Partial<TownBuildingDef>): TownBuildingDef => ({
  label: "B",
  width: 10,
  height: 10,
  ...extra,
});

describe("town growth (placeholder thresholds)", () => {
  it("sums the configured upgrade levels and ignores the rest", () => {
    expect(townGrowthScore({})).toBe(0);
    expect(
      townGrowthScore({ wall: 3, trader: 1, blacksmith: 2, other: 9 }),
    ).toBe(6);
    expect(townGrowthScore({ wall: -2, trader: Number.NaN })).toBe(0);
  });

  it("starts at Town Lv 1, stage 0, with the next stage level as the hint", () => {
    const v = townGrowthView({});
    expect(v.townLevel).toBe(1);
    expect(v.stage).toBe(0);
    expect(v.progress).toBe(0);
    expect(v.nextStageTownLevel).toBe(
      TOWN_GROWTH_PLACEHOLDER.stageMinTownLevel[1],
    );
    expect(v.maxTownLevel).toBe(
      TOWN_GROWTH_PLACEHOLDER.townLevelMinScore.length,
    );
  });

  it("walks through the three stages and tops out", () => {
    const stages = new Set<number>();
    let lastLevel = 0;
    for (let wall = 0; wall <= 8; wall++) {
      for (const shops of [0, 1, 2, 3]) {
        const v = townGrowthView({ wall, trader: shops, blacksmith: shops });
        stages.add(v.stage);
        expect(v.progress).toBeGreaterThanOrEqual(0);
        expect(v.progress).toBeLessThanOrEqual(1);
        if (shops === 3) {
          expect(v.townLevel).toBeGreaterThanOrEqual(lastLevel);
          lastLevel = v.townLevel;
        }
      }
    }
    expect([...stages].sort()).toEqual([0, 1, 2]);
    const max = townGrowthView({ wall: 8, trader: 3, blacksmith: 3 });
    expect(max.stage).toBe(2);
    expect(max.progress).toBe(1);
    expect(max.nextStageTownLevel).toBeNull();
    expect(max.townLevel).toBe(max.maxTownLevel);
  });

  it("picks building art tiers by their own level, else by town stage", () => {
    const beacon = def({ upgradeId: "wall" });
    expect(townBuildingArtTier(beacon, { wall: 0 }, 2)).toBe(0);
    expect(townBuildingArtTier(beacon, { wall: 4 }, 0)).toBe(1);
    expect(townBuildingArtTier(beacon, { wall: 8 }, 0)).toBe(2);
    const trader = def({ opensShop: "trader" });
    expect(townBuildingArtTier(trader, {}, 2)).toBe(0);
    expect(townBuildingArtTier(trader, { trader: 3 }, 0)).toBe(2);
    const well = def({ opensEndlessMode: true });
    expect(townBuildingArtTier(well, { wall: 8 }, 1)).toBe(1);
    const custom = def({ upgradeId: "workshop" });
    expect(townBuildingArtTier(custom, { workshop: 3 }, 0)).toBe(0);
  });
});
