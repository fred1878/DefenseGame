import { describe, expect, it } from "vitest";
import type { PlayerTuning } from "../config/player";
import { gearFixture } from "../test/gearFixture";
import type { ItemInstance, SaveGear } from "./gearTypes";
import {
  armourReduction,
  effectivePlayerTuning,
  emptyGearStats,
  equippedItems,
  gearStatsFor,
  itemPrice,
  resolveItem,
  sellValue,
  sumItemStats,
} from "./itemStats";

const catalog = gearFixture();

function item(p: Partial<ItemInstance> & { uid: number; baseId: string }) {
  return { rarity: "common", itemLevel: 1, affixes: [], ...p } as ItemInstance;
}

const BASE: PlayerTuning = {
  moveSpeedWu: 100,
  meleeWindupMs: 120,
  meleeActiveMs: 120,
  meleeRecoveryMs: 240,
  meleeFxStartMs: 60,
  meleeFxDurationMs: 120,
  meleeStrikeRangeWu: 90,
  meleeEngageTargetRadiusWu: 14,
  meleeActivationSlackWu: 6,
  meleeArcDeg: 120,
  meleeDamage: 15,
  rangedWindupMs: 100,
  rangedActiveMs: 50,
  rangedRecoveryMs: 400,
  rangedDamage: 12,
  rangedMaxRangeWu: 300,
  projectileSpeedWu: 400,
  meleeKnockbackWu: 250,
  rangedKnockbackWu: 100,
  maxHp: 100,
  autoAttackMeleeRange: 98,
  autoAttackRangedRange: 270,
  targetTapRadiusWu: 50,
  playerHitInvulnMs: 0,
  nightSpawnInvulnMs: 1000,
  bodyRadiusWu: 20,
  gearMinAttackSpeedMul: 0.25,
  gearMinMoveSpeedMul: 0.5,
};

describe("resolveItem", () => {
  it("names magic items from their first prefix and suffix", () => {
    const r = resolveItem(
      catalog,
      item({
        uid: 1,
        baseId: "cap",
        rarity: "rare",
        itemLevel: 3,
        affixes: [
          { id: "tough", value: 2 },
          { id: "vital", value: 4 },
          { id: "of_mastery", value: 15, spell: "fire_bolt" },
          { id: "gone", value: 1 },
        ],
      }),
    )!;
    expect(r.name).toBe("Tough Cap of Mastery");
    expect(r.modifiers).toContainEqual({ stat: "armour", value: 2 });
    expect(r.modifiers).toContainEqual({
      stat: "spellDamagePct",
      spell: "fire_bolt",
      value: 15,
    });
    // base 10 × rare 3 × (1 + 2 levels × 10%)
    expect(r.price).toBe(36);
  });

  it("turns proc affixes into procs and uses unique names and prices", () => {
    const blade = resolveItem(
      catalog,
      item({
        uid: 2,
        baseId: "blade",
        affixes: [
          { id: "of_burning", value: 4 },
          { id: "of_chill", value: 30 },
          { id: "of_jolt", value: 300 },
          { id: "hot", value: 3 },
          { id: "of_quick", value: 25 },
        ],
      }),
    )!;
    expect(blade.procs).toEqual([
      { kind: "dot", flavor: "fire", chancePct: 100, dps: 4, ms: 1000 },
      { kind: "slow", chancePct: 100, slowPct: 30, ms: 900 },
      { kind: "stun", chancePct: 100, ms: 300 },
    ]);
    expect(blade.modifiers).toContainEqual({
      stat: "spellCooldownPct",
      spell: "meteor",
      value: 25,
    });
    const unique = resolveItem(
      catalog,
      item({
        uid: 3,
        baseId: "blade",
        rarity: "legendary",
        uniqueId: "flamebrand",
      }),
    )!;
    expect(unique.name).toBe("Flamebrand");
    expect(unique.price).toBe(300);
    expect(unique.procs).toHaveLength(1);
  });

  it("falls back to the first listed spell when a keyed affix has none", () => {
    const r = resolveItem(
      catalog,
      item({ uid: 4, baseId: "band", affixes: [{ id: "of_quick", value: 5 }] }),
    )!;
    expect(r.modifiers).toContainEqual({
      stat: "spellCooldownPct",
      spell: "meteor",
      value: 5,
    });
  });

  it("returns null for removed bases, uniques or rarities", () => {
    expect(resolveItem(catalog, item({ uid: 1, baseId: "ghost" }))).toBeNull();
    expect(
      resolveItem(
        catalog,
        item({ uid: 1, baseId: "blade", uniqueId: "ghost" }),
      ),
    ).toBeNull();
    expect(
      resolveItem(
        catalog,
        item({ uid: 1, baseId: "blade", rarity: "mythic" as never }),
      ),
    ).toBeNull();
  });
});

describe("prices", () => {
  it("never goes below 1 and sells for the given percent", () => {
    const cap = catalog.bases.cap!;
    expect(
      itemPrice(catalog, { ...cap, price: 0 }, catalog.rarities.common, 1),
    ).toBe(1);
    expect(sellValue(55, 50)).toBe(27);
    expect(sellValue(-5, 50)).toBe(0);
  });
});

