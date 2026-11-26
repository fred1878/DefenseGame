import { describe, expect, it, vi } from "vitest";
import {
  registerSpellGroundAoeTelegraphWorld,
  spellGroundAoePalette,
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
        def({
          id: "meteor",
          targetMode: "ground",
          blastRadiusWu: 44,
          castMs: 1100,
        }),
      ),
    ).toBe(true);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({
          id: "blizzard",
          mechanicType: "channeled",
          targetMode: "ground",
          blastRadiusWu: 80,
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
          blastRadiusWu: 78,
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
    const telegraph = spawnSpellGroundAoeTelegraph(
      scene,
      10,
      20,
      40,
      palette,
      500,
    );
    const registerWorld = vi.fn();
    registerSpellGroundAoeTelegraphWorld(telegraph, registerWorld);
    expect(registerWorld).toHaveBeenCalledWith(gfx);
  });

  it("skips non-ground and radius-less spells", () => {
    expect(
      spellNeedsGroundAoeTelegraph(
        def({ id: "fire_nova", centerOnCaster: true }),
      ),
    ).toBe(false);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({
          id: "meteor",
          targetMode: "ground",
          blastRadiusWu: 0,
          castMs: 500,
        }),
      ),
    ).toBe(false);
  });
});

describe("spellGroundAoePalette and telegraph eligibility", () => {
  it("picks ice, fire, and default palettes by id or flavor", () => {
    expect(spellGroundAoePalette(def({ id: "blizzard" }))).toEqual({
      fill: 0x7dd3fc,
      stroke: 0x38bdf8,
      inner: 0xe0f2fe,
    });
    expect(
      spellGroundAoePalette(def({ id: "meteor", damageFlavor: "physical" })),
    ).toEqual({
      fill: 0xff5533,
      stroke: 0xffcc66,
      inner: 0xffffff,
    });
    expect(spellGroundAoePalette(def({ id: "flamestrike" }))).toEqual({
      fill: 0xff5533,
      stroke: 0xffcc66,
      inner: 0xffffff,
    });
    expect(
      spellGroundAoePalette(def({ id: "fire_bolt", damageFlavor: "fire" })),
    ).toEqual({
      fill: 0xff5533,
      stroke: 0xffcc66,
      inner: 0xffffff,
    });
    expect(spellGroundAoePalette(def({ id: "heal" }))).toEqual({
      fill: 0x94a3b8,
      stroke: 0xe2e8f0,
      inner: 0xf8fafc,
    });
  });

  it("needs a telegraph only when a ground blast has windup or channel", () => {
    expect(
      spellNeedsGroundAoeTelegraph(
        def({ targetMode: "ground", blastRadiusWu: 40, channelMs: 500 }),
      ),
    ).toBe(true);
    expect(
      spellNeedsGroundAoeTelegraph(
        def({ targetMode: "ground", blastRadiusWu: 40 }),
      ),
    ).toBe(false);
  });
});

describe("spellNeedsGroundAoeTelegraph leftover branches", () => {
  it("rejects a ground spell with no blast radius or channel", () => {
    const bare = def({ targetMode: "ground" });
    delete (bare as { blastRadiusWu?: number }).blastRadiusWu;
    delete (bare as { channelMs?: number }).channelMs;
    delete (bare as { castMs?: number }).castMs;
    expect(spellNeedsGroundAoeTelegraph(bare)).toBe(false);
    bare.blastRadiusWu = 80;
    expect(spellNeedsGroundAoeTelegraph(bare)).toBe(false);
  });
});
