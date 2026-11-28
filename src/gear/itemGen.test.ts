import { describe, expect, it } from "vitest";
import { gearFixture } from "../test/gearFixture";
import type { GearCatalog, RarityId } from "./gearTypes";
import {
  affixTierFor,
  basePickWeight,
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
    // The rolled level carries over, never below the unique's own level.
    expect(createUniqueItem(catalog, "flamebrand", 11).itemLevel).toBe(11);
    expect(createUniqueItem(catalog, "flamebrand", 2).itemLevel).toBe(6);
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

  it("only rolls uniques of the requested rarity", () => {
    const all: GearCatalog = {
      ...catalog,
      uniqueChanceByRarity: {
        magic: 100,
        rare: 100,
        epic: 100,
        legendary: 100,
      },
    };
    const rolled = (rarity: RarityId) =>
      rollItem(all, createRng(8), { itemLevel: 12, rarity })!;
    expect(rolled("magic")).toMatchObject({
      uniqueId: "spark_band",
      rarity: "magic",
    });
    expect(rolled("rare")).toMatchObject({
      uniqueId: "warden_idol",
      rarity: "rare",
    });
    expect(rolled("epic")).toMatchObject({
      uniqueId: "prism_cap",
      rarity: "epic",
    });
    expect(rolled("legendary")).toMatchObject({
      uniqueId: "flamebrand",
      rarity: "legendary",
    });
  });

  it("honours a per-rarity unique chance and keeps the rolled level", () => {
    const half: GearCatalog = {
      ...catalog,
      uniqueChanceByRarity: { ...catalog.uniqueChanceByRarity, magic: 50 },
    };
    const rng = createRng(21);
    let uniques = 0;
    for (let i = 0; i < 200; i++) {
      const item = rollItem(half, rng, {
        itemLevel: 3,
        rarity: "magic",
        types: ["ring"],
      })!;
      if (item.uniqueId) {
        uniques += 1;
        expect(item.uniqueId).toBe("spark_band");
        expect(item.itemLevel).toBe(3);
      } else {
        expect(item.baseId).toBe("band");
      }
    }
    expect(uniques).toBeGreaterThan(60);
    expect(uniques).toBeLessThan(140);
  });

  it("drops a unique-only rarity to the best normal rarity below", () => {
    const rares: GearCatalog = {
      ...catalog,
      uniqueChanceByRarity: { ...catalog.uniqueChanceByRarity, rare: 100 },
    };
    // A rare unique fits a trinket at this level.
    expect(
      rollItem(rares, createRng(6), {
        itemLevel: 5,
        rarity: "rare",
        types: ["trinket"],
      })?.uniqueId,
    ).toBe("warden_idol");
    // None fits a ring, so the roll becomes a plain magic ring.
    const ring = rollItem(rares, createRng(6), {
      itemLevel: 5,
      rarity: "rare",
      types: ["ring"],
    })!;
    expect(ring.uniqueId).toBeUndefined();
    expect(ring.rarity).toBe("magic");
    expect(ring.baseId).toBe("band");
  });

  it("tapers outdated bases from 0.5 at 4 levels stale to 0 at 8", () => {
    const gen = catalog.generation;
    expect(basePickWeight(gen, 0)).toBe(1);
    expect(basePickWeight(gen, 3)).toBe(1);
    expect(basePickWeight(gen, 4)).toBe(0.5);
    expect(basePickWeight(gen, 6)).toBeCloseTo(0.25);
    expect(basePickWeight(gen, 8)).toBe(0);
    expect(basePickWeight(gen, 20)).toBe(0);
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
    // cap (ilvl 1) is 7 levels stale → weight 0.125 vs idol's 0.5 at 4 stale.
    expect(caps).toBeLessThan(160);
    expect(caps).toBeGreaterThan(40);
  });

  it("never rolls bases 8 or more levels stale", () => {
    const rng = createRng(13);
    for (let i = 0; i < 200; i++) {
      const item = rollItem(catalog, rng, {
        itemLevel: 9,
        rarity: "common",
        types: ["helm", "trinket"],
      })!;
      // cap (ilvl 1) is 8 stale and gone; idol (ilvl 4) is the only base left.
      expect(item.baseId).toBe("idol");
    }
  });
});
