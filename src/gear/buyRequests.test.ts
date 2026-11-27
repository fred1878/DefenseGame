import { describe, expect, it } from "vitest";
import itemsRaw from "../../public/data/items.json";
import { createNewSave } from "../core/save/GameState";
import { normalizeItems } from "../core/data/normalizeItems";
import type { SaveGame } from "../core/save/saveTypes";
import {
  describeRequest,
  fillBuyRequest,
  normalizeSaveRequests,
  requestMatches,
  requestMatchesInBag,
  requestPayout,
  rollBuyRequests,
  type BuyRequest,
  type BuyRequestsConfig,
} from "./buyRequests";
import type { GearCatalog, ItemInstance } from "./gearTypes";
import { resolveItem } from "./itemStats";
import { createRng } from "./rng";

const catalog = normalizeItems(itemsRaw);
const config: BuyRequestsConfig = {
  payoutPct: 150,
  kindWeights: { base: 1, type: 1, unique: 1 },
  minRarityWeights: { magic: 1, rare: 1 },
};

function item(
  uid: number,
  baseId: string,
  rarity: ItemInstance["rarity"] = "common",
  uniqueId?: string,
): ItemInstance {
  return {
    uid,
    baseId,
    rarity,
    itemLevel: 3,
    affixes: [],
    ...(uniqueId ? { uniqueId } : {}),
  };
}

function saveWith(items: ItemInstance[], requests: BuyRequest[]): SaveGame {
  const s = createNewSave();
  s.gold = 10;
  s.gear = { items, equipped: {}, nextUid: items.length + 1 };
  s.shops = { trader: null, blacksmith: null, requests };
  return s;
}

const resolved = (i: ItemInstance) => resolveItem(catalog, i)!;

