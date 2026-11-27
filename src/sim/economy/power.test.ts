import { describe, expect, it } from "vitest";
import { setSpellCatalog } from "../../content/spells";
import { createEmptyGear } from "../../gear/saveGear";
import type { SaveGear } from "../../gear/gearTypes";
import {
  crowdTargets,
  DEFAULT_POWER_MODEL,
  nightPressure,
  playerPower,
  spellAreaWu2,
  autoCastRates,
  spellCastDamage,
  spellDpsFor,
  winChance,
} from "./power";
import { autoCastOrder } from "./spellBars";
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
    expect(p.spells.length).toBeGreaterThan(0);
    expect(p.spellDps).toBeCloseTo(
      p.spells.reduce((a, s) => a + spellDpsFor(s, DEFAULT_POWER_MODEL), 0),
    );
    // One filler (fire bolt) closes the bar; the other fillers are dropped.
    expect(p.spells.map((s) => s.id)).not.toContain("water_bolt");
    expect(p.spells.map((s) => s.id)).not.toContain("ice_bolt");
    // Moving: only instant spells (fire nova) fire.
    expect(
      p.spells.find((s) => s.id === "fire_nova")!.movingDps,
    ).toBeGreaterThan(0);
    expect(p.spells.find((s) => s.id === "fire_bolt")!.movingDps).toBe(0);
    expect(
      p.spells.find((s) => s.id === "fire_bolt")!.stillDps,
    ).toBeGreaterThan(0);
    expect(p.meleeBest).toBe(true);
    // 121° arc × 93 wu reach.
    expect(p.meleeAreaWu2).toBeCloseTo((121 / 360) * Math.PI * 93 ** 2);
    expect(p.ccUptime).toBe(0);
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

  it("adds talent bonuses and shortens spell cooldowns", () => {
    const base = playerPower(data.catalog, createEmptyGear());
    const p = playerPower(
      data.catalog,
      createEmptyGear(),
      DEFAULT_POWER_MODEL,
      {
        modifiers: [
          { stat: "meleeDamage", value: 3 },
          { stat: "cooldownPct", value: 20 },
        ],
        procs: [],
      },
    );
    expect(p.meleeDps).toBeGreaterThan(base.meleeDps);
    expect(p.spellDps).toBeGreaterThan(base.spellDps);
    const capped = playerPower(
      data.catalog,
      createEmptyGear(),
      DEFAULT_POWER_MODEL,
      {
        modifiers: [{ stat: "cooldownPct", value: 500 }],
        procs: [],
      },
    );
    expect(Number.isFinite(capped.spellDps)).toBe(true);
    expect(capped.spellDps).toBeGreaterThan(p.spellDps);
  });

  it("turns slow and stun procs into crowd-control uptime", () => {
    const p = playerPower(
      data.catalog,
      createEmptyGear(),
      DEFAULT_POWER_MODEL,
      {
        modifiers: [],
        procs: [
          { kind: "slow", chancePct: 40, slowPct: 35, ms: 1500 },
          { kind: "stun", chancePct: 15, ms: 400 },
        ],
      },
    );
    expect(p.ccUptime).toBeGreaterThan(0);
    expect(p.ccUptime).toBeLessThanOrEqual(1);
    const lots = playerPower(
      data.catalog,
      createEmptyGear(),
      DEFAULT_POWER_MODEL,
      {
        modifiers: [],
        procs: [{ kind: "stun", chancePct: 100, ms: 60000 }],
      },
    );
    expect(lots.ccUptime).toBe(1);
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
    expect(easy.requiredDps).toBeCloseTo(
      300 / (night.spawnSpanSec + DEFAULT_POWER_MODEL.graceSec),
    );
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

  it("lets area attacks hit crowds and fast kills cut incoming damage", () => {
    const p = playerPower(data.catalog, createEmptyGear());
    const crowd: NightDifficulty = {
      ...night,
      enemyCount: 40,
      totalHp: 4000,
      totalDamage: 400,
      totalWallDamage: 200,
    };
    // Full melee crowd hits and a modest crowd area for the checks below.
    const m = { ...DEFAULT_POWER_MODEL, weaponCrowd: 1, crowdAreaWu2: 40000 };
    const r = nightPressure(p, crowd, 100, m);
    expect(r.alive).toBeGreaterThan(1);
    expect(r.weaponTargets).toBeGreaterThan(1);
    expect(r.effectiveDps).toBeGreaterThan(p.offenceDps);
    const ranged = nightPressure({ ...p, meleeBest: false }, crowd, 100, m);
    expect(ranged.weaponTargets).toBe(1);
    // The fitted default: swings hit one enemy (knockback scatters packs).
    expect(nightPressure(p, crowd, 100).weaponTargets).toBe(1);
    // A tighter crowd (smaller spread area) means more targets per swing.
    const tight = nightPressure(p, crowd, 100, { ...m, crowdAreaWu2: 5000 });
    expect(tight.effectiveDps).toBeGreaterThan(r.effectiveDps);
    // Exposure 0 is the old flat threat; with exposure, faster kills defend.
    const flat = nightPressure(p, crowd, 100, { ...m, exposure: 0 });
    expect(flat.defenceRatio).not.toBeCloseTo(r.defenceRatio);
    // Slow / stun procs take a share off incoming damage.
    const cc = nightPressure({ ...p, ccUptime: 0.5 }, crowd, 100, m);
    expect(cc.defenceRatio).toBeGreaterThan(r.defenceRatio);
    // One enemy: everything is single target.
    const solo = nightPressure(p, { ...night, enemyCount: 1 }, 100, m);
    expect(solo.alive).toBe(1);
    expect(solo.weaponTargets).toBe(1);
    expect(crowdTargets(1, 1000, DEFAULT_POWER_MODEL)).toBe(1);
    expect(crowdTargets(10, 0, DEFAULT_POWER_MODEL)).toBe(1);
    expect(crowdTargets(11, 1e9, DEFAULT_POWER_MODEL)).toBe(11);
  });

  it("measures spell areas and max cast rates from spells.json", () => {
    const def = (id: string) => data.spells.find((s) => s.id === id)!;
    expect(spellAreaWu2(def("fire_bolt"))).toBe(0);
    expect(spellAreaWu2(def("fire_nova"))).toBeCloseTo(Math.PI * 100 ** 2);
    expect(spellAreaWu2(def("cone_of_cold"))).toBeCloseTo(
      (90 / 360) * Math.PI * 200 ** 2,
    );
    expect(spellAreaWu2(def("rend"))).toBeCloseTo(
      (110 / 360) * Math.PI * 72 ** 2,
    );
    expect(spellAreaWu2(def("chain_lightning"))).toBeCloseTo(
      Math.PI * 110 ** 2,
    );
    expect(
      spellAreaWu2({ ...def("chain_lightning"), chainLightningHops: 0 }),
    ).toBe(0);
    expect(
      spellAreaWu2({
        ...def("cone_of_cold"),
        coneArcDeg: undefined,
        coneRangeWu: undefined,
      } as never),
    ).toBe(0);
    expect(
      spellAreaWu2({
        ...def("rend"),
        swingArcDeg: undefined,
        swingRangeWu: undefined,
      } as never),
    ).toBe(0);
    expect(
      spellAreaWu2({
        ...def("chain_lightning"),
        chainLightningHopRangeWu: undefined,
      } as never),
    ).toBe(0);
    // Fire bolt: 40 + 6 dps × 2.5 s burn.
    expect(spellCastDamage(def("fire_bolt"))).toBe(55);
    expect(spellCastDamage(def("heal"))).toBe(0);
  });

  it("orders auto-cast by cooldown and replays the game's slot priority", () => {
    const bar = autoCastOrder([
      "fire_bolt",
      "heal",
      "lightning_bolt",
      "fire_nova",
      "missing" as never,
    ]);
    expect(bar).toEqual(["fire_nova", "heal", "lightning_bolt", "fire_bolt"]);
    // Standing: lightning every 3 s, fire bolt fills the gaps (800 ms casts).
    const still = autoCastRates(["lightning_bolt", "fire_bolt"], 0, false);
    expect(still.get("lightning_bolt")).toBeCloseTo(1 / 3, 1);
    expect(still.get("fire_bolt")!).toBeGreaterThan(0.8);
    // Moving: cast-windup spells never fire.
    const moving = autoCastRates(
      ["lightning_bolt", "fire_bolt", "water_bolt"],
      0,
      true,
    );
    expect(moving.get("lightning_bolt")).toBeUndefined();
    expect(moving.get("water_bolt")).toBeCloseTo(1 / 0.15, 0);
    // Cooldown reduction casts more often; an empty bar casts nothing.
    const fast = autoCastRates(["lightning_bolt", "fire_bolt"], 50, false);
    expect(fast.get("lightning_bolt")!).toBeGreaterThan(
      still.get("lightning_bolt")!,
    );
    expect(autoCastRates([], 0, false).size).toBe(0);
  });

  it("maps ratio 1 to a coin flip", () => {
    expect(winChance(1, 3)).toBe(0.5);
    expect(winChance(0, 3)).toBe(0);
    expect(winChance(2, 3)).toBeCloseTo(8 / 9);
  });
});
