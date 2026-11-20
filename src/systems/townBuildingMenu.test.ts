import { describe, expect, it } from "vitest";
import { DataStore } from "../core/DataStore";
import type { TownBuildingDef } from "../core/townBuildingTypes";
import { createNewSave } from "../core/GameState";
import { handleTownBuildingTap, townBuildingSubtitle } from "./townBuildingMenu";

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
      costByLevel: [100, 200, 350],
      effect: "playerDamage",
    },
  };

  it("endless training building opens panel on tap", () => {
    const def: TownBuildingDef = {
      label: "Haunted Well",
      textureKey: "town_special_haunted_well",
      width: 80,
      height: 80,
      opensEndlessMode: true,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe(
      "— Endless training",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openEndlessMode");
  });

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
    expect(next.townWallHpMax).toBe(150);
    expect(next.townWallHp).toBe(150);
  });

  it("raises current wall HP by the same delta as max on upgrade", () => {
    const def: TownBuildingDef = {
      label: "Town Wall",
      textureKey: "town_wall",
      width: 128,
      height: 56,
      upgradeId: "wall",
    };
    const save = createNewSave();
    save.gold = 500;
    save.townWallHp = 70;
    save.townWallHpMax = 100;
    const { save: next } = handleTownBuildingTap(store, save, def);
    expect(next.townWallHpMax).toBe(150);
    expect(next.townWallHp).toBe(120);
  });

  it("formats wall and smith upgrade subtitles like legacy town UI", () => {
    const save = createNewSave();
    save.gold = 40;
    const wallDef: TownBuildingDef = {
      label: "Witchlight Beacon (Night)",
      textureKey: "town_special_witchlight_beacon",
      width: 80,
      height: 112,
      upgradeId: "wall",
    };
    expect(townBuildingSubtitle(store, save, wallDef)).toBe(
      "— Upgrade wall (L0, next 50g)",
    );

    save.buildings.blacksmith = 1;
    const smithDef: TownBuildingDef = {
      label: "Moon Brazier",
      textureKey: "town_special_moon_brazier",
      width: 80,
      height: 80,
      upgradeId: "blacksmith",
    };
    expect(townBuildingSubtitle(store, save, smithDef)).toBe(
      "— Upgrade smith (L1, damage x1.10, next 200g)",
    );
  });

  it("spell bar building shows subtitle and opens spell bar on tap", () => {
    const def: TownBuildingDef = {
      label: "Witchlight Beacon (Daylit)",
      textureKey: "town_special_witchlight_beacon_daylit",
      width: 80,
      height: 112,
      opensSpellBar: true,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe("— Spell bar");
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openSpellBar");
  });

  it("start night building returns startNight tap result", () => {
    const def: TownBuildingDef = {
      label: "Gallows Square",
      textureKey: "town_special_gallows_square",
      width: 112,
      height: 72,
      startsNight: true,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe(
      "— Start night",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("startNight");
  });

  it("blocks upgrade when gold is insufficient", () => {
    const def: TownBuildingDef = {
      label: "Moon Brazier",
      textureKey: "town_special_moon_brazier",
      width: 80,
      height: 80,
      upgradeId: "blacksmith",
    };
    const save = createNewSave();
    save.gold = 10;
    const { result } = handleTownBuildingTap(store, save, def);
    expect(result.kind).toBe("blocked");
    expect(result.message).toContain("Need 100g");
  });
});