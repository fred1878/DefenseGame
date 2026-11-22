import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { showFlashHealPulseFx } from "./SpellFlashHealFx";

(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };

describe("showFlashHealPulseFx", () => {
  it("starts a short pulse tween", () => {
    const tweenAdd = vi.fn();
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
    const scene = {
      textures: { exists: () => false },
      add: { graphics: () => gfx, image: vi.fn() },
      tweens: { add: tweenAdd },
    } as unknown as Phaser.Scene;

    showFlashHealPulseFx(scene, 0, 0);

    expect(tweenAdd).toHaveBeenCalledOnce();
    const cfg = tweenAdd.mock.calls[0]![0] as { duration: number; t: number };
    expect(cfg.duration).toBeGreaterThanOrEqual(300);
    expect(cfg.duration).toBeLessThanOrEqual(500);
    expect(cfg.t).toBe(1);
  });
});