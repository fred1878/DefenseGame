import { describe, expect, it } from "vitest";
import { DataStore } from "../core/DataStore";
import type { TownBuildingDef } from "../core/townBuildingTypes";
import { createNewSave } from "../core/GameState";
import {
  formatTownBuildingButtonLabel,
  handleTownBuildingTap,
  townBuildingSubtitle,
} from "./townBuildingMenu";

describe("townBuildingMenu", () => {
  const store = new DataStore();
  store.buildings = {
    wall: {
      maxLevel: 5,
      costByLevel: [50, 80],
      effect: "wallHpMax",
    },
    blacksmith: {
      maxLevel: 3,
      costByLevel: [100],
      effect: "playerDamage",
    },
  };

  it("uses honest subtitle when no upgrade hook", () => {
    const def: TownBuildingDef = {
      label: "Haunted Well",
      textureKey: "town_special_haunted_well",
      width: 80,
      height: 80,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe(
      "— Not available yet",
    );
    expect(formatTownBuildingButtonLabel(def, "— Not available yet")).toBe(
      "Haunted Well\n— Not available yet",
    );
  });

  it("tap without upgradeId is a noop", () => {
    const def: TownBuildingDef = {
      label: "Gallows Square",
      textureKey: "town_special_gallows_square",
      width: 112,
      height: 72,
    };
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("noop");
  });

  it("applies upgrade when upgradeId is set", () => {
    const def: TownBuildingDef = {
      label: "Town Wall",
      textureKey: "town_wall",
      width: 128,
      height: 56,
      upgradeId: "wall",
    };
    const save = createNewSave();
    save.gold = 200;
    const { save: next, result } = handleTownBuildingTap(store, save, def);
    expect(result.kind).toBe("upgraded");
    expect(next.buildings.wall).toBe(1);
    expect(next.gold).toBe(150);
  });
});