import { describe, expect, it } from "vitest";
import { scaleUiX } from "../core/displayScale";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";
import {
  townBuildingFootprintHitArea,
  townBuildingLabelWrapWidth,
} from "./TownBuildings";

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

  it("hit area matches sprite footprint only", () => {
    const def: TownBuildingDef = {
      label: "Market",
      textureKey: "town_market_stall",
      width: 112,
      height: 72,
    };
    const area = townBuildingFootprintHitArea(def);
    expect(area.width).toBe(112);
    expect(area.height).toBe(72);
    expect(area.x).toBe(-56);
    expect(area.y).toBe(-72);
  });

  it("label wrap is at least def width and a readable minimum", () => {
    const narrow: TownBuildingDef = {
      label: "Beacon",
      textureKey: "town_special_witchlight_beacon",
      width: 80,
      height: 112,
    };
    expect(townBuildingLabelWrapWidth(narrow)).toBeGreaterThanOrEqual(80);
    expect(townBuildingLabelWrapWidth(narrow)).toBeGreaterThanOrEqual(scaleUiX(136));
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