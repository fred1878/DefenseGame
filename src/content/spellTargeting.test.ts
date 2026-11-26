import { describe, expect, it } from "vitest";
import {
  spellAutoCastNeedsEnemyTarget,
  spellAutoCastRequiresCombatTarget,
  spellAutoCastUsesRangedEnemyPick,
  spellCastUsesEnemyAim,
  spellRequiresManualTarget,
  spellTargetMode,
  spellUsesManualGroundAim,
  spellChannelTickMs,
  spellCastMs,
  spellRequiresStationary,
} from "./spellTargeting";
import type { SpellDefinition } from "./spells";

function def(partial: Partial<SpellDefinition>): SpellDefinition {
  return {
    id: "x",
    name: "X",
    shortLabel: "X",
    mechanicType: "projectile",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 0,
    channelMs: 0,
    iconFile: "x.png",
    ...partial,
  };
}

describe("spellTargeting", () => {
  it("marks flamestrike as ground manual", () => {
    const d = def({
      id: "flamestrike",
      mechanicType: "blast",
      targetMode: "ground",
    });
    expect(spellTargetMode(d)).toBe("ground");
    expect(spellRequiresManualTarget(d)).toBe(true);
    expect(spellUsesManualGroundAim(d)).toBe(true);
  });

  it("marks fire_blast as ground manual like meteor", () => {
    const d = def({
      id: "fire_blast",
      mechanicType: "blast",
      targetMode: "ground",
    });
    expect(spellTargetMode(d)).toBe("ground");
    expect(spellRequiresManualTarget(d)).toBe(true);
    expect(spellUsesManualGroundAim(d)).toBe(true);
    expect(spellAutoCastRequiresCombatTarget(d)).toBe(true);
  });

  it("flags enemy, cone, and swing spells for auto-cast enemy aim", () => {
    expect(
      spellAutoCastNeedsEnemyTarget(
        def({
          id: "combustion",
          mechanicType: "instant_targeted",
          targetMode: "enemy",
        }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastNeedsEnemyTarget(
        def({ id: "cone_of_cold", mechanicType: "cone" }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastNeedsEnemyTarget(
        def({ id: "cone_of_fire", mechanicType: "channeled_cone" }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastNeedsEnemyTarget(def({ id: "rend", mechanicType: "swing" })),
    ).toBe(true);
    expect(
      spellAutoCastNeedsEnemyTarget(def({ id: "heal", mechanicType: "heal" })),
    ).toBe(false);
    expect(
      spellAutoCastNeedsEnemyTarget(
        def({ id: "fire_nova", mechanicType: "blast", centerOnCaster: true }),
      ),
    ).toBe(false);
  });

  it("uses ranged enemy pick for bolt projectiles", () => {
    expect(spellAutoCastUsesRangedEnemyPick(def({ id: "water_bolt" }))).toBe(
      true,
    );
    expect(
      spellAutoCastUsesRangedEnemyPick(
        def({ id: "arc_bomb", mechanicType: "projectile_aoe" }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastUsesRangedEnemyPick(
        def({ id: "cone_of_cold", mechanicType: "cone" }),
      ),
    ).toBe(false);
  });

  it("flags directed spells that need enemy aim on cast", () => {
    expect(spellCastUsesEnemyAim(def({ id: "water_bolt" }))).toBe(true);
    expect(
      spellCastUsesEnemyAim(def({ id: "heal", mechanicType: "heal" })),
    ).toBe(false);
    expect(
      spellCastUsesEnemyAim(
        def({ id: "cone_of_fire", mechanicType: "channeled_cone" }),
      ),
    ).toBe(true);
  });

  it("requires a combat target for auto-cast ground, enemy, and directional spells", () => {
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "flamestrike", mechanicType: "blast", targetMode: "ground" }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastRequiresCombatTarget(
        def({
          id: "combustion",
          mechanicType: "instant_targeted",
          targetMode: "enemy",
        }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "fireball", mechanicType: "projectile" }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "heal", mechanicType: "heal" }),
      ),
    ).toBe(false);
    expect(spellTargetMode(def({ id: "blink", mechanicType: "blink" }))).toBe(
      "self",
    );
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "blink", mechanicType: "blink" }),
      ),
    ).toBe(false);
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "fire_nova", mechanicType: "blast", centerOnCaster: true }),
      ),
    ).toBe(false);
  });

  it("infers target modes and tick/cast defaults from the mechanic", () => {
    expect(spellTargetMode(def({ mechanicType: "heal" }))).toBe("self");
    expect(spellTargetMode(def({ mechanicType: "buff" }))).toBe("self");
    expect(spellTargetMode(def({ mechanicType: "blink" }))).toBe("self");
    expect(spellTargetMode(def({ mechanicType: "tracking_projectile" }))).toBe(
      "enemy",
    );
    expect(spellTargetMode(def({ mechanicType: "tracking_swing" }))).toBe(
      "enemy",
    );
    expect(spellTargetMode(def({ mechanicType: "channeled_area" }))).toBe(
      "ground",
    );
    expect(spellTargetMode(def({ mechanicType: "blast" }))).toBe("ground");
    expect(
      spellTargetMode(def({ mechanicType: "blast", centerOnCaster: true })),
    ).toBe("none");
    expect(
      spellTargetMode(
        def({ mechanicType: "channeled", centerOnCaster: false }),
      ),
    ).toBe("ground");
    expect(spellTargetMode(def({ mechanicType: "channeled" }))).toBe("none");
    expect(spellTargetMode(def({ mechanicType: "projectile" }))).toBe("none");
    expect(
      spellRequiresManualTarget(
        def({
          mechanicType: "instant_targeted",
          requireEnemyTarget: true,
        }),
      ),
    ).toBe(true);
    expect(spellChannelTickMs(def({}))).toBe(250);
    expect(spellChannelTickMs(def({ channelTickMs: 80 }))).toBe(80);
    expect(spellCastMs(def({}))).toBe(0);
    expect(spellCastMs(def({ castMs: 400 }))).toBe(400);
    expect(spellRequiresStationary(def({ channelMs: 0 }))).toBe(false);
    expect(spellRequiresStationary(def({ channelMs: 500 }))).toBe(true);
    expect(spellRequiresStationary(def({ castMs: 200 }))).toBe(true);
  });
});

describe("spellAutoCastRequiresCombatTarget leftover branches", () => {
  it("requires a combat target for swings that have no explicit target mode", () => {
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "rend", mechanicType: "swing" }),
      ),
    ).toBe(true);
  });
});
