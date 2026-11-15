import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOWN_BUILDING_ASSETS } from "./townBuildingAssets";
import type { TownBuildingDef, TownLayoutDef } from "../core/townBuildingTypes";

const repoRoot = join(import.meta.dirname, "../..");

function loadJson<T>(rel: string): T {
  return JSON.parse(
    readFileSync(join(repoRoot, rel), "utf8"),
  ) as T;
}

describe("town building v02 keep list", () => {
  const defs = loadJson<Record<string, TownBuildingDef>>(
    "public/data/town_buildings.json",
  );
  const layout = loadJson<TownLayoutDef>("public/data/town_layout.json");

  it("registers one row per kept sprite with matching texture keys", () => {
    expect(Object.keys(defs).sort()).toEqual([
      "town_market_stall",
      "town_market_stall_daylit",
      "town_special_gallows_square",
      "town_special_haunted_well",
      "town_special_moon_brazier",
      "town_special_plague_clinic",
      "town_special_witchlight_beacon",
      "town_special_witchlight_beacon_daylit",
    ]);
    for (const [id, def] of Object.entries(defs)) {
      expect(def.textureKey).toBe(id);
      expect(def.label.length).toBeGreaterThan(0);
    }
  });

  it("preloads a PNG for every registered texture key", () => {
    const keys = new Set<string>(TOWN_BUILDING_ASSETS.map((a) => a.key));
    for (const def of Object.values(defs)) {
      expect(keys.has(def.textureKey)).toBe(true);
    }
    expect(TOWN_BUILDING_ASSETS).toHaveLength(8);
  });

  it("layout slots reference registered buildings only", () => {
    for (const slot of layout.slots) {
      expect(defs[slot.buildingId], slot.buildingId).toBeDefined();
    }
    expect(layout.slots).toHaveLength(8);
  });

  it("wires legacy upgrades to thematic building rows", () => {
    expect(defs.town_special_witchlight_beacon?.upgradeId).toBe("wall");
    expect(defs.town_special_moon_brazier?.upgradeId).toBe("blacksmith");
  });

  it("wires gallows square to start night", () => {
    expect(defs.town_special_gallows_square?.startsNight).toBe(true);
    expect(layout.menuOrder?.[0]).toBe("town_special_gallows_square");
  });

  it("menu order lists every kept building once", () => {
    expect(layout.menuOrder).toHaveLength(8);
    const ids = new Set(layout.menuOrder);
    expect(ids.size).toBe(8);
    for (const id of layout.menuOrder ?? []) {
      expect(defs[id]).toBeDefined();
    }
  });
});