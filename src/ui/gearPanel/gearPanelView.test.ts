import { describe, expect, it } from "vitest";
import type { ConsumableDef } from "../../gear/consumableTypes";
import { resolveItem } from "../../gear/itemStats";
import { gearFixture } from "../../test/gearFixture";
import { owned, panelSave } from "../../test/gearPanelFixture";
import {
  consumableLines,
  consumableSubline,
  consumableTile,
  consumableTypeLabel,
  draftItemCompare,
  itemDetailLines,
  itemKeyStat,
  itemSubline,
  itemTile,
  ownedItemCompare,
  totalStatRows,
} from "./gearPanelView";

const catalog = gearFixture();
const r = (i: ReturnType<typeof owned>) => resolveItem(catalog, i)!;
const consumables: Record<string, ConsumableDef> = {
  pot: {
    id: "pot",
    name: "Pot",
    kind: "heal",
    price: 10,
    maxStack: 5,
    cooldownMs: 1500,
    healHp: 40,
  },
  boom: {
    id: "boom",
    name: "Boom",
    kind: "bomb",
    price: 20,
    maxStack: 3,
    cooldownMs: 2000,
  },
};

describe("gearPanelView", () => {
  it("summarises weapons and gear in one card line", () => {
    expect(itemKeyStat(r(owned(1, "blade")))).toBe("20 dmg · 0.4s swing");
    expect(itemKeyStat(r(owned(1, "bow", { itemLevel: 2 })))).toBe(
      "10 dmg · 400 range",
    );
    expect(itemKeyStat(r(owned(1, "cap")))).toBe("+10 Armour · +5 Max HP");
    expect(
      itemKeyStat(
        resolveItem(
          {
            ...catalog,
            bases: {
              ...catalog.bases,
              bare: { ...catalog.bases.cap!, modifiers: [] },
            },
          },
          owned(1, "bare"),
        )!,
      ),
    ).toBe("No bonuses");
  });

  it("writes sublines and tagged affix / proc lines", () => {
    const blade = r(
      owned(1, "blade", {
        rarity: "magic",
        affixes: [
          { id: "hot", value: 3 },
          { id: "of_burning", value: 4 },
          { id: "of_chill", value: 30 },
          { id: "of_jolt", value: 300 },
          { id: "missing", value: 1 },
        ],
      }),
    );
    expect(itemSubline(blade)).toMatch(
      /^Magic melee weapon · item level 1 · 20 dmg · 0.4s swing · reach 100$/,
    );
    expect(itemSubline(r(owned(1, "bow", { itemLevel: 2 })))).toMatch(
      /0.5s shot · range 400$/,
    );
    expect(itemSubline(r(owned(1, "cap")))).toBe("Common helm · item level 1");
    const lines = itemDetailLines(catalog, blade);
    expect(lines.map((l) => [l.icon, l.tag])).toEqual([
      ["flame", "Hot"],
      ["flame", "of Burning"],
      ["snowflake", "of Chill"],
      ["zap", "of Jolt"],
    ]);
    expect(lines[0]!.color).toBe("#FB923C");
    const ring = r(
      owned(2, "band", {
        affixes: [
          { id: "of_mastery", value: 15, spell: "fire_bolt" },
          { id: "tough", value: 2 },
        ],
      }),
    );
    const rl = itemDetailLines(catalog, ring);
    expect(rl.map((l) => l.icon)).toEqual(["sparkles", "sparkles", "shield"]);
    expect(rl[1]!.color).toBe("#A78BFA");
    const unique = r(
      owned(3, "blade", {
        rarity: "legendary",
        itemLevel: 6,
        uniqueId: "flamebrand",
      }),
    );
    expect(itemDetailLines(catalog, unique).map((l) => l.tag)).toEqual([
      "",
      "",
      "",
    ]);
    const idol = r(owned(4, "idol", { itemLevel: 4 }));
    expect(itemDetailLines(catalog, idol)[0]!.icon).toBe("flame");
  });

  it("compares owned and shop items against what they replace", () => {
    const gear = {
      items: [
        owned(1, "cap"),
        owned(2, "cap", {
          rarity: "magic",
          affixes: [{ id: "vital", value: 4 }],
        }),
      ],
      equipped: { helm: 1 },
      nextUid: 10,
    };
    const swap = ownedItemCompare(catalog, gear, 2);
    expect(swap).toMatchObject({
      title: "Compared with equipped",
      against: "Cap (Common)",
    });
    expect(swap.rows.find((x) => x.label === "Max HP")?.delta).toBe("▲4");
    const off = ownedItemCompare(catalog, gear, 1);
    expect(off).toMatchObject({
      title: "If unequipped",
      against: "Empty slot",
    });
    expect(off.rows.find((x) => x.label === "Armour")?.better).toBe(false);
    expect(ownedItemCompare(catalog, gear, 99).against).toBe("Empty slot");
    const draft = draftItemCompare(catalog, gear, r(owned(0, "blade")));
    expect(draft.against).toBe("Empty slot");
    expect(draft.rows.length).toBeGreaterThan(0);
  });

  it("describes consumables and tiles", () => {
    const s = panelSave();
    s.consumables = { pot: 2 };
    const pot = consumables.pot!;
    const boom = consumables.boom!;
    expect(consumableTypeLabel(pot)).toBe("Potion");
    expect(consumableTypeLabel(boom)).toBe("Bomb");
    expect(consumableSubline(pot)).toMatch(/Q/);
    expect(consumableSubline(boom)).toMatch(/E/);
    expect(consumableLines(s, pot).map((l) => l.text)).toEqual([
      "Heals 40 HP",
      "Carrying 2/5",
      "1.5s cooldown",
    ]);
    expect(consumableTile(pot, 2)).toMatchObject({
      icon: "potion",
      badge: "×2",
    });
    expect(consumableTile(boom, 0).badge).toBe("");
    expect(itemTile(r(owned(1, "band", { itemLevel: 3 })))).toEqual({
      icon: "ring",
      color: "#ffffff",
      badge: "3",
    });
  });

  it("totals stats with optional extras, capped to the list size", () => {
    const empty = totalStatRows(catalog, {
      items: [],
      equipped: {},
      nextUid: 1,
    });
    expect(empty.map((x) => x.label)).toEqual([
      "Max HP",
      "Armour",
      "Melee damage",
      "Ranged damage",
      "Attack speed",
    ]);
    expect(empty[1]!.value).toBe("0 · 0% DR");
    const gear = {
      items: [
        owned(1, "cap", { affixes: [{ id: "of_haste", value: 10 }] }),
        owned(2, "idol", { itemLevel: 4 }),
        owned(3, "band"),
        owned(4, "blade", {
          rarity: "legendary",
          itemLevel: 6,
          uniqueId: "flamebrand",
        }),
      ],
      equipped: { helm: 1, trinket1: 2, ring1: 3, meleeWeapon: 4 },
      nextUid: 10,
    };
    const rows = totalStatRows(catalog, gear, 20);
    const by = Object.fromEntries(rows.map((x) => [x.label, x.value]));
    expect(by.Armour).toBe("10 · 16.7% DR");
    expect(by["Attack speed"]).toBe("+10%");
    expect(by["Fire damage"]).toBe("+20%");
    expect(by["Spell power"]).toBe("+10%");
    expect(by.Lifesteal).toMatch(/%$/);
    expect(by["On-hit effects"]).toBe("1");
    expect(totalStatRows(catalog, gear)).toHaveLength(8);
    const fast = {
      items: [owned(1, "cap"), owned(2, "boots")],
      equipped: { helm: 1 },
      nextUid: 3,
    };
    expect(
      totalStatRows(catalog, fast).some((x) => x.label === "Move speed"),
    ).toBe(false);
  });
});
