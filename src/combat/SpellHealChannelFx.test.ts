import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { SpellHealChannelFx } from "./SpellHealChannelFx";

(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };

describe("SpellHealChannelFx", () => {
  it("destroys graphics and glow on stop", () => {
    const gfxDestroy = vi.fn();
    const glowDestroy = vi.fn();
    const tweenStop = vi.fn();
    const gfx = {
      setDepth: vi.fn(),
      setBlendMode: vi.fn(),
      setPosition: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      destroy: gfxDestroy,
    };
    const glow: Record<string, unknown> = {
      setPosition: vi.fn(),
      setDepth: vi.fn(),
      setTint: vi.fn(),
      setAlpha: vi.fn(),
      setBlendMode: vi.fn(),
      setDisplaySize: vi.fn(),
      destroy: glowDestroy,
    };
    const chain = (k: string) => {
      glow[k] = vi.fn(() => glow);
    };
    for (const k of ["setDepth", "setTint", "setAlpha", "setBlendMode", "setDisplaySize"]) {
      chain(k);
    }
    const image = vi.fn(() => glow);
    const scene = {
      textures: { exists: () => true },
      add: {
        graphics: () => gfx,
        image,
      },
      tweens: {
        add: () => ({ stop: tweenStop }),
      },
    } as unknown as Phaser.Scene;

    const fx = new SpellHealChannelFx(scene);
    fx.start(10, 20);
    fx.stop();

    expect(tweenStop).toHaveBeenCalled();
    expect(gfxDestroy).toHaveBeenCalled();
    expect(glowDestroy).toHaveBeenCalled();
    fx.destroy();
  });
});