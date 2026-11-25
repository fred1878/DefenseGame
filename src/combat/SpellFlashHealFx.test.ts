import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { showFlashHealPulseFx } from "./SpellFlashHealFx";
import { PVFX_ANIM, PVFX_FX_ASSETS } from "../content/combatPvfxAssets";

(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };
(Phaser as { Animations?: { Events: { ANIMATION_COMPLETE: string } } }).Animations =
  { Events: { ANIMATION_COMPLETE: "animationcomplete" } };

describe("showFlashHealPulseFx", () => {
  it("throws when holy-cast PVFX is missing", () => {
    const scene = {
      textures: { exists: () => false },
      anims: { exists: () => false },
    } as unknown as Phaser.Scene;
    expect(() => showFlashHealPulseFx(scene, 0, 0)).toThrow(/fx_pvfx_holy_cast/);
  });

  it("starts a short pulse tween when PVFX is ready", () => {
    const tweenAdd = vi.fn();
    const created: string[] = [];
    const gfx = {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      setDepth: vi.fn(),
      setBlendMode: vi.fn(),
      destroy: vi.fn(),
    };
    const holySprite = {
      setDepth: vi.fn().mockReturnThis(),
      setBlendMode: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
      play: vi.fn(function (this: typeof holySprite) {
        return this;
      }),
      once: vi.fn(),
      destroy: vi.fn(),
    };
    const scene = {
      textures: {
        exists: (key: string) =>
          PVFX_FX_ASSETS.some((entry) => entry.key === key),
      },
      anims: {
        exists: (key: string) =>
          created.includes(key) || key === PVFX_ANIM.holyCast,
        create: (cfg: { key: string }) => {
          created.push(cfg.key);
        },
        generateFrameNumbers: vi.fn(() => []),
      },
      add: { graphics: () => gfx, sprite: vi.fn(() => holySprite) },
      tweens: { add: tweenAdd },
      registry: { get: () => undefined },
    } as unknown as Phaser.Scene;

    showFlashHealPulseFx(scene, 0, 0);

    expect(tweenAdd).toHaveBeenCalledOnce();
    const cfg = tweenAdd.mock.calls[0]![0] as { duration: number; t: number };
    expect(cfg.duration).toBeGreaterThanOrEqual(300);
    expect(cfg.duration).toBeLessThanOrEqual(500);
    expect(cfg.t).toBe(1);
    expect(holySprite.play).toHaveBeenCalledWith(PVFX_ANIM.holyCast);
  });
});