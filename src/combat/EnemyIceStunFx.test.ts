import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { EnemySpellStatusMap } from "./enemySpellStatus";
import { EnemyIceStunFxController } from "./EnemyIceStunFx";
import { PVFX_ANIM, PVFX_FX_ASSETS } from "../content/combatPvfxAssets";

(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };
(
  Phaser as { Animations?: { Events: { ANIMATION_COMPLETE: string } } }
).Animations = { Events: { ANIMATION_COMPLETE: "animationcomplete" } };

function mockScene() {
  const scene = {
    textures: {
      exists: (key: string) =>
        PVFX_FX_ASSETS.some((entry) => entry.key === key),
    },
    anims: {
      exists: (key: string) => Object.values(PVFX_ANIM).includes(key as never),
    },
    add: {
      sprite: vi.fn(() => {
        const sprite: Record<string, unknown> = {
          destroy: vi.fn(),
          setPosition: vi.fn(),
          play: vi.fn(function (this: typeof sprite) {
            return this;
          }),
          once: vi.fn(),
          x: 0,
          y: 0,
        };
        const chain = (): typeof sprite => sprite;
        sprite.setDepth = chain;
        sprite.setBlendMode = chain;
        sprite.setAlpha = chain;
        sprite.setDisplaySize = chain;
        return sprite;
      }),
    },
  } as unknown as Phaser.Scene;
  return scene;
}

describe("EnemyIceStunFxController", () => {
  it("spawns stun loop FX when stun begins and release when it ends", () => {
    const scene = mockScene();
    const fx = new EnemyIceStunFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemySprite = {
      active: true,
      x: 10,
      y: 20,
      setTint: vi.fn(),
      clearTint: vi.fn(),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    const enemies = [{ id: "e1", sprite: enemySprite }];

    status.applyStun("e1", 400);
    fx.tick(enemies, status);
    expect(scene.add.sprite).toHaveBeenCalled();
    expect(enemySprite.setTint).toHaveBeenCalled();

    status.tick(500);
    fx.tick(enemies, status);
    expect(enemySprite.clearTint).toHaveBeenCalled();
  });
});
