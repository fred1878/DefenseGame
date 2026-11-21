import { describe, expect, it, vi } from "vitest";
import {
  registerSpellGroundAoeTelegraphWorld,
  spellNeedsGroundAoeTelegraph,
  spawnSpellGroundAoeTelegraph,
  type SpellAoeTelegraphPalette,
} from "./SpellGroundAoeTelegraph";
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
        }),
      ),
    ).toBe(true);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({
          id: "flamestrike",
          targetMode: "ground",
          blastRadius: 78,
          castMs: 650,
        }),
      ),
    ).toBe(true);
  });

  it("registers telegraph graphics with the defense world layer hook", () => {
    const gfx = { setDepth: vi.fn() };
    const scene = {
      add: { graphics: () => gfx },
    } as unknown as import("phaser").Scene;
    const palette: SpellAoeTelegraphPalette = {
      fill: 0xff5533,
      stroke: 0xffcc66,
      inner: 0xffffff,
    };
    const telegraph = spawnSpellGroundAoeTelegraph(scene, 10, 20, 40, palette, 500);
    const registerWorld = vi.fn();
    registerSpellGroundAoeTelegraphWorld(telegraph, registerWorld);
    expect(registerWorld).toHaveBeenCalledWith(gfx);
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