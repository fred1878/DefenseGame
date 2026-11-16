import { describe, expect, it } from "vitest";
import { spellRequiresManualTarget, spellTargetMode } from "./spellTargeting";
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
});