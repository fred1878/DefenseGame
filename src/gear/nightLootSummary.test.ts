import { describe, expect, it } from "vitest";
import { createNewSave } from "../core/GameState";
import { gearFixture } from "../test/gearFixture";
import type { ItemDraft } from "./itemGen";
import type { LootConfig } from "./loot";
import {
  assembleNightLootSummary,
  campaignNightFinalWallHp,
  campaignNightGoldEarned,
  CAMPAIGN_WIN_WALL_PENALTY,
  isNightSummaryReturnKey,
  resolveCampaignNightEnd,
  soldLootNote,
  wallHpBarFill,
} from "./nightLootSummary";

const catalog = gearFixture();

const draft = (
  baseId: string,
  rarity: ItemDraft["rarity"] = "common",
): ItemDraft => ({
  baseId,
  rarity,
  itemLevel: 1,
  affixes: [],
});

const loot = (capacity: number): LootConfig => ({
  inventoryCapacity: capacity,
  sellBackPct: 50,
  tables: {},
});

describe("campaign night gold and wall", () => {
  it("pays the full reward on a win and a quarter on a loss", () => {
    expect(campaignNightGoldEarned(true, 40)).toBe(40);
    expect(campaignNightGoldEarned(false, 40)).toBe(10);
    expect(campaignNightGoldEarned(false, 41)).toBe(10);
  });

  it("applies the win wear penalty and floors at zero", () => {
    expect(CAMPAIGN_WIN_WALL_PENALTY).toBe(2);
    expect(campaignNightFinalWallHp(true, 80)).toBe(78);
    expect(campaignNightFinalWallHp(false, 80)).toBe(80);
    expect(campaignNightFinalWallHp(true, 1)).toBe(0);
    expect(campaignNightFinalWallHp(false, -3)).toBe(0);
  });
});

describe("wallHpBarFill and soldLootNote", () => {
  it("uses green, amber and red bands", () => {
    expect(wallHpBarFill(1)).toBe(0x4ade80);
    expect(wallHpBarFill(0.51)).toBe(0x4ade80);
    expect(wallHpBarFill(0.5)).toBe(0xfbbf24);
    expect(wallHpBarFill(0.26)).toBe(0xfbbf24);
    expect(wallHpBarFill(0.25)).toBe(0xf87171);
    expect(wallHpBarFill(0)).toBe(0xf87171);
  });

  it("describes overflow sales, or nothing when nothing was sold", () => {
    expect(soldLootNote(0, 12)).toBeNull();
    expect(soldLootNote(1, 12)).toBe(
      "1 item auto-sold because the bag was full (12 gold)",
    );
    expect(soldLootNote(2, 18)).toBe(
      "2 items auto-sold because the bag was full (18 gold)",
    );
  });
});

describe("isNightSummaryReturnKey", () => {
  it("accepts Enter and Space once, not key repeat", () => {
    expect(isNightSummaryReturnKey({ code: "Enter" })).toBe(true);
    expect(isNightSummaryReturnKey({ code: "NumpadEnter" })).toBe(true);
    expect(isNightSummaryReturnKey({ code: "Space" })).toBe(true);
    expect(isNightSummaryReturnKey({ key: "Enter" })).toBe(true);
    expect(isNightSummaryReturnKey({ key: " " })).toBe(true);
    expect(isNightSummaryReturnKey({ code: "Enter", repeat: true })).toBe(
      false,
    );
    expect(isNightSummaryReturnKey({ code: "Escape" })).toBe(false);
    expect(isNightSummaryReturnKey({})).toBe(false);
  });
});

