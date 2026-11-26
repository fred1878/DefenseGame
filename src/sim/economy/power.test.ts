import { describe, expect, it } from "vitest";
import { setSpellCatalog } from "../../content/spells";
import { createEmptyGear } from "../../gear/saveGear";
import type { SaveGear } from "../../gear/gearTypes";
import {
  DEFAULT_POWER_MODEL,
  nightPressure,
  playerPower,
  winChance,
} from "./power";
import { defaultRawData, loadSimData, type NightDifficulty } from "./simData";

const data = loadSimData(defaultRawData());

function gearWith(
  items: {
    uid: number;
    baseId: string;
    affixes?: { id: string; value: number; spell?: string }[];
    uniqueId?: string;
    rarity?: "common" | "legendary";
  }[],
  slots: Record<string, number>,
): SaveGear {
  return {
    items: items.map((i) => ({
      uid: i.uid,
      baseId: i.baseId,
      rarity: i.rarity ?? "common",
      itemLevel: 5,
      affixes: i.affixes ?? [],
      ...(i.uniqueId ? { uniqueId: i.uniqueId } : {}),
    })),
    equipped: slots,
    nextUid: 100,
  };
}

const night: NightDifficulty = {
  night: 1,
  rewardGold: 10,
  enemyCount: 4,
  totalHp: 300,
  totalDamage: 40,
  totalWallDamage: 20,
  spawnSpanSec: 10,
};

describe("power", () => {
  it("rates the bare player from player.json", () => {
    const p = playerPower(data.catalog, createEmptyGear());
    // 15 dmg / (120+120+260 ms) = 30 DPS melee; 12 / 530 ms ranged.
    expect(p.meleeDps).toBeCloseTo(30);
    expect(p.rangedDps).toBeCloseTo(12 / 0.53);
    expect(p.weaponDps).toBeCloseTo(30);
    expect(p.procDps).toBe(0);
    expect(p.spellMult).toBe(1);
    expect(p.spellDps).toBe(DEFAULT_POWER_MODEL.spellBaseDps);
    expect(p.ehp).toBe(100);
    expect(p.damageReduction).toBe(0);
  });

  it("adds armour, attack speed, spell power and burn procs", () => {
    const gear = gearWith(
      [
        {
          uid: 1,
          baseId: "chainmail",
          affixes: [
            { id: "sturdy", value: 20 },
            { id: "arcane", value: 10 },
          ],
        },
        {
          uid: 2,
          baseId: "iron_sword",
          affixes: [
            { id: "of_haste", value: 10 },
            { id: "of_embers", value: 8 },
          ],
        },
      ],
      { chest: 1, meleeWeapon: 2 },
    );
    const p = playerPower(data.catalog, gear);
    expect(p.armour).toBeGreaterThan(20);
    expect(p.damageReduction).toBeGreaterThan(0);
    expect(p.ehp).toBeGreaterThan(100);
    expect(p.attackSpeedPct).toBe(10);
    expect(p.spellPowerPct).toBe(10);
    expect(p.spellMult).toBeGreaterThan(1.09);
    expect(p.procDps).toBeGreaterThan(0);
  });

  it("uses the ranged weapon's procs when ranged is stronger", () => {
    const gear = gearWith(
      [
        {
          uid: 1,
          baseId: "heavy_crossbow",
          affixes: [
            { id: "keen", value: 40 },
            { id: "of_embers", value: 8 },
          ],
        },
      ],
      { rangedWeapon: 1 },
    );
    const p = playerPower(data.catalog, gear);
    expect(p.rangedDps).toBeGreaterThan(p.meleeDps);
    expect(p.procDps).toBeGreaterThan(0);
  });

  it("falls back to a spell multiplier of 1 with no damaging bar spells", () => {
    setSpellCatalog([]);
    try {
      const p = playerPower(data.catalog, createEmptyGear());
      expect(p.spellMult).toBe(1);
    } finally {
      setSpellCatalog(data.spells);
    }
  });

  it("turns power into a pressure ratio and win chance", () => {
    const p = playerPower(data.catalog, createEmptyGear());
    const easy = nightPressure(p, night, 100);
    expect(easy.requiredDps).toBeCloseTo(300 / 30);
    expect(easy.powerRatio).toBeGreaterThan(1);
    expect(easy.winChance).toBeGreaterThan(0.5);
    const boosted = nightPressure(p, night, 100, DEFAULT_POWER_MODEL, {
      healHp: 100,
      bombDamage: 100,
    });
    expect(boosted.offenceRatio).toBeGreaterThan(easy.offenceRatio);
    expect(boosted.defenceRatio).toBeGreaterThan(easy.defenceRatio);
    const empty = nightPressure(
      p,
      { ...night, totalHp: 0, totalDamage: 0, totalWallDamage: 0 },
      100,
    );
    expect(empty.offenceRatio).toBe(10);
    // Lifesteal heals a share of weapon damage over the fight into EHP.
    const leech = nightPressure({ ...p, lifestealPct: 10 }, night, 100);
    expect(leech.defenceRatio).toBeGreaterThan(easy.defenceRatio);
    expect(p.lifestealPct).toBe(0);
  });

  it("maps ratio 1 to a coin flip", () => {
    expect(winChance(1, 3)).toBe(0.5);
    expect(winChance(0, 3)).toBe(0);
    expect(winChance(2, 3)).toBeCloseTo(8 / 9);
  });
});
