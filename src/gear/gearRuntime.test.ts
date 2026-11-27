import { afterEach, describe, expect, it, vi } from "vitest";
import { EnemySpellStatusMap } from "../combat/enemySpellStatus";
import type { Damageable } from "../combat/DamageSystem";
import { PLAYER_TUNING } from "../config";
import { basePlayerTuning } from "../config/player";
import { playerIncomingDamageMult } from "../combat/shadowformRuntime";
import { gearFixture } from "../test/gearFixture";
import { getGearCatalog, setGearCatalog } from "./gearCatalog";
import { applyWeaponHitEffects } from "./gearProcs";
import {
  applyGearLoadout,
  gearDamageTakenMult,
  gearRangedProjectile,
  gearSpellCooldownMul,
  gearSpellDamageMult,
  gearWeaponProcs,
  takeLifestealHeal,
} from "./gearRuntime";
import type { ItemInstance, SaveGear } from "./gearTypes";
import { createEmptyGear } from "./saveGear";

const catalog = gearFixture();

function gearOf(items: Omit<ItemInstance, "uid">[], slots: string[]): SaveGear {
  const withUid = items.map((it, i) => ({ ...it, uid: i + 1 }));
  return {
    items: withUid,
    equipped: Object.fromEntries(slots.map((s, i) => [s, i + 1])),
    nextUid: withUid.length + 1,
  };
}

const LOADOUT = gearOf(
  [
    {
      baseId: "blade",
      rarity: "legendary",
      itemLevel: 6,
      uniqueId: "flamebrand",
      affixes: [],
    },
    { baseId: "bow", rarity: "common", itemLevel: 2, affixes: [] },
    {
      baseId: "cap",
      rarity: "magic",
      itemLevel: 1,
      affixes: [{ id: "of_mastery", value: 15, spell: "fire_bolt" }],
    },
    {
      baseId: "band",
      rarity: "magic",
      itemLevel: 1,
      affixes: [{ id: "hot", value: 3 }],
    },
  ],
  ["meleeWeapon", "rangedWeapon", "helm", "ring1"],
);

function damageable(hp: number): Damageable {
  return { id: "player", hp, maxHp: 100, alive: true, team: "player" };
}

describe("gearRuntime", () => {
  afterEach(() => {
    applyGearLoadout(createEmptyGear(), catalog);
  });

  it("is neutral with no gear", () => {
    applyGearLoadout(createEmptyGear(), catalog);
    expect(PLAYER_TUNING).toEqual(basePlayerTuning());
    expect(gearDamageTakenMult()).toBe(1);
    expect(gearSpellDamageMult()).toBe(1);
    expect(gearSpellCooldownMul("meteor")).toBe(1);
    expect(gearWeaponProcs()).toEqual([]);
    expect(gearRangedProjectile()).toBeNull();
    expect(takeLifestealHeal(100)).toBe(0);
  });

  it("applies weapons, armour, spell and cooldown bonuses", () => {
    const stats = applyGearLoadout(LOADOUT, catalog);
    expect(stats.flat.armour).toBe(10);
    expect(PLAYER_TUNING.meleeDamage).toBe(20);
    expect(PLAYER_TUNING.rangedMaxRangeWu).toBe(400);
    expect(PLAYER_TUNING.maxHp).toBe(basePlayerTuning().maxHp + 5);
    expect(gearDamageTakenMult()).toBeCloseTo(1 - 10 / 60);
    expect(playerIncomingDamageMult()).toBeCloseTo(1 - 10 / 60);
    expect(gearSpellDamageMult()).toBeCloseTo(1.1);
    expect(
      gearSpellDamageMult({ id: "fire_bolt", damageFlavor: "fire" }),
    ).toBeCloseTo(1.1 * 1.03 * 1.15);
    expect(gearSpellDamageMult({ id: "x", damageFlavor: "frost" })).toBeCloseTo(
      1.1,
    );
    expect(gearSpellCooldownMul("meteor")).toBeCloseTo(0.7);
    expect(gearRangedProjectile()).toEqual({
      textureKey: "fx_fire_bolt",
      tint: 0x112233,
    });
    expect(gearWeaponProcs()).toHaveLength(1);
  });

  it("carries fractional lifesteal between hits", () => {
    applyGearLoadout(LOADOUT, catalog); // lifesteal capped at 20%
    expect(takeLifestealHeal(3)).toBe(0); // 0.6
    expect(takeLifestealHeal(3)).toBe(1); // 1.2 → 1, carry 0.2
    expect(takeLifestealHeal(0)).toBe(0);
    expect(takeLifestealHeal(4)).toBe(1); // 0.2 + 0.8
  });

  it("uses the active catalog by default", () => {
    const prev = getGearCatalog();
    setGearCatalog(catalog);
    try {
      expect(applyGearLoadout(LOADOUT).flat.armour).toBe(10);
    } finally {
      setGearCatalog(prev);
    }
  });
});

describe("applyWeaponHitEffects", () => {
  afterEach(() => {
    applyGearLoadout(createEmptyGear(), catalog);
  });

  it("heals from lifesteal and rolls each proc", () => {
    const procBlade = gearOf(
      [
        {
          baseId: "blade",
          rarity: "rare",
          itemLevel: 1,
          affixes: [
            { id: "of_burning", value: 4 },
            { id: "of_chill", value: 30 },
          ],
        },
        {
          baseId: "blade",
          rarity: "legendary",
          itemLevel: 6,
          uniqueId: "flamebrand",
          affixes: [],
        },
      ],
      ["meleeWeapon", "trinket1"],
    );
    // Flamebrand in a trinket slot is ignored by normalize but counted raw here.
    applyGearLoadout(procBlade, catalog);
    const status = new EnemySpellStatusMap();
    const dot = vi.spyOn(status, "applyDot");
    const slow = vi.spyOn(status, "applySlow");
    const stun = vi.spyOn(status, "applyStun");
    const player = damageable(50);
    applyWeaponHitEffects({
      enemyId: "e1",
      damage: 10,
      status,
      player,
      rng: () => 0.99,
    });
    expect(player.hp).toBe(52);
    expect(dot).toHaveBeenCalledWith("e1", 4, 1000, "fire");
    expect(slow).toHaveBeenCalledWith("e1", 30, 900);
    // Flamebrand dot is 50%: a 0.99 roll misses it.
    expect(dot).toHaveBeenCalledTimes(1);
    expect(stun).not.toHaveBeenCalled();
  });

  it("applies stun procs and defaults to Math.random", () => {
    const jolt = gearOf(
      [
        {
          baseId: "blade",
          rarity: "magic",
          itemLevel: 1,
          affixes: [{ id: "of_jolt", value: 300 }],
        },
      ],
      ["meleeWeapon"],
    );
    applyGearLoadout(jolt, catalog);
    const status = new EnemySpellStatusMap();
    const stun = vi.spyOn(status, "applyStun");
    applyWeaponHitEffects({
      enemyId: "e2",
      damage: 5,
      status,
      player: damageable(10),
    });
    expect(stun).toHaveBeenCalledWith("e2", 300);
  });
});
