import { describe, expect, it, vi } from "vitest";
import { spellById, type SpellDefinition } from "../content/spells";
import {
  FIRE_WHOOSH_SFX_KEY,
  playFireWhooshSfx,
  spellPlaysFireWhooshOnChanneledAreaStart,
  spellPlaysFireWhooshOnChannelLinger,
  spellPlaysFireWhooshOnResolve,
} from "./fireWhooshSfx";

function fireSpell(id: SpellDefinition["id"]): SpellDefinition {
  const def = spellById(id);
  if (!def) throw new Error(`missing spell ${id}`);
  return def;
}

describe("fire whoosh spell hooks", () => {
  it("resolves fire nova, meteor, cone of fire, and combustion", () => {
    for (const id of ["fire_nova", "meteor", "cone_of_fire", "combustion", "fire_bolt"] as const) {
      expect(spellPlaysFireWhooshOnResolve(fireSpell(id)), id).toBe(true);
    }
  });

  it("resolves flamestrike impact and lingers with ground fire whoosh", () => {
    const flamestrike = fireSpell("flamestrike");
    expect(spellPlaysFireWhooshOnResolve(flamestrike)).toBe(true);
    expect(spellPlaysFireWhooshOnChanneledAreaStart(flamestrike)).toBe(false);
    expect(spellPlaysFireWhooshOnChannelLinger(flamestrike)).toBe(true);
  });

  it("skips non-fire spells", () => {
    expect(spellPlaysFireWhooshOnResolve(fireSpell("ice_bolt"))).toBe(false);
    expect(spellPlaysFireWhooshOnResolve(fireSpell("blizzard"))).toBe(false);
  });
});

describe("playFireWhooshSfx", () => {
  it("plays when the clip is preloaded", () => {
    const play = vi.fn();
    const scene = {
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: { play },
    } as unknown as import("phaser").Scene;
    playFireWhooshSfx(scene);
    expect(play).toHaveBeenCalledWith(FIRE_WHOOSH_SFX_KEY, expect.objectContaining({ volume: expect.any(Number) }));
  });

  it("no-ops when missing from cache", () => {
    const play = vi.fn();
    const scene = {
      cache: { audio: { exists: vi.fn(() => false) } },
      sound: { play },
    } as unknown as import("phaser").Scene;
    playFireWhooshSfx(scene);
    expect(play).not.toHaveBeenCalled();
  });
});