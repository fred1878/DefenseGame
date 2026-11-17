import { describe, expect, it } from "vitest";
import {
  spellAutoCastNeedsEnemyTarget,
  spellAutoCastRequiresCombatTarget,
  spellRequiresManualTarget,
  spellTargetMode,
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
    kind: "instant",
    iconFile: "x.png",
    ...partial,
  };
}

describe("spellTargeting", () => {
  it("marks flamestrike as ground manual", () => {
    const d = def({
      id: "flamestrike",
      mechanicType: "channeled_area",
      targetMode: "ground",
    });
    expect(spellTargetMode(d)).toBe("ground");
    expect(spellRequiresManualTarget(d)).toBe(true);
  });

  it("flags enemy, cone, and swing spells for auto-cast enemy aim", () => {
    expect(
      spellAutoCastNeedsEnemyTarget(
        def({ id: "combustion", mechanicType: "instant_targeted", targetMode: "enemy" }),
      ),
    ).toBe(true);
    expect(spellAutoCastNeedsEnemyTarget(def({ id: "cone_of_cold", mechanicType: "cone" }))).toBe(
      true,
    );
    expect(spellAutoCastNeedsEnemyTarget(def({ id: "rend", mechanicType: "swing" }))).toBe(true);
    expect(spellAutoCastNeedsEnemyTarget(def({ id: "heal", mechanicType: "heal" }))).toBe(false);
    expect(
      spellAutoCastNeedsEnemyTarget(
        def({ id: "fire_nova", mechanicType: "blast", centerOnCaster: true }),
      ),
    ).toBe(false);
  });

  it("requires a combat target for auto-cast ground, enemy, and directional spells", () => {
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "flamestrike", mechanicType: "channeled_area", targetMode: "ground" }),
      ),
    ).toBe(true);
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "combustion", mechanicType: "instant_targeted", targetMode: "enemy" }),
      ),
    ).toBe(true);
    expect(spellAutoCastRequiresCombatTarget(def({ id: "fireball", mechanicType: "projectile" }))).toBe(
      true,
    );
    expect(spellAutoCastRequiresCombatTarget(def({ id: "heal", mechanicType: "heal" }))).toBe(false);
    expect(
      spellAutoCastRequiresCombatTarget(
        def({ id: "fire_nova", mechanicType: "blast", centerOnCaster: true }),
      ),
    ).toBe(false);
  });
});