import { describe, expect, it, vi } from "vitest";
import { scaleUiX } from "../../config/uiScale";
import type {
  TownBuildingDef,
  TownLayoutDef,
} from "../../core/townBuildingTypes";
import { asScene, fakeScene } from "../../test/fakeScene";
import {
  spawnTownBuildingControls,
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
    const displayScale = 2;
    const area = townBuildingFootprintHitArea(def, displayScale);
    const w = def.width * displayScale;
    const h = def.height * displayScale;
    expect(area.width).toBe(w);
    expect(area.height).toBe(h);
    expect(area.x).toBe(-w / 2);
    expect(area.y).toBe(-h);
  });

  it("label wrap is at least def width and a readable minimum", () => {
    const narrow: TownBuildingDef = {
      label: "Beacon",
      textureKey: "town_special_witchlight_beacon",
      width: 80,
      height: 112,
    };
    expect(townBuildingLabelWrapWidth(narrow)).toBeGreaterThanOrEqual(80);
    expect(townBuildingLabelWrapWidth(narrow)).toBeGreaterThanOrEqual(
      scaleUiX(136),
    );
  });

  it("keeps separate ids for daylit variants", () => {
    const layout: TownLayoutDef = {
      buildingDisplayScale: 1,
      slots: [{ buildingId: "town_market_stall_daylit", x: 100, y: 200 }],
    };
    expect(defs[layout.slots[0]!.buildingId]?.textureKey).toBe(
      "town_market_stall_daylit",
    );
  });
});

describe("spawnTownBuildingControls", () => {
  const market: TownBuildingDef = {
    label: "Market",
    textureKey: "town_market_stall",
    width: 112,
    height: 72,
  };
  const beacon: TownBuildingDef = {
    label: "Beacon",
    textureKey: "town_beacon",
    width: 80,
    height: 112,
    startsNight: true,
  };

  it("skips unknown and missing-texture buildings and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const scene = fakeScene({ textures: ["town_market_stall"] });
    const onTap = vi.fn();
    const controls = spawnTownBuildingControls(
      asScene(scene),
      { market, beacon },
      {
        buildingDisplayScale: 2,
        slots: [
          { buildingId: "missing", x: 0, y: 0 },
          { buildingId: "beacon", x: 10, y: 20 },
          { buildingId: "market", x: 40, y: 80 },
        ],
      },
      {
        labelFor: (def) => def.label,
        onTap,
      },
    );
    expect(controls).toHaveLength(1);
    expect(controls[0]!.buildingId).toBe("market");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    const { x, y } = controls[0]!.spriteCenter();
    expect(x).toBe(40);
    expect(y).toBe(80 - 72);
    controls[0]!.setLabel("Shop");
    controls[0]!.setInputEnabled(false);
    controls[0]!.setInputEnabled(true);
  });

  it("uses the start-night test id for night-starting buildings", () => {
    const scene = fakeScene({ textures: ["town_beacon"] });
    const controls = spawnTownBuildingControls(
      asScene(scene),
      { beacon },
      {
        buildingDisplayScale: 1,
        slots: [{ buildingId: "beacon", x: 0, y: 0 }],
      },
      {
        depth: 30,
        labelFor: (def) => def.label,
        onTap: vi.fn(),
      },
    );
    expect(controls).toHaveLength(1);
    const container = controls[0]!.container as unknown as {
      last: (method: string) => unknown[] | undefined;
    };
    expect(container.last("setData")).toEqual(["testid", "start-night"]);
  });
});
