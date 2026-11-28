import { describe, expect, it } from "vitest";
import itemsRaw from "../../../public/data/items.json";
import { RARITY_IDS } from "../../gear/gearTypes";

type UniqueRow = { rarity?: string; baseId?: string; itemLevel?: number };

const uniques = itemsRaw.uniques as unknown as Record<string, UniqueRow>;
const bases = itemsRaw.bases as unknown as Record<
  string,
  { minItemLevel: number }
>;

/**
 * Structural invariants of authored uniques only. No balance numbers
 * (uniques per rarity, prices, stats, gates) are asserted, so tuning
 * `items.json` never has to touch this test.
 */
describe("authored uniques", () => {
  it.each(Object.entries(uniques))(
    "%s has a non-common rarity",
    (_id, unique) => {
      expect(unique.rarity).toBeDefined();
      expect(RARITY_IDS).toContain(unique.rarity);
      expect(unique.rarity).not.toBe("common");
    },
  );

  it.each(Object.entries(uniques))(
    "%s gates at or above its base's minimum item level",
    (_id, unique) => {
      const base = bases[unique.baseId ?? ""];
      expect(base, `unknown base ${unique.baseId}`).toBeDefined();
      expect(typeof unique.itemLevel).toBe("number");
      expect(unique.itemLevel).toBeGreaterThanOrEqual(base!.minItemLevel);
    },
  );
});
