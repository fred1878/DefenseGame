import { describe, expect, it, vi } from "vitest";
import { spellById, type SpellDefinition } from "../content/spells";
import {
  FIRE_WHOOSH_SFX_KEY,
  playFireWhooshSfx,
  spellPlaysFireWhooshOnChanneledAreaStart,
  spellPlaysFireWhooshOnChanneledConeTick,
  spellPlaysFireWhooshOnChannelLinger,
  spellPlaysFireWhooshOnResolve,
} from "./fireWhooshSfx";

function fireSpell(id: SpellDefinition["id"]): SpellDefinition {
  const def = spellById(id);
  if (!def) throw new Error(`missing spell ${id}`);
  return def;
}

describe("fire whoosh spell hooks", () => {
  it("resolves fire nova, meteor, and combustion", () => {
    for (const id of [
      "fire_nova",
      "meteor",
      "combustion",
      "fire_bolt",
    ] as const) {
      expect(spellPlaysFireWhooshOnResolve(fireSpell(id)), id).toBe(true);
    }
  });

  it("plays cone of fire whoosh on first channeled tick only", () => {
    const cone = fireSpell("cone_of_fire");
    expect(spellPlaysFireWhooshOnResolve(cone)).toBe(false);
    expect(spellPlaysFireWhooshOnChanneledConeTick(cone, true)).toBe(true);
    expect(spellPlaysFireWhooshOnChanneledConeTick(cone, false)).toBe(false);
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
    expect(play).toHaveBeenCalledWith(
      FIRE_WHOOSH_SFX_KEY,
      expect.objectContaining({ volume: expect.any(Number) }),
    );
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

describe("spellPlaysFireWhooshOnChannelLinger leftover branches", () => {
  it("is false for fire spells that omit lingerMs", () => {
    const fire = {
      id: "fire_bolt",
      name: "Fire Bolt",
      mechanicType: "projectile",
      castableInDefense: true,
      damageFlavor: "fire",
    } as SpellDefinition;
    expect(spellPlaysFireWhooshOnChannelLinger(fire)).toBe(false);
  });
});