describe("assembleNightLootSummary", () => {
  it("builds a won summary with rarity-coloured loot", () => {
    const summary = assembleNightLootSummary({
      won: true,
      night: 3,
      goldEarned: 40,
      goldTotal: 120,
      wallHp: 82,
      wallHpMax: 100,
      wallDamage: 18,
      drops: [draft("cap", "magic"), draft("band", "rare")],
      soldCount: 0,
      soldGold: 0,
      bagFreeSlots: 4,
      catalog,
    });
    expect(summary.headline).toBe("Night 3 defended!");
    expect(summary.flavor).toBe("Dawn breaks over the settlement.");
    expect(summary.goldEarnedText).toBe("+40 gold");
    expect(summary.goldTotalText).toBe("120 gold");
    expect(summary.emptyLootText).toBeNull();
    expect(summary.soldNote).toBeNull();
    expect(summary.wallText).toBe("82 / 100 HP");
    expect(summary.wallRatio).toBeCloseTo(0.82);
    expect(summary.wallFill).toBe(0x4ade80);
    expect(summary.items).toEqual([
      {
        name: "Cap",
        rarityLabel: "Magic",
        color: "#0000ff",
        sold: false,
      },
      {
        name: "Band",
        rarityLabel: "Rare",
        color: "#ffff00",
        sold: false,
      },
    ]);
  });

  it("marks overflow drops as sold, skips unknown bases, and handles a lost night", () => {
    const summary = assembleNightLootSummary({
      won: false,
      night: 2,
      goldEarned: 10,
      goldTotal: 10,
      wallHp: 0,
      wallHpMax: 150,
      wallDamage: 150,
      drops: [draft("cap"), draft("ghost"), draft("band")],
      soldCount: 2,
      soldGold: 8,
      bagFreeSlots: 1,
      catalog,
    });
    expect(summary.headline).toBe("Night 2 lost");
    expect(summary.flavor).toBe("Scouts recover what they can.");
    expect(summary.emptyLootText).toBeNull();
    expect(summary.soldNote).toBe(
      "2 items auto-sold because the bag was full (8 gold)",
    );
    expect(summary.wallText).toBe("0 / 150 HP");
    expect(summary.wallRatio).toBe(0);
    expect(summary.wallFill).toBe(0xf87171);
    // "ghost" is not a fixture base, so it is omitted.
    expect(summary.items.map((i) => `${i.name}:${i.sold}`)).toEqual([
      "Cap:false",
      "Band:true",
    ]);
  });

  it("shows an empty-loot line and clamps a missing wall max", () => {
    const summary = assembleNightLootSummary({
      won: true,
      night: 1,
      goldEarned: 0,
      goldTotal: 0,
      wallHp: 5,
      wallHpMax: 0,
      wallDamage: 0,
      drops: [],
      soldCount: 0,
      soldGold: 0,
      bagFreeSlots: 0,
      catalog,
    });
    expect(summary.items).toEqual([]);
    expect(summary.emptyLootText).toBe("No loot this night.");
    expect(summary.wallRatio).toBe(0);
    expect(summary.wallText).toBe("5 / 0 HP");
  });
});

describe("resolveCampaignNightEnd", () => {
  it("applies a win: gold, night advance, wall wear, and bag drops", () => {
    const save = createNewSave();
    save.gold = 20;
    save.night = 3;
    save.townWallHp = 100;
    save.townWallHpMax = 100;
    const resolved = resolveCampaignNightEnd({
      won: true,
      wallHp: 80,
      wallHpStart: 100,
      rewardGold: 40,
      save,
      drops: [draft("cap", "magic")],
      catalog,
      loot: loot(8),
    });
    expect(resolved.result.goldEarned).toBe(40);
    expect(resolved.result.night).toBe(3);
    expect(resolved.result.wallDamage).toBe(22);
    expect(resolved.save.night).toBe(4);
    expect(resolved.save.gold).toBe(60);
    expect(resolved.save.townWallHp).toBe(78);
    expect(resolved.save.shops.trader).toBeNull();
    expect(resolved.save.gear.items).toHaveLength(1);
    expect(resolved.save.gear.items[0]?.baseId).toBe("cap");
    expect(resolved.soldCount).toBe(0);
    expect(resolved.summary.headline).toBe("Night 3 defended!");
    expect(resolved.summary.goldTotalText).toBe("60 gold");
    expect(resolved.summary.wallText).toBe("78 / 100 HP");
    expect(resolved.summary.items[0]?.name).toBe("Cap");
    expect(resolved.summary.items[0]?.sold).toBe(false);
  });

  it("pays a loss quarter-reward, keeps the night, and records auto-sold loot", () => {
    const save = createNewSave();
    save.gold = 4;
    save.night = 2;
    save.townWallHp = 40;
    save.townWallHpMax = 150;
    const resolved = resolveCampaignNightEnd({
      won: false,
      wallHp: 0,
      wallHpStart: 40,
      rewardGold: 41,
      save,
      drops: [draft("cap"), draft("band")],
      catalog,
      loot: loot(0),
    });
    expect(resolved.result.goldEarned).toBe(10);
    expect(resolved.save.night).toBe(2);
    expect(resolved.soldCount).toBe(2);
    expect(resolved.soldGold).toBeGreaterThan(0);
    expect(resolved.save.gold).toBe(4 + 10 + resolved.soldGold);
    expect(resolved.save.gear.items).toEqual([]);
    expect(resolved.summary.headline).toBe("Night 2 lost");
    expect(resolved.summary.soldNote).toContain("2 items auto-sold");
    expect(resolved.summary.soldNote).toContain(`${resolved.soldGold} gold`);
    expect(resolved.summary.items.every((i) => i.sold)).toBe(true);
    expect(resolved.summary.wallText).toBe("0 / 150 HP");
  });

  it("keeps the first drop when one bag slot is free and sells the rest", () => {
    const save = createNewSave();
    const resolved = resolveCampaignNightEnd({
      won: true,
      wallHp: 50,
      wallHpStart: 50,
      rewardGold: 8,
      save,
      drops: [draft("cap"), draft("band")],
      catalog,
      loot: loot(1),
    });
    expect(resolved.save.gear.items.map((i) => i.baseId)).toEqual(["cap"]);
    expect(resolved.soldCount).toBe(1);
    expect(resolved.summary.items.map((i) => `${i.name}:${i.sold}`)).toEqual([
      "Cap:false",
      "Band:true",
    ]);
  });
});