describe("gear stats", () => {
  const gear: SaveGear = {
    items: [
      item({
        uid: 1,
        baseId: "blade",
        affixes: [
          { id: "of_haste", value: 10 },
          { id: "hot", value: 3 },
        ],
      }),
      item({ uid: 2, baseId: "bow", itemLevel: 2 }),
      item({ uid: 3, baseId: "cap" }),
      item({
        uid: 4,
        baseId: "band",
        affixes: [{ id: "of_haste", value: 60 }],
      }),
      item({
        uid: 5,
        baseId: "blade",
        rarity: "legendary",
        uniqueId: "flamebrand",
      }),
      item({
        uid: 6,
        baseId: "band",
        affixes: [{ id: "of_quick", value: 25 }],
      }),
    ],
    equipped: {
      meleeWeapon: 1,
      rangedWeapon: 2,
      helm: 3,
      ring1: 4,
      ring2: 6,
      trinket1: 99,
    },
    nextUid: 7,
  };

  it("sums equipped items, applies caps and records weapons", () => {
    expect(equippedItems(catalog, gear)).toHaveLength(5);
    const s = gearStatsFor(catalog, gear);
    expect(s.flat.armour).toBe(10);
    expect(s.flat.maxHp).toBe(5);
    expect(s.flat.spellPowerPct).toBe(20);
    expect(s.flat.attackSpeedPct).toBe(50); // 70 capped at 50
    expect(s.elementDamagePct.fire).toBe(3);
    expect(s.spellCooldownPct.meteor).toBe(25);
    expect(s.melee?.damage).toBe(20);
    expect(s.ranged?.projectile).toBe("fx_fire_bolt");
  });

  it("caps per-spell cooldown reduction", () => {
    const flame = resolveItem(
      catalog,
      item({
        uid: 5,
        baseId: "blade",
        rarity: "legendary",
        uniqueId: "flamebrand",
      }),
    )!;
    const band = resolveItem(
      catalog,
      item({
        uid: 6,
        baseId: "band",
        affixes: [{ id: "of_quick", value: 25 }],
      }),
    )!;
    const s = sumItemStats(catalog, [flame, band]);
    expect(s.spellCooldownPct.meteor).toBe(40);
    expect(s.flat.lifestealPct).toBe(20);
    expect(s.procs).toHaveLength(1);
  });

  it("works without spell cooldown caps", () => {
    const c = { ...catalog, statCaps: {} };
    const band = resolveItem(
      c,
      item({
        uid: 6,
        baseId: "band",
        affixes: [{ id: "of_quick", value: 90 }],
      }),
    )!;
    expect(sumItemStats(c, [band]).spellCooldownPct.meteor).toBe(90);
  });

  it("computes armour reduction with a cap", () => {
    expect(armourReduction(catalog, 0)).toBe(0);
    expect(armourReduction(catalog, 50)).toBeCloseTo(0.5);
    expect(armourReduction(catalog, 10_000)).toBeCloseTo(0.6);
  });
});

describe("effectivePlayerTuning", () => {
  it("returns the base values with no gear", () => {
    expect(effectivePlayerTuning(BASE, emptyGearStats())).toEqual(BASE);
  });

  it("uses weapon profiles, attack speed and flat stats", () => {
    const s = emptyGearStats();
    s.melee = {
      style: "spear",
      damage: 20,
      windupMs: 150,
      activeMs: 100,
      recoveryMs: 300,
      rangeWu: 130,
      arcDeg: 50,
      knockbackWu: 200,
    };
    s.ranged = {
      style: "bow",
      damage: 10,
      windupMs: 100,
      activeMs: 50,
      recoveryMs: 300,
      rangeWu: 400,
      projectileSpeedWu: 600,
      knockbackWu: 80,
      projectile: "fx_stone_throw",
    };
    s.flat.attackSpeedPct = 50;
    s.flat.damagePct = 10;
    s.flat.meleeDamage = 2;
    s.flat.rangedDamage = 1;
    s.flat.moveSpeedPct = 20;
    s.flat.maxHp = 25;
    const t = effectivePlayerTuning(BASE, s);
    expect(t.meleeWindupMs).toBeCloseTo(100);
    expect(t.meleeActiveMs).toBeCloseTo(66.667, 2);
    expect(t.meleeRecoveryMs).toBeCloseTo(200);
    expect(t.meleeFxStartMs).toBeCloseTo(50);
    expect(t.meleeFxDurationMs).toBeCloseTo(66.667, 2);
    expect(t.meleeDamage).toBeCloseTo(24.2);
    expect(t.meleeArcDeg).toBe(50);
    expect(t.meleeStrikeRangeWu).toBe(130);
    expect(t.autoAttackMeleeRange).toBe(138);
    expect(t.rangedDamage).toBeCloseTo(12.1);
    expect(t.rangedMaxRangeWu).toBe(400);
    expect(t.autoAttackRangedRange).toBeCloseTo(360);
    expect(t.projectileSpeedWu).toBe(600);
    expect(t.rangedKnockbackWu).toBe(80);
    expect(t.moveSpeedWu).toBeCloseTo(120);
    expect(t.maxHp).toBe(125);
  });

  it("clamps extreme negative stats and handles zero-length bases", () => {
    const s = emptyGearStats();
    s.flat.attackSpeedPct = -500;
    s.flat.moveSpeedPct = -500;
    s.flat.damagePct = -500;
    s.flat.maxHp = -500;
    const { meleeFxDurationMs: _omit, ...noFx } = BASE;
    const t = effectivePlayerTuning(
      { ...noFx, meleeWindupMs: 0, meleeFxStartMs: 0 },
      s,
    );
    expect(t.meleeRecoveryMs).toBeCloseTo(960);
    expect(t.moveSpeedWu).toBeCloseTo(50);
    expect(t.meleeDamage).toBe(1);
    expect(t.maxHp).toBe(1);
    expect(t.meleeFxStartMs).toBe(0);
    expect(t.meleeFxDurationMs).toBeUndefined();
  });
});