describe("buyRequests", () => {
  it("rolls deterministic requests of every kind from the whole pool", () => {
    const a = rollBuyRequests(catalog, config, 40, createRng(3));
    expect(a).toEqual(rollBuyRequests(catalog, config, 40, createRng(3)));
    expect(new Set(a.map((r) => r.kind))).toEqual(
      new Set(["base", "type", "unique"]),
    );
    for (const r of a) {
      if (r.kind === "base") expect(catalog.bases[r.baseId]).toBeDefined();
      if (r.kind === "unique")
        expect(catalog.uniques[r.uniqueId]).toBeDefined();
      if (r.kind === "type") expect(["magic", "rare"]).toContain(r.minRarity);
    }
  });

  it("avoids duplicates where the pool allows and skips empty kinds", () => {
    const tiny: GearCatalog = {
      ...catalog,
      bases: { rusty_sword: catalog.bases.rusty_sword! },
      uniques: {},
    };
    const only = rollBuyRequests(
      tiny,
      { ...config, kindWeights: { base: 1, type: 0, unique: 5 } },
      3,
      createRng(1),
    );
    // One base in the pool: duplicates are kept after the retries run out.
    expect(only).toEqual([
      { kind: "base", baseId: "rusty_sword" },
      { kind: "base", baseId: "rusty_sword" },
      { kind: "base", baseId: "rusty_sword" },
    ]);
    const typed = rollBuyRequests(
      tiny,
      {
        ...config,
        kindWeights: { base: 0, type: 1, unique: 0 },
        minRarityWeights: {},
      },
      1,
      createRng(1),
    );
    expect(typed).toEqual([
      {
        kind: "type",
        itemType: tiny.bases.rusty_sword!.type,
        minRarity: "magic",
      },
    ]);
    const empty: GearCatalog = { ...catalog, bases: {}, uniques: {} };
    expect(rollBuyRequests(empty, config, 2, createRng(1))).toEqual([]);
  });

  it("matches by base, unique and type + minimum rarity", () => {
    const uniqueId = Object.keys(catalog.uniques)[0]!;
    const unique = catalog.uniques[uniqueId]!;
    const u = resolved(item(1, unique.baseId, "legendary", uniqueId));
    expect(requestMatches({ kind: "unique", uniqueId }, u)).toBe(true);
    expect(requestMatches({ kind: "base", baseId: unique.baseId }, u)).toBe(
      true,
    );
    const ring = resolved(item(2, "copper_ring", "magic"));
    const type = catalog.bases.copper_ring!.type;
    expect(
      requestMatches(
        { kind: "type", itemType: type, minRarity: "magic" },
        ring,
      ),
    ).toBe(true);
    expect(
      requestMatches({ kind: "type", itemType: type, minRarity: "rare" }, ring),
    ).toBe(false);
    expect(requestMatches({ kind: "unique", uniqueId }, ring)).toBe(false);
  });

  it("pays a percent of item value, at least 1g", () => {
    const r = resolved(item(1, "rusty_sword"));
    expect(requestPayout(r, config)).toBe(Math.round(r.price * 1.5));
    expect(requestPayout(r, { ...config, payoutPct: 0 })).toBe(1);
  });

  it("describes requests with rarity labels", () => {
    expect(
      describeRequest(catalog, { kind: "base", baseId: "rusty_sword" }).name,
    ).toBe(catalog.bases.rusty_sword!.name);
    expect(
      describeRequest(catalog, { kind: "base", baseId: "nope" }).name,
    ).toBe("Unknown item");
    const uniqueId = Object.keys(catalog.uniques)[0]!;
    expect(describeRequest(catalog, { kind: "unique", uniqueId })).toEqual({
      name: catalog.uniques[uniqueId]!.name,
      color: catalog.rarities.legendary.color,
    });
    expect(
      describeRequest(catalog, { kind: "unique", uniqueId: "nope" }).name,
    ).toBe("Unknown unique");
    expect(
      describeRequest(catalog, {
        kind: "type",
        itemType: "ring",
        minRarity: "rare",
      }).name,
    ).toBe(`${catalog.rarities.rare.label}+ Ring`);
    expect(
      describeRequest(catalog, {
        kind: "type",
        itemType: "ring",
        minRarity: "legendary",
      }).name,
    ).toBe(`${catalog.rarities.legendary.label} Ring`);
  });

  it("sells the best matching bag item and uses up the request", () => {
    const requests: BuyRequest[] = [
      { kind: "base", baseId: "rusty_sword" },
      { kind: "base", baseId: "copper_ring" },
    ];
    const cheap = item(1, "rusty_sword");
    const pricey = item(2, "rusty_sword", "rare");
    const equipped = item(3, "rusty_sword", "epic");
    const save = saveWith([cheap, pricey, equipped], requests);
    save.gear.equipped = { meleeWeapon: 3 };
    expect(
      requestMatchesInBag(save, catalog, requests[0]!).map((r) => r.item.uid),
    ).toEqual([2, 1]);
    const r = fillBuyRequest(save, catalog, config, 0);
    const gold = requestPayout(resolved(pricey), config);
    expect(r).toMatchObject({ ok: true, gold });
    expect(r.message).toBe(`Trader paid ${gold}g for ${resolved(pricey).name}`);
    expect(r.save.gold).toBe(10 + gold);
    expect(r.save.gear.items.map((i) => i.uid)).toEqual([1, 3]);
    expect(r.save.shops.requests).toEqual([requests[1]]);

    const none = fillBuyRequest(r.save, catalog, config, 0);
    expect(none).toMatchObject({
      ok: false,
      gold: 0,
      message: "No matching item in your bag",
    });
    expect(none.save).toBe(r.save);
    expect(fillBuyRequest(r.save, catalog, config, 5).message).toBe(
      "Request gone",
    );
    const noList = saveWith([], []);
    noList.shops = { trader: null, blacksmith: null };
    expect(fillBuyRequest(noList, catalog, config, 0).ok).toBe(false);
  });

  it("normalizes saved requests, dropping bad rows", () => {
    expect(normalizeSaveRequests(undefined)).toBeNull();
    expect(
      normalizeSaveRequests([
        { kind: "base", baseId: "rusty_sword" },
        { kind: "base" },
        { kind: "unique", uniqueId: "x" },
        { kind: "unique", uniqueId: 3 },
        { kind: "type", itemType: "ring", minRarity: "rare" },
        { kind: "type", itemType: "nope", minRarity: "rare" },
        { kind: "type", itemType: "ring", minRarity: "nope" },
        { kind: "other" },
        null,
        "x",
      ]),
    ).toEqual([
      { kind: "base", baseId: "rusty_sword" },
      { kind: "unique", uniqueId: "x" },
      { kind: "type", itemType: "ring", minRarity: "rare" },
    ]);
  });
});
