import { describe, expect, it } from "vitest";
import consumablesRaw from "../../../public/data/consumables.json";
import itemsRaw from "../../../public/data/items.json";
import lootRaw from "../../../public/data/loot.json";
import shopsRaw from "../../../public/data/shops.json";
import { createNewSave } from "../../core/save/GameState";
import { normalizeConsumables } from "../../core/data/normalizeConsumables";
import { normalizeItems } from "../../core/data/normalizeItems";
import { normalizeLoot } from "../../core/data/normalizeLoot";
import { normalizeShops } from "../../core/data/normalizeShops";
import type { SaveGame } from "../../core/save/saveTypes";
import type { BuyRequest } from "../../gear/buyRequests";
import type { ItemInstance } from "../../gear/gearTypes";
import type { ShopContext } from "../../gear/shops";
import {
  createGearPanelState,
  listEntries,
  reduceGearPanel,
  type GearPanelContext,
  type GearPanelState,
} from "./gearPanelLogic";
import {
  requestActions,
  requestCards,
  requestDetail,
  requestPayoutFor,
} from "./requestPanelLogic";
import { shopFootnote } from "./shopPanelView";

const catalog = normalizeItems(itemsRaw);
const loot = normalizeLoot(lootRaw);
const shopCtx: ShopContext = {
  catalog,
  consumables: normalizeConsumables(consumablesRaw),
  shops: normalizeShops(shopsRaw),
  loot,
};
const trader: GearPanelContext = {
  catalog,
  loot,
  shop: { id: "trader", ctx: shopCtx },
};
const smith: GearPanelContext = {
  catalog,
  loot,
  shop: { id: "blacksmith", ctx: shopCtx },
};
const plain: GearPanelContext = { catalog, loot };

const sword = (uid: number, rarity: ItemInstance["rarity"] = "common") => ({
  uid,
  baseId: "rusty_sword",
  rarity,
  itemLevel: 1,
  affixes: [],
});

const REQUESTS: BuyRequest[] = [
  { kind: "base", baseId: "rusty_sword" },
  { kind: "type", itemType: "ring", minRarity: "rare" },
  { kind: "unique", uniqueId: Object.keys(catalog.uniques)[0]! },
];

function save(items: ItemInstance[] = [sword(1), sword(2, "magic")]): SaveGame {
  const s = createNewSave();
  s.gold = 100;
  s.gear = { items, equipped: {}, nextUid: items.length + 1 };
  s.shops = { trader: [], blacksmith: [], requests: [...REQUESTS] };
  return s;
}

const wants = (selectedOffer: number | null = null): GearPanelState => ({
  ...createGearPanelState("requests"),
  selectedOffer,
});

describe("requestPanelLogic", () => {
  it("lists trader requests with the best bag match or a no-match hint", () => {
    const cards = requestCards(trader, save(), wants(0));
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      key: 0,
      name: "Rusty Sword",
      meta: "Any rarity · pays 150%",
      selected: true,
    });
    expect(cards[0]!.stat).toMatch(/^Your .*Rusty Sword$/);
    expect(cards[0]!.price).toMatch(/^\d+g$/);
    expect(cards[1]).toMatchObject({
      meta: "Any match · pays 150%",
      stat: "No match in your bag",
      price: "—",
      selected: false,
    });
    expect(cards[1]!.tile.icon).not.toBe("coins");
    expect(cards[2]!.meta).toBe("Unique · pays 150%");
    // Only the trader posts requests.
    expect(requestCards(smith, save(), wants())).toEqual([]);
    expect(requestCards(plain, save(), wants())).toEqual([]);
    const none = save();
    delete none.shops.requests;
    expect(requestCards(trader, none, wants())).toEqual([]);
    // A request for an unknown item still renders.
    const odd = save();
    odd.shops.requests = [
      { kind: "base", baseId: "ghost" },
      { kind: "unique", uniqueId: "ghost" },
    ];
    const oddCards = requestCards(trader, odd, wants());
    expect(oddCards.map((c) => c.tile.icon)).toEqual(["coins", "coins"]);
    expect(requestDetail(trader, odd, wants(0)).tile?.icon).toBe("coins");
  });

  it("details a request with matches, or explains requests when none is picked", () => {
    const idle = requestDetail(trader, save(), wants());
    expect(idle.name).toBe("Trader wants");
    expect(idle.info[0]).toMatch(/pays 150% of an item's value/);
    const d = requestDetail(trader, save(), wants(0));
    expect(d.name).toBe("Rusty Sword");
    expect(d.subline).toBe("Any rarity · pays 150% of the item's value");
    expect(d.info[0]).toMatch(/^In your bag: .+\(\d+g\), .+\(\d+g\)$/);
    const miss = requestDetail(trader, save(), wants(2));
    expect(miss.info).toEqual([
      "Nothing in your bag matches (equipped gear doesn't count).",
    ]);
    expect(requestDetail(trader, save(), wants(9)).name).toBe("Trader wants");
    expect(requestDetail(plain, save(), wants(0)).name).toBe("");
  });

  it("enables the sell action only with a bag match", () => {
    const payout = requestPayoutFor(trader, save(), 0)!;
    expect(payout).toBeGreaterThan(0);
    expect(requestActions(trader, save(), wants(0))).toEqual([
      expect.objectContaining({
        id: "fill",
        label: `Sell to trader · ${payout}g`,
        enabled: true,
      }),
    ]);
    expect(requestActions(trader, save(), wants(1))[0]).toMatchObject({
      label: "Sell to trader",
      enabled: false,
    });
    expect(requestPayoutFor(trader, save(), null)).toBeNull();
    expect(requestPayoutFor(trader, save(), 9)).toBeNull();
    expect(requestPayoutFor(plain, save(), 0)).toBeNull();
    expect(shopFootnote(trader, wants()).text).toBe(
      "Requests pay 150% (normal selling pays 30%).",
    );
  });

  it("fills the selected request through the panel reducer", () => {
    const s = save();
    const state = wants();
    expect(listEntries(trader, s, state)).toEqual([]);
    // Nothing selected / not the trader: no-op.
    expect(
      reduceGearPanel(trader, s, state, { type: "fillRequest" }).save,
    ).toBe(s);
    const picked = wants(0);
    expect(
      reduceGearPanel(smith, s, picked, { type: "fillRequest" }).save,
    ).toBe(s);
    const sold = reduceGearPanel(trader, s, picked, { type: "fillRequest" });
    expect(sold.save.gold).toBeGreaterThan(100);
    expect(sold.save.shops.requests).toHaveLength(2);
    expect(sold.state.selectedOffer).toBeNull();
    expect(sold.state.status).toMatch(/^Trader paid \d+g for /);
    const miss = reduceGearPanel(trader, sold.save, picked, {
      type: "fillRequest",
    });
    expect(miss.save).toBe(sold.save);
    expect(miss.state.selectedOffer).toBe(0);
    expect(miss.state.status).toBe("No matching item in your bag");
  });
});
