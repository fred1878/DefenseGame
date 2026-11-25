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

  it("ignores inactive enemies, follows the sprite, and destroys on reset", () => {
    const { scene, sprites } = mockScene();
    // Do not auto-complete the hold animation so we can pause and reset it.
    scene.add.sprite = vi.fn(() => {
      const sprite: Record<string, unknown> = {
        destroy: vi.fn(),
        setPosition: vi.fn(),
        play: vi.fn(function (this: typeof sprite) {
          return this;
        }),
        once: vi.fn(),
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
    }) as unknown as typeof scene.add.sprite;
    const fx = new EnemyIceRootFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemy = {
      id: "e1",
      sprite: {
        x: 10,
        y: 20,
        active: true,
      } as Phaser.Physics.Arcade.Sprite,
    };
    const inactive = {
      id: "dead",
      sprite: { x: 1, y: 1, active: false } as Phaser.Physics.Arcade.Sprite,
    };
    status.applyRoot("e1", 800);
    status.applyRoot("dead", 800);
    const register = vi.fn();
    fx.tick([enemy, inactive], status, register);
    expect(register).toHaveBeenCalled();
    const hold = sprites[0]!;
    const complete = hold.once.mock.calls[0]![1] as () => void;
    complete();
    expect(hold.anims.pause).toHaveBeenCalled();
    enemy.sprite.x = 40;
    fx.tick([enemy], status, register);
    expect(hold.setPosition).toHaveBeenCalledWith(40, 20);
    fx.reset();
    expect(hold.destroy).toHaveBeenCalled();
  });

  it("plays ending FX at the last known position when the enemy despawns", () => {
    const { scene, sprites } = mockScene();
    const fx = new EnemyIceRootFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemy = {
      id: "e1",
      sprite: { x: 3, y: 7, active: true } as Phaser.Physics.Arcade.Sprite,
    };
    status.applyRoot("e1", 200);
    fx.tick([enemy], status);
    status.tick(500);
    fx.tick([], status);
    expect(sprites.length).toBeGreaterThanOrEqual(2);
  });
});
