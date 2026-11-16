import { describe, expect, it } from "vitest";
import { spellNeedsGroundAoeTelegraph } from "./SpellGroundAoeTelegraph";
import type { SpellDefinition } from "../content/spells";

function def(partial: Partial<SpellDefinition>): SpellDefinition {
  return {
    id: "x",
    name: "X",
    shortLabel: "X",
    mechanicType: "blast",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 0,
    channelMs: 0,
    kind: "instant",
    iconFile: "x.png",
    ...partial,
  };
}

describe("spellNeedsGroundAoeTelegraph", () => {
  it("includes ground-target meteor, blizzard, and flamestrike", () => {
    expect(
      spellNeedsGroundAoeTelegraph(
        def({ id: "meteor", targetMode: "ground", blastRadius: 44, castMs: 1100 }),
      ),
    ).toBe(true);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({
          id: "blizzard",
          mechanicType: "channeled",
          targetMode: "ground",
          blastRadius: 80,
          channelMs: 4000,
          castMs: 800,
          kind: "channeled",
        }),
      ),
    ).toBe(true);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({
          id: "flamestrike",
          mechanicType: "channeled_area",
          targetMode: "ground",
          blastRadius: 78,
          channelMs: 3500,
          castMs: 650,
          kind: "channeled",
        }),
      ),
    ).toBe(true);
  });

  it("skips non-ground and radius-less spells", () => {
    expect(
      spellNeedsGroundAoeTelegraph(def({ id: "fire_nova", centerOnCaster: true })),
    ).toBe(false);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({ id: "meteor", targetMode: "ground", blastRadius: 0, castMs: 500 }),
      ),
    ).toBe(false);
  });
});