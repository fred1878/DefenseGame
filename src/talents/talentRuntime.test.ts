import { afterEach, describe, expect, it } from "vitest";
import { PLAYER_TUNING } from "../config";
import { basePlayerTuning } from "../config/player";
import { getGearCatalog } from "../gear/gearCatalog";
import {
  applyGearLoadout,
  gearSpellCooldownMul,
  gearSpellDamageMult,
  gearWeaponProcs,
} from "../gear/gearRuntime";
import { modifierLabel } from "../gear/gearText";
import { effectivePlayerTuning, gearStatsFor } from "../gear/itemStats";
import { createEmptyGear } from "../gear/saveGear";
import { gearFixture } from "../test/gearFixture";
import { talentFixture } from "../test/talentFixture";
import { getTalentCatalog, setTalentCatalog } from "./talentCatalog";
import { applySaveLoadout, saveTalentBonus } from "./talentRuntime";

const tree = talentFixture();

describe("talent runtime", () => {
  afterEach(() => {
    applyGearLoadout(createEmptyGear());
  });

  it("returns no bonus for saves without a talents block", () => {
    expect(
      saveTalentBonus({ talents: undefined as never }, tree).modifiers,
    ).toEqual([]);
  });

  it("stacks learned talents into combat stats with gear", () => {
    const save = {
      gear: createEmptyGear(),
      talents: { ranks: { a1: 2, a2x: 1, a3: 1, b1: 1 }, earned: 9 },
    };
    const stats = applySaveLoadout(save, getGearCatalog(), tree);
    expect(stats.flat.meleeDamage).toBe(6);
    expect(stats.flat.maxHp).toBe(5);
    expect(PLAYER_TUNING.meleeDamage).toBe(basePlayerTuning().meleeDamage + 6);
    // 10% global + 5% meteor-only cooldown.
    expect(gearSpellCooldownMul("meteor")).toBeCloseTo(0.85);
    expect(gearSpellCooldownMul("fire_bolt")).toBeCloseTo(0.9);
    expect(
      gearSpellDamageMult({ id: "meteor", damageFlavor: "fire" }),
    ).toBeCloseTo(1.1 * 1.05);
    expect(gearWeaponProcs()).toEqual([]);
  });

  it("caps total cooldown reduction at statCaps.spellCooldownPct", () => {
    const capped = gearFixture();
    applyGearLoadout(createEmptyGear(), capped, {
      modifiers: [{ stat: "cooldownPct", value: 90 }],
      procs: [{ kind: "stun", chancePct: 5, ms: 100 }],
    });
    // gearFixture caps spellCooldownPct at 40.
    expect(gearSpellCooldownMul("any")).toBeCloseTo(0.6);
    expect(gearWeaponProcs()).toHaveLength(1);
    applyGearLoadout(
      createEmptyGear(),
      { ...capped, statCaps: {} },
      {
        modifiers: [{ stat: "cooldownPct", value: 30 }],
        procs: [],
      },
    );
    expect(gearSpellCooldownMul("any")).toBeCloseTo(0.7);
  });

  it("weapon-style stats widen the arc and extend range", () => {
    const stats = gearStatsFor(getGearCatalog(), createEmptyGear(), {
      modifiers: [
        { stat: "meleeArcPct", value: 50 },
        { stat: "rangedRangePct", value: 25 },
      ],
      procs: [],
    });
    const base = basePlayerTuning();
    const t = effectivePlayerTuning(base, stats);
    expect(t.meleeArcDeg).toBeCloseTo(Math.min(360, base.meleeArcDeg * 1.5));
    expect(t.rangedMaxRangeWu).toBeCloseTo(base.rangedMaxRangeWu * 1.25);
    expect(t.autoAttackRangedRange).toBeCloseTo(
      base.autoAttackRangedRange * 1.25,
    );
    const huge = gearStatsFor(getGearCatalog(), createEmptyGear(), {
      modifiers: [{ stat: "meleeArcPct", value: 500 }],
      procs: [],
    });
    expect(effectivePlayerTuning(base, huge).meleeArcDeg).toBe(360);
  });

  it("labels the new stats", () => {
    expect(modifierLabel({ stat: "cooldownPct", value: 5 })).toBe(
      "−5% Spell cooldowns",
    );
    expect(modifierLabel({ stat: "meleeArcPct", value: 30 })).toBe(
      "+30% Melee arc",
    );
  });

  it("falls back to the bundled tree and can be replaced", () => {
    const shipped = getTalentCatalog();
    expect(shipped.branches).toHaveLength(3);
    setTalentCatalog(tree);
    expect(getTalentCatalog()).toBe(tree);
    setTalentCatalog(shipped);
  });
});
