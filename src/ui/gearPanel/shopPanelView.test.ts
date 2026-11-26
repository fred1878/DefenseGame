import { describe, expect, it } from "vitest";
import buildingsRaw from "../../../public/data/buildings.json";
import shopsRaw from "../../../public/data/shops.json";
import { DG_THEME } from "../theme/dgTheme";
import {
  inventoryPanelCtx,
  owned,
  panelSave,
  shippedLoot,
  shopPanelCtx,
} from "../../test/gearPanelFixture";
import { createGearPanelState, type GearPanelState } from "./gearPanelLogic";
import {
  filterChips,
  lockedCards,
  shopActions,
  shopCards,
  shopDetail,
  shopFootnote,
  shopHeader,
  shopSections,
} from "./shopPanelView";

const smith = shopPanelCtx("blacksmith", true);
const trader = shopPanelCtx("trader", true);
const buy = (o: Partial<GearPanelState> = {}): GearPanelState => ({
  ...createGearPanelState("shop"),
  ...o,
});
const sell = (o: Partial<GearPanelState> = {}) => buy({ tab: "bag", ...o });

describe("shopPanelView", () => {
  it("builds the header and tab counts from the save", () => {
    const s = panelSave(4, 321, [owned(1, "iron_sword")]);
    expect(shopHeader(smith, s)).toMatchObject({
      title: shopsRaw.blacksmith.title,
      subtitle: "Night 4 · Level 0/3",
      gold: "321g",
      sellCount: "1 in bag",
    });
    expect(shopHeader(trader, s).subtitle).toBe(
      "Night 4 · Level 0/3 · New stock every night",
    );
    expect(shopHeader(shopPanelCtx("blacksmith"), s).subtitle).toMatch(
      /^Night 4 · Level 0\/0$/,
    );
  });

  it("shows chips only for categories in stock", () => {
    const s = panelSave(1);
    const ids = filterChips(smith, s, buy()).map((c) => c.id);
    expect(ids).toEqual(["all", "weapons", "armour", "consumables"]);
    const bag = panelSave(1, 0, [owned(1, "copper_ring")]);
    expect(filterChips(smith, bag, sell()).map((c) => c.id)).toEqual([
      "all",
      "jewellery",
    ]);
    // An active empty filter stays visible.
    expect(
      filterChips(smith, bag, sell({ filter: "weapons" })).find((c) => c.active)
        ?.id,
    ).toBe("weapons");
  });

  it("prices cards red when unaffordable and marks the selection", () => {
    const s = panelSave(1, 20);
    s.consumables = { minor_healing_potion: 1 };
    const cards = shopCards(smith, s, buy({ selectedOffer: 0 }));
    expect(cards[0]!.selected).toBe(true);
    const dear = cards.find((c) => Number.parseInt(c.price, 10) > 20)!;
    expect(dear.priceColor).toBe(DG_THEME.stateNegative);
    const pot = cards.find((c) => c.name.includes("Potion"))!;
    expect(pot.meta).toMatch(/^Potion · 1 owned$/);
    expect(pot.priceColor).toBe(DG_THEME.accentGoldBright);
    // Trader limited rows show what's left; sold-out / unknown rows grey out.
    s.shops.trader = [
      { kind: "consumable", id: "fire_bomb", qty: 2 },
      { kind: "consumable", id: "frost_bomb", qty: 0 },
      {
        kind: "item",
        item: {
          baseId: "iron_helm",
          rarity: "magic",
          itemLevel: 3,
          affixes: [],
        },
        qty: 1,
      },
    ];
    const tc = shopCards(trader, s, buy());
    expect(tc.map((c) => c.meta)).toEqual([
      "Helm · ilvl 3 · 1 left",
      "Bomb · 0 owned · 2 left",
      "Bomb · 0 owned",
    ]);
    expect(tc[2]!.price).toBe("Sold out");
    expect(tc[2]!.priceColor).toBe(DG_THEME.textMuted);
    // Sell tab lists the bag at sell value.
    const b = panelSave(1, 0, [owned(7, "iron_sword")]);
    const sc = shopCards(smith, b, sell({ selectedUid: 7 }));
    expect(sc[0]).toMatchObject({ key: 7, selected: true });
    expect(sc[0]!.priceColor).toBe(DG_THEME.accentGoldBright);
  });

  it("shows the next blacksmith unlocks as locked cards", () => {
    const s = panelSave(1);
    const locked = lockedCards(smith, s, buy(), 50);
    expect(locked.length).toBeGreaterThan(2);
    expect(
      locked.every((c) => c.locked && /^Unlocks night \d+$/.test(c.meta)),
    ).toBe(true);
    const nights = locked.map((c) => Number(c.meta.split(" ").pop()));
    expect([...nights].sort((a, b) => a - b)).toEqual(nights);
    expect(lockedCards(smith, s, buy())).toHaveLength(2);
    expect(locked.some((c) => c.name.includes("Bomb"))).toBe(true);
    expect(
      lockedCards(smith, s, buy({ filter: "consumables" }), 50).every((c) =>
        /Bomb|Potion/.test(c.name),
      ),
    ).toBe(true);
    // Upgrades unlock stock early, so shown nights move forward.
    const up = panelSave(1);
    up.buildings.blacksmith = 3;
    const early = lockedCards(smith, up, buy(), 50);
    expect(early.length).toBeLessThan(locked.length);
    expect(lockedCards(smith, s, sell())).toEqual([]);
    expect(lockedCards(trader, s, buy())).toEqual([]);
    expect(lockedCards(smith, panelSave(99), buy())).toEqual([]);
  });

  it("labels sections", () => {
    const s = panelSave(1);
    expect(shopSections(smith, s, buy(), 1).stock).toEqual({
      left: "Forge stock",
      right: "1 item",
    });
    expect(shopSections(smith, s, buy(), 3).soon.right).toMatch(
      /^More stock at night \d+$/,
    );
    expect(shopSections(smith, panelSave(99), buy(), 3).soon.right).toBe("");
    expect(shopSections(trader, s, buy(), 2).stock.left).toBe("Today's stock");
    expect(shopSections(trader, s, sell(), 2).stock).toEqual({
      left: "Your bag",
      right: `2 items · sell for ${shippedLoot.sellBackPct}%`,
    });
  });

  it("details items, consumables and idle shop info", () => {
    const s = panelSave(1, 100, [owned(1, "rusty_sword")], { meleeWeapon: 1 });
    const idle = shopDetail(smith, s, buy());
    expect(idle.name).toBe(`${shopsRaw.blacksmith.title} · Level 0/3`);
    expect(idle.info[0]).toMatch(/^Now: /);
    expect(idle.info[1]).toMatch(/^Next \(\d+g\): /);
    expect(idle.info[2]).toMatch(/^More stock unlocks at night \d+\.$/);
    const maxed = panelSave(99);
    maxed.buildings.blacksmith = 3;
    expect(shopDetail(smith, maxed, buy()).info.slice(1)).toEqual([
      "Fully upgraded.",
      "Full catalogue unlocked.",
    ]);
    expect(shopDetail(trader, s, sell()).info.at(-1)).toBe(
      "Stock changes after every night.",
    );
    expect(shopDetail(shopPanelCtx("trader"), s, buy()).info.at(-1)).toBe(
      "Stock changes after every night.",
    );

    const cards = shopCards(smith, s, buy());
    const armourCard = cards.find(
      (c) => !c.locked && (c.stat.includes("Armour") || c.stat.includes("HP")),
    );
    expect(armourCard).toBeDefined();
    const armDetail = shopDetail(
      smith,
      s,
      buy({ selectedOffer: armourCard!.key }),
    );
    expect(armDetail.pills.length).toBeGreaterThan(0);
    expect(armDetail.lines).toHaveLength(0);

    const sword = cards.find((c) => c.meta.startsWith("Melee"))!;
    const d = shopDetail(smith, s, buy({ selectedOffer: sword.key }));
    expect(d.compareTitle).toBe("Compared with equipped");
    expect(d.against).toMatch(/Rusty Sword \(Common\)/);
    const gold = d.rows.at(-1)!;
    expect(gold).toMatchObject({ label: "Gold after purchase", from: "100g" });
    const potKey = cards.find((c) => c.name.includes("Potion"))!.key;
    const pd = shopDetail(smith, s, buy({ selectedOffer: potKey }));
    expect(pd.compareTitle).toBe("Purchase");
    expect(pd.rows).toHaveLength(1);
    const sd = shopDetail(smith, s, sell({ selectedUid: 1 }));
    // Equipped items aren't in the bag list, so selling them isn't offered.
    expect(sd.name).toBe(`${shopsRaw.blacksmith.title} · Level 0/3`);
    const bag = panelSave(1, 0, [owned(2, "iron_sword")]);
    const bd = shopDetail(smith, bag, sell({ selectedUid: 2 }));
    expect(bd.rows.at(-1)).toMatchObject({
      label: "Gold after sale",
      better: true,
    });
  });

  it("offers buy / buy & equip, upgrade / reroll and sell / equip", () => {
    const s = panelSave(1, 10);
    const idle = shopActions(smith, s, buy());
    expect(idle).toEqual([
      expect.objectContaining({
        id: "upgrade",
        label: `Upgrade · ${buildingsRaw.blacksmith.costByLevel[0]}g`,
        enabled: true,
      }),
    ]);
    const t = panelSave(1, 10);
    t.buildings.trader = 1;
    expect(shopActions(trader, t, buy()).map((a) => a.id)).toEqual([
      "upgrade",
      "reroll",
    ]);
    t.buildings.trader = 3;
    expect(shopActions(trader, t, buy())[0]).toMatchObject({
      label: "Max level",
      enabled: false,
    });
    expect(
      shopActions(shopPanelCtx("trader"), t, buy()).map((x) => x.enabled),
    ).toEqual([false, true]);
    expect(shopActions(inventoryPanelCtx, t, buy())).toEqual([]);

    const cards = shopCards(smith, s, buy());
    const cheap = panelSave(1, 5000);
    const a = shopActions(smith, cheap, buy({ selectedOffer: cards[0]!.key }));
    expect(a.map((x) => [x.id, x.enabled])).toEqual([
      ["buy", true],
      ["buyEquip", true],
    ]);
    expect(a[0]!.label).toMatch(/^Buy · \d+g$/);
    expect(
      shopActions(smith, s, buy({ selectedOffer: cards[0]!.key }))[0]!.enabled,
    ).toBe(false);
    const potKey = cards.find((c) => c.name.includes("Potion"))!.key;
    expect(
      shopActions(smith, cheap, buy({ selectedOffer: potKey }))[1]!.enabled,
    ).toBe(false);

    expect(shopActions(smith, s, sell()).map((x) => x.enabled)).toEqual([
      false,
      false,
    ]);
    const bag = panelSave(1, 0, [owned(2, "iron_sword")]);
    expect(shopActions(smith, bag, sell({ selectedUid: 2 }))[0]!.label).toMatch(
      /^Sell · \d+g$/,
    );
  });

  it("shows the status or a sell-back hint under the bar", () => {
    expect(shopFootnote(smith, buy()).text).toBe(
      `Bought gear goes to your bag. Sell back for ${shippedLoot.sellBackPct}%.`,
    );
    expect(shopFootnote(smith, sell()).text).toMatch(/sell for \d+%/);
    expect(shopFootnote(smith, buy({ status: "Bought X" }))).toEqual({
      text: "Bought X",
      color: DG_THEME.accentGoldBright,
    });
  });
});
