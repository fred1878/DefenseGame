import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { EnemyIceRootFxController } from "./EnemyIceRootFx";
import { EnemySpellStatusMap } from "./enemySpellStatus";
import { ICE_FX_ANIM, ICE_FX_ASSETS } from "../content/iceFxAssets";

(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };
(
  Phaser as { Animations?: { Events: { ANIMATION_COMPLETE: string } } }
).Animations = { Events: { ANIMATION_COMPLETE: "animationcomplete" } };

function mockScene() {
  const sprites: Array<{
    destroy: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    anims: { pause: ReturnType<typeof vi.fn> };
    x: number;
    y: number;
  }> = [];
  const scene = {
    textures: {
      exists: (key: string) => ICE_FX_ASSETS.some((entry) => entry.key === key),
    },
    anims: {
      exists: (key: string) =>
        Object.values(ICE_FX_ANIM).includes(key as never),
    },
    add: {
      sprite: vi.fn(() => {
        const sprite: Record<string, unknown> = {
          destroy: vi.fn(),
          setPosition: vi.fn(),
          play: vi.fn(function (this: typeof sprite) {
            return this;
          }),
          once: vi.fn((event: string, fn: () => void) => {
            if (event === "animationcomplete") fn();
          }),
          anims: { pause: vi.fn() },
          x: 0,
          y: 0,
        };
        const chain = (): typeof sprite => sprite;
        sprite.setDepth = chain;
        sprite.setBlendMode = chain;
        sprite.setAlpha = chain;
        sprite.setDisplaySize = chain;
        sprites.push(sprite as (typeof sprites)[number]);
        return sprite;
      }),
    },
  } as unknown as Phaser.Scene;
  return { scene, sprites };
}

describe("EnemyIceRootFxController", () => {
  it("spawns root active FX when root begins and ending FX when it clears", () => {
    const { scene, sprites } = mockScene();
    const fx = new EnemyIceRootFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemy = {
      id: "e1",
      sprite: { x: 10, y: 20, active: true } as Phaser.Physics.Arcade.Sprite,
    };

    fx.tick([enemy], status);
    expect(sprites).toHaveLength(0);

    status.applyRoot("e1", 800);
    fx.tick([enemy], status);
    expect(sprites).toHaveLength(1);

    status.tick(900);
    fx.tick([enemy], status);
    expect(sprites.length).toBeGreaterThanOrEqual(2);
  });
});
