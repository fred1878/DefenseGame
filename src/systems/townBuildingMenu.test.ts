import { describe, expect, it } from "vitest";
import { debugEconomyPolicy } from "../debug/debugEconomy";
import { DataStore } from "../core/data/DataStore";
import type { TownBuildingDef } from "../core/data/townBuildingTypes";
import { createNewSave } from "../core/save/GameState";
import {
  handleTownBuildingTap,
  townBuildingPlateInfo,
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
      width: 96,
      height: 96,
      opensWavePlanner: true,
    };
    expect(townBuildingPlateInfo(store, createNewSave(), def).action).toBe(
      "Wave plan",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openWavePlanner");
  });

  it("save menu building opens panel on tap", () => {
    const def: TownBuildingDef = {
      label: "Daylit Market",
      width: 112,
      height: 72,
      opensSaveMenu: true,
    };
    expect(townBuildingPlateInfo(store, createNewSave(), def).action).toBe(
      "Save",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openSaveMenu");
  });

  it("endless training building opens panel on tap", () => {
    const def: TownBuildingDef = {
      label: "Haunted Well",
      width: 80,
      height: 80,
      opensEndlessMode: true,
    };
    expect(townBuildingPlateInfo(store, createNewSave(), def).action).toBe(
      "Endless",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openEndlessMode");
  });

  it("uses an honest plate action when no upgrade hook", () => {
    const def: TownBuildingDef = {
      label: "Haunted Well",
      width: 80,
      height: 80,
    };
    expect(townBuildingPlateInfo(store, createNewSave(), def)).toEqual({
      name: "Haunted Well",
      action: "Not available yet",
    });
  });

  it("tap without upgradeId is a noop", () => {
    const def: TownBuildingDef = {
      label: "Gallows Square",
      width: 112,
      height: 72,
    };
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("noop");
  });

  it("applies upgrade when upgradeId is set", () => {
    const def: TownBuildingDef = {
      label: "Town Wall",
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
        width: 10,
        height: 10,
        opensShop: shop,
      };
      expect(townBuildingPlateInfo(store, createNewSave(), def).action).toBe(
        shop === "trader" ? "Trader" : "Blacksmith",
      );
      const { result } = handleTownBuildingTap(store, createNewSave(), def);
      expect(result).toEqual({ kind: "openShop", shop, message: "" });
    }
  });

  it("shows wall level and max on the beacon plate", () => {
    const save = createNewSave();
    save.gold = 40;
    const wallDef: TownBuildingDef = {
      label: "Witchlight Beacon",
      width: 80,
      height: 112,
      upgradeId: "wall",
    };
    expect(townBuildingPlateInfo(store, save, wallDef)).toEqual({
      name: "Witchlight Beacon",
      action: "Wall",
      level: 0,
      maxLevel: 5,
      upgradeReady: false,
    });
  });

  it("spell bar building shows its plate action and opens spell bar on tap", () => {
    const def: TownBuildingDef = {
      label: "Daylit Beacon",
      width: 80,
      height: 112,
      opensSpellBar: true,
    };
    expect(townBuildingPlateInfo(store, createNewSave(), def).action).toBe(
      "Spells",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("openSpellBar");
  });

  it("start night building returns startNight tap result", () => {
    const def: TownBuildingDef = {
      label: "Gallows Square",
      width: 112,
      height: 72,
      startsNight: true,
    };
    expect(townBuildingPlateInfo(store, createNewSave(), def).action).toBe(
      "Start night",
    );
    const { result } = handleTownBuildingTap(store, createNewSave(), def);
    expect(result.kind).toBe("startNight");
  });

  it("blocks upgrade when gold is insufficient", () => {
    const def: TownBuildingDef = {
      label: "Witchlight Beacon",
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
      label: "Witchlight Beacon",
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
    const { result } = handleTownBuildingTap(
      store,
      save,
      def,
      debugEconomyPolicy(registry),
    );
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
      width: 40,
      height: 40,
      upgradeId: "missing",
    };
    expect(townBuildingPlateInfo(store, save, missingHook)).toEqual({
      name: "Ruins",
      action: "Upgrade",
    });
    expect(handleTownBuildingTap(store, save, missingHook).result.kind).toBe(
      "noop",
    );

    const wallDef: TownBuildingDef = {
      label: "Wall",
      width: 10,
      height: 10,
      upgradeId: "wall",
    };
    save.buildings.wall = 5;
    expect(townBuildingPlateInfo(store, save, wallDef)).toMatchObject({
      level: 5,
      maxLevel: 5,
      upgradeReady: false,
    });

    const shopDef: TownBuildingDef = {
      label: "Workshop",
      width: 10,
      height: 10,
      upgradeId: "workshop",
    };
    expect(townBuildingPlateInfo(store, save, shopDef)).toMatchObject({
      action: "Upgrade",
      level: 0,
      maxLevel: 1,
      upgradeReady: false,
    });
    save.buildings.workshop = 1;
    expect(townBuildingPlateInfo(store, save, shopDef)).toMatchObject({
      level: 1,
      maxLevel: 1,
      upgradeReady: false,
    });
    expect(handleTownBuildingTap(store, save, shopDef).result.kind).toBe(
      "blocked",
    );

    store.buildings.workshop = {
      maxLevel: 3,
      costByLevel: [25],
      effect: "customBoost",
    };
    save.buildings.workshop = 1;
    expect(townBuildingPlateInfo(store, save, shopDef)).toMatchObject({
      level: 1,
      maxLevel: 3,
      upgradeReady: false,
    });
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
      width: 10,
      height: 10,
      upgradeId: "training",
    };
    const save = createNewSave();
    save.gold = 20;
    expect(townBuildingPlateInfo(store, save, def).upgradeReady).toBe(true);
    const { result, save: next } = handleTownBuildingTap(store, save, def);
    expect(result.kind).toBe("upgraded");
    expect(result.message).toBe("Upgraded to L1");
    expect(next.buildings.training).toBe(1);

    const wall = store.buildings.wall!;
    const wallCosts = wall.costByLevel;
    wall.costByLevel = [];
    const wallDef: TownBuildingDef = {
      label: "Wall",
      width: 10,
      height: 10,
      upgradeId: "wall",
    };
    save.buildings.wall = 0;
    expect(townBuildingPlateInfo(store, save, wallDef).upgradeReady).toBe(
      false,
    );
    wall.costByLevel = wallCosts;
  });
});

describe("townBuildingPlateInfo upgrade levels", () => {
  it("shows maxed generic upgrades without an upgrade arrow", () => {
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
      width: 80,
      height: 80,
      upgradeId: "market",
    };
    const shrine: TownBuildingDef = {
      label: "Shrine",
      width: 80,
      height: 80,
      upgradeId: "shrine",
    };
    const save = createNewSave();
    save.buildings.market = 1;
    save.buildings.shrine = 1;
    expect(townBuildingPlateInfo(menuStore, save, market)).toMatchObject({
      level: 1,
      maxLevel: 1,
      upgradeReady: false,
    });
    expect(townBuildingPlateInfo(menuStore, save, shrine)).toMatchObject({
      level: 1,
      maxLevel: 1,
      upgradeReady: false,
    });
  });
});

describe("shop upgrades", () => {
  const buildings = {
    trader: { maxLevel: 2, costByLevel: [90, 160], effect: "shopLevel" },
  };

  it("buys a shop level, clears that shop's stock and shows it on the plate", () => {
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
      label: "Night Market",
      width: 112,
      height: 72,
      opensShop: "trader",
    };
    expect(townBuildingPlateInfo(store, r.save, def)).toEqual({
      name: "Night Market",
      action: "Trader",
    });
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
