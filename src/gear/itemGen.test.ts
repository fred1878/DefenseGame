import { describe, expect, it } from "vitest";
import { gearFixture } from "../test/gearFixture";
import {
  affixTierFor,
  createBaseItem,
  createUniqueItem,
  equipSlotsForType,
  rollItem,
  rollRarity,
} from "./itemGen";
import { createRng } from "./rng";

const catalog = gearFixture();

describe("itemGen", () => {
  it("maps item types to equipment slots", () => {
    expect(equipSlotsForType("ring")).toEqual(["ring1", "ring2"]);
    expect(equipSlotsForType("trinket")).toEqual(["trinket1", "trinket2"]);
    expect(equipSlotsForType("helm")).toEqual(["helm"]);
  });

  it("picks the highest unlocked affix tier", () => {
    const tough = catalog.affixes.tough!;
    expect(affixTierFor(tough, 1)?.max).toBe(2);
    expect(affixTierFor(tough, 9)?.max).toBe(5);
    expect(affixTierFor(catalog.affixes.late!, 3)).toBeUndefined();
  });

  it("resolves the highest tier whatever order the tiers are stored in", () => {
    const tough = catalog.affixes.tough!;
    // The fixture lists its tiers out of order; sorting them ascending must not
    // change the answer either.
    const ascending = {
      ...tough,
      tiers: [...tough.tiers].sort((a, b) => a.minItemLevel - b.minItemLevel),
    };
    for (const affix of [tough, ascending]) {
      expect(affixTierFor(affix, 1)?.minItemLevel).toBe(1);
      expect(affixTierFor(affix, 3)?.minItemLevel).toBe(1);
      expect(affixTierFor(affix, 4)?.minItemLevel).toBe(4);
      expect(affixTierFor(affix, 9)?.minItemLevel).toBe(4);
    }
  });

  it("gates rarities by item level and available uniques", () => {
    const seen = new Set<string>();
    const rng = createRng(7);
    for (let i = 0; i < 300; i++) seen.add(rollRarity(catalog, rng, 1));
    expect([...seen].sort()).toEqual(["common", "magic"]);
    expect(rollRarity(catalog, () => 0.999, 9, { legendary: 1000 })).toBe(
      "legendary",
    );
    // No unique fits rings, so legendary is excluded even with a big weight.
    expect(
      rollRarity(catalog, () => 0.999, 9, { legendary: 1000, epic: 0 }, [
        "ring",
      ]),
    ).not.toBe("legendary");
    expect(
      rollRarity(catalog, () => 0, 1, {
        common: 0,
        magic: 0,
      }),
    ).toBe("common");
  });

  it("creates fixed base and unique items", () => {
    expect(createBaseItem(catalog, "bow", 1)).toEqual({
      baseId: "bow",
      rarity: "common",
      itemLevel: 2,
      affixes: [],
    });
    expect(createUniqueItem(catalog, "flamebrand")).toMatchObject({
      rarity: "legendary",
      uniqueId: "flamebrand",
      itemLevel: 6,
    });
    expect(() => createBaseItem(catalog, "ghost", 1)).toThrow();
    expect(() => createUniqueItem(catalog, "ghost")).toThrow();
  });

  it("rolls affixes within position limits, without repeats", () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) {
      const item = rollItem(catalog, rng, {
        itemLevel: 5,
        rarity: "epic",
        types: ["helm"],
      })!;
      expect(item.baseId).toBe("cap");
      expect(item.rarity).toBe("epic");
      const ids = item.affixes.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
      const prefixes = ids.filter(
        (id) => catalog.affixes[id]!.position === "prefix",
      );
      expect(prefixes.length).toBeLessThanOrEqual(2);
      for (const a of item.affixes) {
        if (a.id === "of_mastery") expect(a.spell).toBe("fire_bolt");
        if (a.id === "of_quick") expect(a.spell).toBe("meteor");
      }
    }
  });

  it("rolls uniques for legendary and falls back to epic when none fit", () => {
    const rng = createRng(11);
    expect(
      rollItem(catalog, rng, { itemLevel: 8, rarity: "legendary" })?.uniqueId,
    ).toBe("flamebrand");
    const ring = rollItem(catalog, rng, {
      itemLevel: 8,
      rarity: "legendary",
      types: ["ring"],
    })!;
    expect(ring.rarity).toBe("epic");
    expect(ring.baseId).toBe("band");
  });

  it("returns null when no base fits and demotes affix-less magic items", () => {
    expect(
      rollItem(catalog, createRng(1), { itemLevel: 1, types: ["boots"] }),
    ).toBeNull();
    // Bows have no affix pool in the fixture, so a magic roll ends up common.
    const bow = rollItem(catalog, createRng(2), {
      itemLevel: 3,
      rarity: "magic",
      types: ["rangedWeapon"],
    })!;
    expect(bow.rarity).toBe("common");
    expect(bow.affixes).toEqual([]);
  });

  it("prefers current bases over outdated ones", () => {
    const rng = createRng(5);
    let caps = 0;
    for (let i = 0; i < 400; i++) {
      const item = rollItem(catalog, rng, {
        itemLevel: 8.7,
        rarity: "common",
        types: ["helm", "trinket"],
      })!;
      expect(item.itemLevel).toBe(8);
      if (item.baseId === "cap") caps += 1;
    }
    // cap (ilvl 1) is outdated at 8 → weight 0.35 vs idol 1.
    expect(caps).toBeLessThan(160);
    expect(caps).toBeGreaterThan(40);
  });
});
