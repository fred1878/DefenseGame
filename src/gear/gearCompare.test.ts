import { describe, expect, it } from "vitest";
import { gearFixture } from "../test/gearFixture";
import { compareGear, goldAfterRow } from "./gearCompare";
import { equipItem } from "./inventory";
import type { ItemInstance, SaveGear } from "./gearTypes";

const catalog = gearFixture();

const item = (
  uid: number,
  baseId: string,
  extra: Partial<ItemInstance> = {},
): ItemInstance => ({
  uid,
  baseId,
  rarity: "common",
  itemLevel: 1,
  affixes: [],
  ...extra,
});

function gear(items: ItemInstance[], equipped = {}): SaveGear {
  return { items, equipped, nextUid: 100 };
}

describe("compareGear", () => {
  it("lists absolute from → to rows including damage reduction", () => {
    const g = gear([item(1, "cap")]);
    const rows = compareGear(catalog, g, equipItem(catalog, g, 1));
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel.Armour).toMatchObject({
      from: "0",
      to: "10",
      delta: "▲10",
      better: true,
    });
    // armour / (armour + 50) with the fixture's half-reduction point.
    expect(byLabel["Damage reduction"]).toMatchObject({
      from: "0.0%",
      to: "16.7%",
      delta: "▲16.7%",
    });
    expect(byLabel["Max HP"]?.delta).toBe("▲5");
    expect(compareGear(catalog, g, g)).toEqual([]);
  });

  it("shows weapon DPS, keyed element / spell rows and worse changes", () => {
    const blade = item(1, "blade", {
      rarity: "magic",
      affixes: [
        { id: "hot", value: 3 },
        { id: "of_haste", value: 10 },
      ],
    });
    const band = item(2, "band", {
      rarity: "magic",
      affixes: [
        { id: "of_mastery", value: 15, spell: "fire_bolt" },
        { id: "of_quick", value: 25, spell: "meteor" },
      ],
    });
    const before = gear([blade, band], { meleeWeapon: 1, ring1: 2 });
    const after = gear([blade, band], {});
    const rows = compareGear(catalog, before, after);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Melee DPS");
    expect(labels).toContain("Attack speed");
    expect(labels).toContain("Fire damage");
    expect(rows.find((r) => r.label === "Melee DPS")).toMatchObject({
      better: false,
    });
    expect(rows.find((r) => r.label === "Spell power")?.delta).toBe("▼10%");
    expect(labels.some((l) => /damage$/.test(l) && l !== "Fire damage")).toBe(
      true,
    );
    // Lower cooldown is better, so losing it is worse.
    const cd = rows.find((r) => r.label.endsWith("cooldown"))!;
    expect(cd).toMatchObject({ from: "25%", to: "0%", better: true });
  });

  it("counts on-hit effects and lifesteal from uniques", () => {
    const u = item(1, "blade", {
      rarity: "legendary",
      itemLevel: 6,
      uniqueId: "flamebrand",
    });
    const g = gear([u]);
    const rows = compareGear(catalog, g, equipItem(catalog, g, 1));
    expect(rows.find((r) => r.label === "On-hit effects")?.to).toBe("1");
    expect(rows.find((r) => r.label === "Lifesteal")?.to).toMatch(/%$/);
  });

  it("builds gold-after rows", () => {
    expect(goldAfterRow("Gold after purchase", 105, -100)).toEqual({
      label: "Gold after purchase",
      from: "105g",
      to: "5g",
      delta: "▼100",
      better: false,
    });
    expect(goldAfterRow("Gold after sale", 5, 30)).toMatchObject({
      to: "35g",
      delta: "▲30",
      better: true,
    });
  });
});
