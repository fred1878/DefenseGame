import { describe, expect, it } from "vitest";
import type { SaveGear } from "../../gear/gearTypes";
import { defaultRawData, loadSimData } from "./simData";
import {
  schoolGear,
  schoolSave,
  schoolTalents,
  talentsLegal,
} from "./schoolBuilds";

const data = loadSimData(defaultRawData());

const GEAR: SaveGear = {
  items: [
    {
      uid: 1,
      baseId: "leather_cap",
      rarity: "rare",
      itemLevel: 16,
      affixes: [
        { id: "vital", value: 45 },
        { id: "of_haste", value: 20 },
      ],
    },
    {
      uid: 2,
      baseId: "sling",
      rarity: "epic",
      itemLevel: 22,
      affixes: [
        { id: "keen", value: 21 },
        { id: "brutal", value: 30 },
        { id: "of_leeching", value: 8 },
        { id: "of_haste", value: 24 },
      ],
    },
    {
      uid: 3,
      baseId: "iron_gauntlets",
      rarity: "magic",
      itemLevel: 20,
      affixes: [{ id: "sharp", value: 24 }],
    },
    {
      uid: 4,
      baseId: "great_axe",
      rarity: "legendary",
      itemLevel: 15,
      uniqueId: "worldsplitter",
      affixes: [],
    },
    {
      uid: 5,
      baseId: "chainmail",
      rarity: "magic",
      itemLevel: 5,
      affixes: [{ id: "brutal", value: 1 }],
    },
    {
      uid: 6,
      baseId: "javelins",
      rarity: "rare",
      itemLevel: 19,
      affixes: [
        { id: "of_embers", value: 28 },
        { id: "of_frost", value: 48 },
        { id: "fiery", value: 50 },
      ],
    },
    {
      uid: 7,
      baseId: "padded_vest",
      rarity: "rare",
      itemLevel: 22,
      affixes: [{ id: "of_mastery", value: 80, spell: "ice_bolt" }],
    },
  ],
  equipped: {
    helm: 1,
    rangedWeapon: 2,
    hands: 3,
    meleeWeapon: 4,
    trinket1: 6,
    chest: 7,
  },
  nextUid: 8,
};

const affixes = (g: SaveGear, uid: number) =>
  g.items.find((i) => i.uid === uid)!.affixes;

describe("school builds", () => {
  it("swaps offensive affixes for the school's, same tier position", () => {
    const frost = schoolGear(data.catalog, GEAR, "frost");
    expect(affixes(frost, 1)).toEqual([
      { id: "vital", value: 45 },
      { id: "of_quickening", value: 22, spell: "cone_of_cold" },
    ]);
    // Weapon: element prefix, then no other legal prefix keeps Brutal;
    // suffixes: the frost proc, then the old affix.
    expect(affixes(frost, 2).map((a) => a.id)).toEqual([
      "icy",
      "brutal",
      "of_frost",
      "of_haste",
    ]);
    expect(affixes(frost, 2)[0]!.value).toBe(42);
    // Hands take no element or spell prefix: unchanged. Uniques and
    // unequipped items too.
    expect(affixes(frost, 3)).toEqual([{ id: "sharp", value: 24 }]);
    expect(frost.items[3]).toBe(GEAR.items[3]);
    expect(frost.items[4]).toBe(GEAR.items[4]);
    // Affixes already in the school's pool stay (no doubles), re-keyed.
    expect(affixes(frost, 6).map((a) => a.id)).toEqual([
      "of_embers",
      "of_frost",
      "icy",
    ]);
    expect(affixes(frost, 7)).toEqual([
      { id: "of_mastery", value: 80, spell: "blizzard" },
    ]);
    const fire = schoolGear(data.catalog, GEAR, "fire");
    expect(affixes(fire, 1)[1]).toEqual({
      id: "of_mastery",
      value: 54,
      spell: "cone_of_fire",
    });
  });

  it("puts talent points into sorcery for the school, legally", () => {
    const save = {
      ranks: {
        arcane_study: 3,
        kindling: 2,
        overcharge: 1,
        focus: 3,
        meteor_storm: 1,
        sharpened_edge: 3,
        heavy_swing: 2,
        bloodletting: 1,
        iron_hide: 3,
        executioner: 1,
      },
      earned: 20,
    };
    const frost = schoolTalents(data.talents, save, "frost");
    expect(frost.ranks.deep_winter).toBe(1);
    expect(frost.ranks.overcharge).toBeUndefined();
    expect(frost.ranks.executioner).toBe(1);
    expect(talentsLegal(data.talents, frost.ranks)).toBe(true);
    const small = schoolTalents(
      data.talents,
      { ranks: { sharpened_edge: 3, heavy_swing: 2, wide_arc: 1 }, earned: 6 },
      "lightning",
    );
    expect(small.ranks).toEqual({
      arcane_study: 3,
      kindling: 2,
      overcharge: 1,
    });
    // 13 points: 10 in sorcery, 3 left; blade's tier-2 node would need 2
    // points under it, so only the shallow ones stay.
    const mixed = schoolTalents(
      data.talents,
      {
        ranks: {
          sharpened_edge: 3,
          heavy_swing: 2,
          wide_arc: 1,
          steady_aim: 3,
          long_draw: 2,
          arcane_study: 2,
        },
        earned: 13,
      },
      "fire",
    );
    expect(Object.values(mixed.ranks).reduce((a, b) => a + b, 0)).toBe(13);
    expect(talentsLegal(data.talents, mixed.ranks)).toBe(true);
    expect(mixed.ranks.wide_arc).toBeUndefined();
    expect(talentsLegal(data.talents, { focus: 1 })).toBe(false);
    expect(
      talentsLegal(data.talents, {
        arcane_study: 3,
        kindling: 2,
        overcharge: 1,
        deep_winter: 1,
      }),
    ).toBe(false);
  });

  it("rebuilds the whole save with the school's bar", () => {
    const save = {
      gear: GEAR,
      talents: { ranks: { arcane_study: 1 }, earned: 1 },
      spellBar: {
        slots: [
          "fire_nova",
          "arc_bomb",
          "lightning_bolt",
          "water_bolt",
          "fire_bolt",
          "ice_bolt",
          "heal",
          "flash_heal",
        ],
        autoCastSpellIds: [],
      },
    };
    const fire = schoolSave(data.catalog, data.talents, save, "fire");
    expect(fire.spellBar.slots).toEqual([
      "fire_nova",
      "flamestrike",
      "combustion",
      "arc_bomb",
      "cone_of_fire",
      "heal",
      "flash_heal",
      "fire_bolt",
    ]);
    expect(fire.spellBar.autoCastSpellIds).toEqual(fire.spellBar.slots);
    expect(fire.talents.ranks).toEqual({ arcane_study: 1 });
    const short = schoolSave(
      data.catalog,
      data.talents,
      {
        ...save,
        spellBar: {
          slots: ["ice_bolt", "", "", "", "", ""],
          autoCastSpellIds: [],
        },
      },
      "lightning",
    );
    expect(short.spellBar.slots).toHaveLength(6);
  });
});
