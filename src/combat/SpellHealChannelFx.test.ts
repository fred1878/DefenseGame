import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { HOLY_FX_ANIM, HOLY_FX_TEXTURE } from "../content/holyFxAssets";
import { COMBAT_FX_TEXTURE } from "../content/assets";
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
    for (const k of [
      "setDepth",
      "setTint",
      "setAlpha",
      "setBlendMode",
      "setDisplaySize",
    ]) {
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

  it("fadeOut tweens alpha instead of immediate destroy", () => {
    const gfxDestroy = vi.fn();
    const tweenAdd = vi.fn(() => ({ stop: vi.fn() }));
    const gfx = {
      setDepth: vi.fn(),
      setBlendMode: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      destroy: gfxDestroy,
    };
    const scene = {
      textures: { exists: () => false },
      add: {
        graphics: () => gfx,
        image: vi.fn(),
      },
      tweens: { add: tweenAdd },
    } as unknown as Phaser.Scene;

    const fx = new SpellHealChannelFx(scene);
    fx.start(0, 0);
    fx.fadeOut();

    expect(tweenAdd).toHaveBeenCalled();
    expect(gfxDestroy).not.toHaveBeenCalled();
    fx.stop();
  });

  it("starts the holy loop when the channel texture and anim exist", () => {
    const register = vi.fn();
    const loop: Record<string, unknown> = {
      setPosition: vi.fn(),
      destroy: vi.fn(),
      play: vi.fn(),
    };
    const chain = (): typeof loop => loop;
    for (const k of [
      "setDepth",
      "setBlendMode",
      "setAlpha",
      "setDisplaySize",
    ]) {
      loop[k] = vi.fn(chain);
    }
    loop.play = vi.fn(chain);
    const gfx = {
      setDepth: vi.fn(),
      setBlendMode: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      destroy: vi.fn(),
    };
    const tweens: Array<{
      stop: ReturnType<typeof vi.fn>;
      onUpdate?: () => void;
      onComplete?: () => void;
    }> = [];
    const scene = {
      textures: {
        exists: (key: string) => key === HOLY_FX_TEXTURE.channel,
      },
      anims: { exists: (key: string) => key === HOLY_FX_ANIM.channelLoop },
      add: {
        graphics: () => gfx,
        sprite: vi.fn(() => loop),
        image: vi.fn(),
      },
      tweens: {
        add: vi.fn(
          (cfg: { onUpdate?: () => void; onComplete?: () => void }) => {
            const tw: {
              stop: ReturnType<typeof vi.fn>;
              onUpdate?: () => void;
              onComplete?: () => void;
            } = { stop: vi.fn() };
            if (cfg.onUpdate) tw.onUpdate = cfg.onUpdate;
            if (cfg.onComplete) tw.onComplete = cfg.onComplete;
            tweens.push(tw);
            return tw;
          },
        ),
      },
    } as unknown as Phaser.Scene;
    const fx = new SpellHealChannelFx(scene);
    fx.start(4, 8, register);
    expect(register).toHaveBeenCalled();
    expect(scene.add.sprite).toHaveBeenCalled();
    tweens[0]?.onUpdate?.();
    fx.follow(20, 30);
    expect(loop.setPosition).toHaveBeenCalledWith(20, 30);
    fx.fadeOut();
    fx.fadeOut();
    tweens.at(-1)?.onComplete?.();
  });

  it("no-ops fadeOut before start and follow after stop", () => {
    const scene = {
      textures: { exists: () => false },
      add: { graphics: vi.fn(), image: vi.fn() },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
    } as unknown as Phaser.Scene;
    const fx = new SpellHealChannelFx(scene);
    fx.fadeOut();
    fx.follow(1, 2);
    expect(scene.add.graphics).not.toHaveBeenCalled();
  });
});

describe("SpellHealChannelFx leftover glow branches", () => {
  it("follows and fades the shockwave glow when the holy loop is missing", () => {
    const glow = {
      setPosition: vi.fn(),
      setDepth: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setBlendMode: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
    };
    const gfx = {
      setDepth: vi.fn(),
      setBlendMode: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
    };
    const tweens: Array<{
      stop: ReturnType<typeof vi.fn>;
      onComplete?: () => void;
    }> = [];
    const scene = {
      textures: {
        exists: (key: string) => key === COMBAT_FX_TEXTURE.spellShockwave,
      },
      add: {
        graphics: vi.fn(() => gfx),
        image: vi.fn(() => glow),
        sprite: vi.fn(),
      },
      tweens: {
        add: vi.fn((cfg: { onComplete?: () => void }) => {
          const tw: {
            stop: ReturnType<typeof vi.fn>;
            onComplete?: () => void;
          } = { stop: vi.fn() };
          if (cfg.onComplete) tw.onComplete = cfg.onComplete;
          tweens.push(tw);
          return tw;
        }),
      },
    } as unknown as Phaser.Scene;
    const fx = new SpellHealChannelFx(scene);
    const register = vi.fn();
    fx.start(4, 8, register);
    expect(scene.add.image).toHaveBeenCalled();
    fx.follow(20, 30);
    expect(glow.setPosition).toHaveBeenCalledWith(20, 30);
    fx.fadeOut();
    expect(tweens.length).toBeGreaterThan(1);
  });
});
