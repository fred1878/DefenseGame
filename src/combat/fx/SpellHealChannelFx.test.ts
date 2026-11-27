import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { PVFX_ANIM, PVFX_TEXTURE } from "../../content/combatPvfxAssets";
import { SpellHealChannelFx } from "./SpellHealChannelFx";

(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };

const PVFX_KEYS = Object.values(PVFX_TEXTURE);

describe("SpellHealChannelFx", () => {
  it("destroys graphics and aura sprite on stop", () => {
    const gfxDestroy = vi.fn();
    const loopDestroy = vi.fn();
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
    const loop: Record<string, unknown> = {
      setPosition: vi.fn(),
      destroy: loopDestroy,
      play: vi.fn(),
    };
    const chain = (k: string) => {
      loop[k] = vi.fn(() => loop);
    };
    for (const k of [
      "setDepth",
      "setBlendMode",
      "setAlpha",
      "setOrigin",
      "setDisplaySize",
    ]) {
      chain(k);
    }
    loop.play = vi.fn(() => loop);
    const scene = {
      textures: {
        exists: (key: string) =>
          PVFX_KEYS.includes(key as (typeof PVFX_KEYS)[number]),
      },
      anims: {
        exists: (key: string) => key === PVFX_ANIM.regenAuraLoop,
        create: vi.fn(),
        generateFrameNumbers: vi.fn(() => []),
      },
      add: {
        graphics: () => gfx,
        sprite: vi.fn(() => loop),
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
    expect(loopDestroy).toHaveBeenCalled();
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
    const loop = {
      setDepth: vi.fn().mockReturnThis(),
      setBlendMode: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    const scene = {
      textures: {
        exists: (key: string) => key === PVFX_TEXTURE.regenAura,
      },
      anims: {
        exists: (key: string) => key === PVFX_ANIM.regenAuraLoop,
        create: vi.fn(),
        generateFrameNumbers: vi.fn(() => []),
      },
      add: {
        graphics: () => gfx,
        sprite: vi.fn(() => loop),
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

  it("throws when regen-aura PVFX is missing", () => {
    const scene = {
      textures: { exists: () => false },
      anims: { exists: () => false, create: vi.fn() },
      add: { graphics: vi.fn() },
      tweens: { add: vi.fn() },
    } as unknown as Phaser.Scene;
    const fx = new SpellHealChannelFx(scene);
    expect(() => fx.start(0, 0)).toThrow(
      /PVFX texture missing \(heal channel\)/,
    );
  });

  it("starts the regen-aura loop when PVFX is ready", () => {
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
      "setOrigin",
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
        exists: (key: string) => key === PVFX_TEXTURE.regenAura,
      },
      anims: {
        exists: (key: string) => key === PVFX_ANIM.regenAuraLoop,
        create: vi.fn(),
        generateFrameNumbers: vi.fn(() => []),
      },
      add: {
        graphics: () => gfx,
        sprite: vi.fn(() => loop),
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
      add: { graphics: vi.fn(), sprite: vi.fn() },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
    } as unknown as Phaser.Scene;
    const fx = new SpellHealChannelFx(scene);
    fx.fadeOut();
    fx.follow(1, 2);
    expect(scene.add.graphics).not.toHaveBeenCalled();
  });
});
