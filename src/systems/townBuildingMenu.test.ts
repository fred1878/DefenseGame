import { describe, expect, it } from "vitest";
import { DataStore } from "../core/DataStore";
import type { TownBuildingDef } from "../core/townBuildingTypes";
import { createNewSave } from "../core/GameState";
import {
  formatTownBuildingButtonLabel,
  handleTownBuildingTap,
  townBuildingSubtitle,
  upgradeShop,
} from "./townBuildingMenu";

describe("townBuildingMenu", () => {
  const store = new DataStore();
  store.buildings = {
    wall: {
      maxLevel: 5,
      costByLevel: [50, 80],
      effect: "wallHpMax",
    },
  };

  it("wave planner building opens panel on tap", () => {
    const def: TownBuildingDef = {
      label: "Plague Clinic",
      textureKey: "town_special_plague_clinic",
      width: 96,
      height: 96,
      opensWavePlanner: true,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe(
      "— Wave planner",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openWavePlanner");
  });

  it("save menu building opens panel on tap", () => {
    const def: TownBuildingDef = {
      label: "Market Stall (Daylit)",
      textureKey: "town_market_stall_daylit",
      width: 112,
      height: 72,
      opensSaveMenu: true,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe("— Saves");
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openSaveMenu");
  });

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

  it("shop buildings open the trader or blacksmith", () => {
    for (const shop of ["trader", "blacksmith"] as const) {
      const def: TownBuildingDef = {
        label: "Shop",
        textureKey: "town_market_stall",
        width: 10,
        height: 10,
        opensShop: shop,
      };
      expect(townBuildingSubtitle(store, createNewSave(), def)).toBe(
        shop === "trader" ? "— Trader" : "— Blacksmith",
      );
      const { result } = handleTownBuildingTap(store, createNewSave(), def);
      expect(result).toEqual({ kind: "openShop", shop, message: "" });
    }
  });

  it("formats wall upgrade subtitles like legacy town UI", () => {
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
  });

  it("spell bar building shows subtitle and opens spell bar on tap", () => {
    const def: TownBuildingDef = {
      label: "Witchlight Beacon (Daylit)",
      textureKey: "town_special_witchlight_beacon_daylit",
      width: 80,
      height: 112,
      opensSpellBar: true,
    };
    expect(townBuildingSubtitle(store, createNewSave(), def)).toBe(
      "— Spell bar",
    );
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
      label: "Witchlight Beacon (Night)",
      textureKey: "town_special_witchlight_beacon",
      width: 80,
      height: 112,
      upgradeId: "wall",
    };
    const save = createNewSave();
    save.gold = 10;
    const { result } = handleTownBuildingTap(store, save, def);
    expect(result.kind).toBe("blocked");
    expect(result.message).toContain("Need 50g");
  });

  it("allows upgrade when debug infinite gold is on", () => {
    const def: TownBuildingDef = {
      label: "Witchlight Beacon (Night)",
      textureKey: "town_special_witchlight_beacon",
      width: 80,
      height: 112,
      upgradeId: "wall",
    };
    const save = createNewSave();
    save.gold = 10;
    const storeReg: Record<string, unknown> = { debugInfiniteGold: true };
    const registry = {
      get: (k: string) => storeReg[k],
      set: (k: string, v: unknown) => {
        storeReg[k] = v;
      },
    } as Phaser.Data.DataManager;
    const { result } = handleTownBuildingTap(store, save, def, registry);
    expect(result.kind).toBe("upgraded");
  });

  it("covers max-level, missing hook, and generic upgrade copy", () => {
    store.buildings.workshop = {
      maxLevel: 1,
      costByLevel: [25],
      effect: "customBoost",
    };
    const save = createNewSave();
    const missingHook: TownBuildingDef = {
      label: "Ruins",
      textureKey: "town_ruins",
      width: 40,
      height: 40,
      upgradeId: "missing",
    };
    expect(townBuildingSubtitle(store, save, missingHook)).toBe(
      "— Not available yet",
    );
    expect(handleTownBuildingTap(store, save, missingHook).result.kind).toBe(
      "noop",
    );

    const wallDef: TownBuildingDef = {
      label: "Wall",
      textureKey: "town_wall",
      width: 10,
      height: 10,
      upgradeId: "wall",
    };
    save.buildings.wall = 5;
    expect(townBuildingSubtitle(store, save, wallDef)).toContain("Wall max");

    const shopDef: TownBuildingDef = {
      label: "Workshop",
      textureKey: "town_workshop",
      width: 10,
      height: 10,
      upgradeId: "workshop",
    };
    expect(townBuildingSubtitle(store, save, shopDef)).toBe(
      "— Upgrade (workshop L0, next 25g)",
    );
    save.buildings.workshop = 1;
    expect(townBuildingSubtitle(store, save, shopDef)).toBe(
      "— customBoost · max level",
    );
    expect(handleTownBuildingTap(store, save, shopDef).result.kind).toBe(
      "blocked",
    );

    store.buildings.workshop = {
      maxLevel: 3,
      costByLevel: [25],
      effect: "customBoost",
    };
    save.buildings.workshop = 1;
    expect(townBuildingSubtitle(store, save, shopDef)).toBe("— customBoost");
    expect(handleTownBuildingTap(store, save, shopDef).result.message).toBe(
      "Upgrade unavailable",
    );

    store.buildings.workshop = {
      maxLevel: 3,
      costByLevel: [25, 40],
      effect: "customBoost",
    };
    save.gold = 40;
    save.buildings.workshop = 1;
    const upgraded = handleTownBuildingTap(store, save, shopDef);
    expect(upgraded.result.kind).toBe("upgraded");
    expect(upgraded.result.message).toBe("Upgraded to L2");
    expect(formatTownBuildingButtonLabel(shopDef, "— customBoost")).toBe(
      "Workshop\n— customBoost",
    );

    const wallMaxTap = handleTownBuildingTap(store, save, wallDef);
    expect(wallMaxTap.result.kind).toBe("blocked");
  });

  it("treats missing upgrade levels as zero", () => {
    store.buildings.training = {
      maxLevel: 2,
      costByLevel: [15, 30],
      effect: "luck",
    };
    const def: TownBuildingDef = {
      label: "Yard",
      textureKey: "town_yard",
      width: 10,
      height: 10,
      upgradeId: "training",
    };
    const save = createNewSave();
    save.gold = 20;
    expect(townBuildingSubtitle(store, save, def)).toContain("next 15g");
    const { result, save: next } = handleTownBuildingTap(store, save, def);
    expect(result.kind).toBe("upgraded");
    expect(result.message).toBe("Upgraded to L1");
    expect(next.buildings.training).toBe(1);

    const wall = store.buildings.wall!;
    const wallCosts = wall.costByLevel;
    wall.costByLevel = [];
    const wallDef: TownBuildingDef = {
      label: "Wall",
      textureKey: "town_wall",
      width: 10,
      height: 10,
      upgradeId: "wall",
    };
    save.buildings.wall = 0;
    expect(townBuildingSubtitle(store, save, wallDef)).toBe(
      "— Upgrade wall (L0)",
    );
    wall.costByLevel = wallCosts;
  });
});

describe("townBuildingSubtitle upgrade labels", () => {
  it("labels a maxed generic upgrade by its effect", () => {
    const menuStore = new DataStore();
    menuStore.buildings = {
      market: {
        maxLevel: 1,
        costByLevel: [10],
        effect: "playerDamage",
      },
      shrine: {
        maxLevel: 1,
        costByLevel: [10],
        effect: "luck",
      },
    };
    const market: TownBuildingDef = {
      label: "Market",
      textureKey: "town_market",
      width: 80,
      height: 80,
      upgradeId: "market",
    };
    const shrine: TownBuildingDef = {
      label: "Shrine",
      textureKey: "town_shrine",
      width: 80,
      height: 80,
      upgradeId: "shrine",
    };
    const save = createNewSave();
    save.buildings.market = 1;
    save.buildings.shrine = 1;
    expect(townBuildingSubtitle(menuStore, save, market)).toBe(
      "— playerDamage · max level",
    );
    expect(townBuildingSubtitle(menuStore, save, shrine)).toBe(
      "— luck · max level",
    );
  });
});

describe("shop upgrades", () => {
  const buildings = {
    trader: { maxLevel: 2, costByLevel: [90, 160], effect: "shopLevel" },
  };

  it("buys a shop level, clears that shop's stock and shows it in the subtitle", () => {
    const save = createNewSave();
    save.gold = 100;
    save.shops = { trader: [], blacksmith: [] };
    const r = upgradeShop(buildings, save, "trader");
    expect(r.result).toEqual({ kind: "upgraded", message: "Upgraded to L1" });
    expect(r.save.gold).toBe(10);
    expect(r.save.buildings.trader).toBe(1);
    expect(r.save.shops).toEqual({ trader: null, blacksmith: [] });
    const store = new DataStore();
    const def: TownBuildingDef = {
      label: "Market Stall (Night)",
      textureKey: "town_market_stall",
      width: 112,
      height: 72,
      opensShop: "trader",
    };
    expect(townBuildingSubtitle(store, r.save, def)).toBe("— Trader L1");
    expect(upgradeShop(buildings, r.save, "trader").result.message).toBe(
      "Need 160g (have 10g)",
    );
    r.save.buildings.trader = 2;
    expect(upgradeShop(buildings, r.save, "trader").result.message).toBe(
      "Shop — max level",
    );
    expect(upgradeShop(buildings, save, "blacksmith").result).toEqual({
      kind: "blocked",
      message: "Upgrade unavailable",
    });
  });
});
