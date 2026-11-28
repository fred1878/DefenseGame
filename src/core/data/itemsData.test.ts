import { describe, expect, it } from "vitest";
import itemsRaw from "../../../public/data/items.json";
import { normalizeItems } from "./normalizeItems";

type UniqueRow = { rarity?: string; baseId?: string; itemLevel?: number };

const uniques = itemsRaw.uniques as unknown as Record<string, UniqueRow>;
const bases = itemsRaw.bases as unknown as Record<
  string,
  { minItemLevel: number }
>;
const entries = Object.entries(uniques);

/** Authored uniques are hand-written data, so guard it independently of load. */
describe("authored uniques", () => {
  it("covers every rarity above common", () => {
    const rarities = new Set(entries.map(([, unique]) => unique.rarity));
    for (const rarity of ["magic", "rare", "epic", "legendary"]) {
      expect(rarities.has(rarity), `no ${rarity} unique`).toBe(true);
    }
  });

  it.each(entries)("%s has a non-common rarity", (_id, unique) => {
    expect(unique.rarity).toBeDefined();
    expect(unique.rarity).not.toBe("common");
  });

  it.each(entries)(
    "%s gates at or above its base's minimum item level",
    (_id, unique) => {
      const base = bases[unique.baseId ?? ""];
      expect(base, `unknown base ${unique.baseId}`).toBeDefined();
      expect(unique.itemLevel).toBeGreaterThanOrEqual(base!.minItemLevel);
    },
  );

  it("normalizes with the same rarity and gate levels", () => {
    const catalog = normalizeItems(itemsRaw);
    for (const [id, unique] of entries) {
      const def = catalog.uniques[id]!;
      expect(def.rarity).toBe(unique.rarity);
      expect(def.itemLevel).toBe(unique.itemLevel);
      expect(def.itemLevel).toBeGreaterThanOrEqual(
        catalog.bases[def.baseId]!.minItemLevel,
      );
    }
  });
});
