import { describe, expect, it } from "vitest";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";

const defs: Record<string, TownBuildingDef> = {
  town_market_stall_daylit: {
    label: "Market Stall (Daylit)",
    textureKey: "town_market_stall_daylit",
    width: 112,
    height: 72,
  },
};

describe("town building footprints", () => {
  it("uses positive native sizes for layout math", () => {
    for (const def of Object.values(defs)) {
      expect(def.width).toBeGreaterThan(0);
      expect(def.height).toBeGreaterThan(0);
    }
  });

  it("keeps separate ids for daylit variants", () => {
    const layout: TownLayoutDef = {
      slots: [{ buildingId: "town_market_stall_daylit", x: 100, y: 200 }],
    };
    expect(defs[layout.slots[0]!.buildingId]?.textureKey).toBe(
      "town_market_stall_daylit",
    );
  });
});