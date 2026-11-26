import { describe, expect, it, vi } from "vitest";
import type { SpellDefinition } from "../content/spells";
import {
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  fireNovaRingDurationMs,
  FLAME_RING_PEAK_OUTER_RADIUS_PX,
  flameRingDisplaySize,
  showFireNovaRingFx,
} from "./FireNovaRingFx";

function instantNova(partial: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: "fire_nova",
    name: "Fire Nova",
    shortLabel: "Nova",
    mechanicType: "blast",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 18000,
    channelMs: 0,
    baseDamage: 42,
    blastRadiusWu: 100,
    iconFile: "fire_nova.png",
    damageFlavor: "fire",
    centerOnCaster: true,
    blastKnockbackWu: 0,
    ...partial,
  };
}

describe("fireNovaRingDurationMs", () => {
  it("uses cast + channel when authored", () => {
    expect(
      fireNovaRingDurationMs(instantNova({ castMs: 400, channelMs: 200 }), 200),
    ).toBe(600);
  });

  it("derives duration from radius for instant novas", () => {
    const d = fireNovaRingDurationMs(instantNova(), 120);
    expect(d).toBeGreaterThanOrEqual(360);
    expect(d).toBeLessThanOrEqual(520);
  });
});

describe("flameRingDisplaySize", () => {
  it("scales so peak art radius matches blastRadiusPx", () => {
    const blastRadiusPx = 104;
    const { width, height } = flameRingDisplaySize(blastRadiusPx);
    const scale = blastRadiusPx / FLAME_RING_PEAK_OUTER_RADIUS_PX;
    expect(width / 112).toBeCloseTo(scale, 5);
    expect(height / 80).toBeCloseTo(scale, 5);
  });
});

describe("showFireNovaRingFx", () => {
  it("plays PVFX flame-ring sized to blast radius", () => {
    const allKeys = PVFX_FX_ASSETS.map((a) => a.key);
    const scene = fakeScene({
      textures: allKeys,
      anims: Object.values(PVFX_ANIM),
    });
    const register = vi.fn();
    const blastRadiusPx = 80;

    showFireNovaRingFx(asScene(scene), 50, 60, blastRadiusPx, register);

    expect(register).toHaveBeenCalledOnce();
    const sprite = scene.made("sprite")[0]!;
    expect(sprite.args[2]).toBe(PVFX_TEXTURE.flameRing);
    const { width, height } = flameRingDisplaySize(blastRadiusPx);
    expect(sprite.last("setDisplaySize")).toEqual([width, height]);
  });

  it("throws when flame-ring assets are missing", () => {
    const scene = fakeScene({
      textures: PVFX_FX_ASSETS.map((a) => a.key).filter(
        (k) => k !== PVFX_TEXTURE.flameRing,
      ),
    });
    expect(() => showFireNovaRingFx(asScene(scene), 0, 0, 60)).toThrow(
      /PVFX texture missing.*fire_nova/,
    );
  });
});
