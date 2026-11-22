import { describe, expect, it, vi } from "vitest";
import type { SpellDefinition } from "../content/spells";
import { fireNovaRingDurationMs, showFireNovaRingFx } from "./FireNovaRingFx";

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
    expect(fireNovaRingDurationMs(instantNova({ castMs: 400, channelMs: 200 }), 200)).toBe(
      600,
    );
  });

  it("derives duration from radius for instant novas", () => {
    const d = fireNovaRingDurationMs(instantNova(), 120);
    expect(d).toBeGreaterThanOrEqual(360);
    expect(d).toBeLessThanOrEqual(520);
  });
});

describe("showFireNovaRingFx", () => {
  it("starts an expanding ring tween", () => {
    const tweenAdd = vi.fn();
    const gfx = { clear: vi.fn(), fillStyle: vi.fn(), fillCircle: vi.fn(), lineStyle: vi.fn(), strokeCircle: vi.fn(), setDepth: vi.fn(), destroy: vi.fn() };
    const scene = {
      add: { graphics: () => gfx },
      tweens: { add: tweenAdd },
    } as unknown as Phaser.Scene;
    const register = vi.fn();

    showFireNovaRingFx(scene, 50, 60, 100, 320, register);

    expect(register).toHaveBeenCalledWith(gfx);
    expect(tweenAdd).toHaveBeenCalledOnce();
    const cfg = tweenAdd.mock.calls[0]![0] as { targets: { t: number }; t: number };
    expect(cfg.targets.t).toBe(0);
    expect(cfg.t).toBe(1);
  });
});