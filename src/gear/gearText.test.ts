import { describe, expect, it } from "vitest";
import { basePlayerTuning } from "../config/player";
import { setSpellCatalog } from "../content/spells";
import { gearFixture } from "../test/gearFixture";
import {
  diffGear,
  equipDiff,
  gearSummaryLines,
  itemDetailLines,
  itemTypeLabel,
  modifierLabel,
  nightDropLines,
  procLabel,
  spellLabel,
  weaponLine,
} from "./gearText";
import { effectivePlayerTuning, gearStatsFor, resolveItem } from "./itemStats";
import type { ItemInstance, SaveGear } from "./gearTypes";

const catalog = gearFixture();

const inst = (
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

describe("gearText labels", () => {
  it("formats modifiers, procs and spell names", () => {
    expect(modifierLabel({ stat: "armour", value: 12 })).toBe("+12 Armour");
    expect(modifierLabel({ stat: "attackSpeedPct", value: -5 })).toBe(
      "−5% Attack speed",
    );
    expect(
      modifierLabel({ stat: "elementDamagePct", element: "fire", value: 15 }),
    ).toBe("+15% Fire damage");
    expect(
      modifierLabel({ stat: "spellDamagePct", spell: "fire_bolt", value: 10 }),
    ).toBe("+10% Fire Bolt damage");
    expect(
      modifierLabel({ stat: "spellCooldownPct", spell: "meteor", value: 20 }),
    ).toBe("−20% Meteor cooldown");
    setSpellCatalog([{ id: "meteor", name: "Sky Rock" } as never]);
    expect(spellLabel("meteor")).toBe("Sky Rock");
    setSpellCatalog([]);
    expect(
      procLabel({
        kind: "dot",
        flavor: "fire",
        chancePct: 20,
        dps: 4,
        ms: 3000,
      }),
    ).toBe("20% on hit: Burn 4/s for 3s");
    expect(
      procLabel({
        kind: "dot",
        flavor: "frost",
        chancePct: 5,
        dps: 1.25,
        ms: 500,
      }),
    ).toBe("5% on hit: Frost DoT 1.3/s for 0.5s");
    expect(
      procLabel({ kind: "slow", chancePct: 10, slowPct: 30, ms: 1000 }),
    ).toBe("10% on hit: Slow 30% for 1s");
    expect(procLabel({ kind: "stun", chancePct: 10, ms: 400 })).toBe(
      "10% on hit: Stun 0.4s",
    );
    expect(itemTypeLabel("hands")).toBe("Gloves");
  });

  it("describes weapons, armour and uniques", () => {
    const blade = resolveItem(catalog, inst(1, "blade"))!;
    expect(weaponLine(blade)).toBe(
      "Sword · 20 dmg · 0.4s swing · reach 100 · 90° arc",
    );
    const bow = resolveItem(catalog, inst(2, "bow"))!;
    expect(weaponLine(bow)).toBe("Bow · 10 dmg · 0.5s shot · range 400");
    const cap = resolveItem(
      catalog,
      inst(3, "cap", { affixes: [{ id: "of_burning", value: 4 }] }),
    )!;
    expect(weaponLine(cap)).toBeNull();
    expect(itemDetailLines(cap)).toEqual([
      "Common Helm · item level 1",
      "+10 Armour",
      "+5 Max HP",
      "100% on hit: Burn 4/s for 1s",
    ]);
    const brand = resolveItem(
      catalog,
      inst(4, "blade", {
        rarity: "legendary",
        uniqueId: "flamebrand",
        itemLevel: 6,
      }),
    )!;
    const lines = itemDetailLines(brand);
    expect(lines[0]).toBe("Legendary Melee weapon · item level 6");
    expect(lines.at(-1)).toBe("“Hot.”");
  });

  it("summarises gear totals", () => {
    const gear: SaveGear = {
      items: [
        inst(1, "cap"),
        inst(2, "blade", {
          rarity: "legendary",
          uniqueId: "flamebrand",
          itemLevel: 6,
        }),
        inst(3, "band"),
      ],
      equipped: { helm: 1, meleeWeapon: 2, ring1: 3 },
      nextUid: 4,
    };
    const stats = gearStatsFor(catalog, gear);
    const tuning = effectivePlayerTuning(basePlayerTuning(), stats);
    const lines = gearSummaryLines(catalog, stats, tuning);
    expect(lines[0]).toContain("Armour 10 (−17% dmg)");
    expect(lines[2]).toBe(
      "Spell power +10% · Lifesteal 20% · 1 on-hit effects",
    );
    const bare = gearStatsFor(catalog, { items: [], equipped: {}, nextUid: 1 });
    expect(gearSummaryLines(catalog, bare, basePlayerTuning())).toHaveLength(2);
  });
});

describe("gear diffs", () => {
  it("lists stat changes for equipping an item with better / worse flags", () => {
    const gear: SaveGear = {
      items: [
        inst(1, "cap", {
          affixes: [{ id: "of_mastery", value: 15, spell: "fire_bolt" }],
        }),
        inst(2, "cap", {
          affixes: [
            { id: "of_quick", value: 25, spell: "meteor" },
            { id: "hot", value: 3 },
          ],
        }),
        inst(3, "blade", {
          affixes: [
            { id: "of_haste", value: 10 },
            { id: "of_jolt", value: 300 },
          ],
        }),
      ],
      equipped: { helm: 1 },
      nextUid: 4,
    };
    const helm = equipDiff(catalog, gear, 2);
    const byLabel = Object.fromEntries(helm.map((d) => [d.label, d]));
    expect(byLabel["Fire damage"]).toMatchObject({
      text: "+3% Fire damage",
      better: true,
    });
    expect(byLabel["Fire Bolt damage"]).toMatchObject({
      text: "−15% Fire Bolt damage",
      better: false,
    });
    expect(byLabel["Meteor cooldown"]).toMatchObject({
      text: "−25% Meteor cooldown",
      better: true,
    });
    expect(byLabel.Armour).toBeUndefined();

    const weapon = equipDiff(catalog, gear, 3);
    const w = Object.fromEntries(weapon.map((d) => [d.label, d]));
    expect(w["Swing time"]?.better).toBe(true);
    expect(w["Swing time"]?.text).toMatch(/^−/);
    expect(w["Attack speed"]?.text).toBe("+10% Attack speed");
    expect(w["On-hit effects"]?.text).toBe("+1 On-hit effects");

    const removeAll = diffGear(
      catalog,
      { ...gear, equipped: { meleeWeapon: 3 } },
      { ...gear, equipped: {} },
    );
    expect(removeAll.find((d) => d.label === "Swing time")?.text).toMatch(
      /^\+/,
    );
    expect(removeAll.find((d) => d.label === "Swing time")?.better).toBe(false);
  });
});

describe("nightDropLines", () => {
  it("lists drops, truncates and reports overflow sales", () => {
    const d = (baseId: string) => ({
      baseId,
      rarity: "common" as const,
      itemLevel: 1,
      affixes: [],
    });
    expect(nightDropLines(catalog, [], 0)).toEqual([]);
    expect(nightDropLines(catalog, [d("cap"), d("ghost")], 0)).toEqual([
      "Loot found:",
      "• Cap (Common)",
    ]);
    const many = nightDropLines(
      catalog,
      [d("cap"), d("band"), d("blade")],
      7,
      2,
    );
    expect(many).toEqual([
      "Loot found:",
      "• Cap (Common)",
      "• Band (Common)",
      "…and 1 more",
      "Bag full — extra loot sold for 7g",
    ]);
  });
});
