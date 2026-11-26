import { describe, expect, it } from "vitest";
import { gearFixture } from "../test/gearFixture";
import { getGearCatalog, setGearCatalog } from "./gearCatalog";
import { createEmptyGear, normalizeSaveGear } from "./saveGear";

const catalog = gearFixture();

describe("normalizeSaveGear", () => {
  it("returns an empty gear block for missing input", () => {
    expect(normalizeSaveGear(undefined, catalog)).toEqual(createEmptyGear());
    expect(normalizeSaveGear({ items: "x" as never }, catalog)).toEqual(
      createEmptyGear(),
    );
  });

  it("drops invalid, duplicate and removed items and bad equips", () => {
    const g = normalizeSaveGear(
      {
        items: [
          {
            uid: 1,
            baseId: "blade",
            rarity: "common",
            itemLevel: 1,
            affixes: [
              { id: "hot", value: 3 },
              { id: "gone", value: 1 },
            ],
          },
          {
            uid: 1,
            baseId: "cap",
            rarity: "common",
            itemLevel: 1,
            affixes: [],
          },
          {
            uid: 2,
            baseId: "ghost",
            rarity: "common",
            itemLevel: 1,
            affixes: [],
          },
          {
            uid: 3,
            baseId: "band",
            rarity: "mythic",
            itemLevel: 1,
            affixes: [],
          } as never,
          null as never,
          {
            uid: 4,
            baseId: "band",
            rarity: "magic",
            itemLevel: 1,
            affixes: [],
          },
          {
            uid: 5,
            baseId: "cap",
            rarity: "common",
            itemLevel: 1,
            affixes: [],
          },
        ],
        equipped: {
          meleeWeapon: 1,
          helm: 4, // ring in the helm slot
          ring1: 4,
          ring2: 4, // same item twice
          trinket1: 77,
          chest: "x" as never,
        },
        nextUid: 2,
      },
      catalog,
    );
    expect(g.items.map((i) => i.uid)).toEqual([1, 4, 5]);
    expect(g.items[0]!.affixes).toEqual([{ id: "hot", value: 3 }]);
    expect(g.equipped).toEqual({ meleeWeapon: 1, ring1: 4 });
    expect(g.nextUid).toBe(6);
  });

  it("keeps a valid nextUid", () => {
    expect(
      normalizeSaveGear({ items: [], equipped: {}, nextUid: 40 }, catalog)
        .nextUid,
    ).toBe(40);
  });
});

describe("gearCatalog", () => {
  it("falls back to the bundled catalog and accepts a replacement", () => {
    const bundled = getGearCatalog();
    expect(Object.keys(bundled.bases).length).toBeGreaterThan(0);
    setGearCatalog(catalog);
    expect(getGearCatalog()).toBe(catalog);
    setGearCatalog(bundled);
  });
});
