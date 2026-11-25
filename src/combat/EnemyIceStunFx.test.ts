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
      generateFrameNumbers: vi.fn(() => []),
      create: vi.fn(),
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

  it("resets and skips work when the shatter texture is missing", () => {
    const scene = mockScene();
    scene.textures.exists = () => false;
    const fx = new EnemyIceStunFxController(scene);
    const status = new EnemySpellStatusMap();
    status.applyStun("e1", 400);
    fx.tick(
      [
        {
          id: "e1",
          sprite: {
            active: true,
            x: 0,
            y: 0,
            setTint: vi.fn(),
            clearTint: vi.fn(),
          } as never,
        },
      ],
      status,
    );
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });

  it("ignores inactive enemies and does not spawn twice while stunned", () => {
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
    const inactive = {
      active: false,
      x: 1,
      y: 1,
      setTint: vi.fn(),
      clearTint: vi.fn(),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    status.applyStun("e1", 800);
    status.applyStun("dead", 800);
    const register = vi.fn();
    const enemies = [
      { id: "e1", sprite: enemySprite },
      { id: "dead", sprite: inactive },
    ];
    fx.tick(enemies, status, register);
    const created = (scene.add.sprite as ReturnType<typeof vi.fn>).mock.calls
      .length;
    fx.tick(enemies, status, register);
    expect(
      (scene.add.sprite as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(created);
    expect(register).toHaveBeenCalled();
    expect(inactive.setTint).not.toHaveBeenCalled();
  });

  it("skips the loop sprite when the stun loop animation is missing", () => {
    const scene = mockScene();
    const origExists = scene.anims.exists;
    scene.anims.exists = (key: string) =>
      key !== PVFX_ANIM.iceShatterStunLoop && origExists(key);
    const fx = new EnemyIceStunFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemySprite = {
      active: true,
      x: 4,
      y: 5,
      setTint: vi.fn(),
      clearTint: vi.fn(),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    status.applyStun("e1", 400);
    fx.tick([{ id: "e1", sprite: enemySprite }], status);
    expect(scene.add.sprite).not.toHaveBeenCalled();
    expect(enemySprite.setTint).toHaveBeenCalled();
  });

  it("clears the entry when stun ends and the release animation is missing", () => {
    const scene = mockScene();
    const origExists = scene.anims.exists;
    scene.anims.exists = (key: string) =>
      key !== PVFX_ANIM.iceShatterRelease && origExists(key);
    const fx = new EnemyIceStunFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemySprite = {
      active: true,
      x: 8,
      y: 9,
      setTint: vi.fn(),
      clearTint: vi.fn(),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    status.applyStun("e1", 200);
    fx.tick([{ id: "e1", sprite: enemySprite }], status);
    expect(scene.add.sprite).toHaveBeenCalled();
    status.tick(500);
    fx.tick([{ id: "e1", sprite: enemySprite }], status);
    expect(enemySprite.clearTint).toHaveBeenCalled();
  });

  it("plays the release animation, follows the sprite, then destroys it", () => {
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
    status.applyStun("e1", 200);
    const register = vi.fn();
    fx.tick([{ id: "e1", sprite: enemySprite }], status, register);
    status.tick(500);
    enemySprite.x = 40;
    enemySprite.y = 50;
    fx.tick([{ id: "e1", sprite: enemySprite }], status, register);
    const sprites = (scene.add.sprite as ReturnType<typeof vi.fn>).mock.results;
    const release = sprites.at(-1)?.value as {
      once: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      setPosition: ReturnType<typeof vi.fn>;
    };
    expect(release.once).toHaveBeenCalled();
    const complete = release.once.mock.calls[0]![1] as () => void;
    complete();
    expect(release.destroy).toHaveBeenCalled();
    // A later complete from a stale sprite must not delete a newer entry.
    complete();
  });

  it("releases using the last FX position when the enemy has despawned", () => {
    const scene = mockScene();
    const fx = new EnemyIceStunFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemySprite = {
      active: true,
      x: 3,
      y: 7,
      setTint: vi.fn(),
      clearTint: vi.fn(),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    status.applyStun("e1", 200);
    fx.tick([{ id: "e1", sprite: enemySprite }], status);
    status.tick(500);
    fx.tick([], status);
    expect(scene.add.sprite).toHaveBeenCalledTimes(2);
  });

  it("destroys live FX sprites on reset", () => {
    const scene = mockScene();
    const fx = new EnemyIceStunFxController(scene);
    const status = new EnemySpellStatusMap();
    const enemySprite = {
      active: true,
      x: 1,
      y: 2,
      setTint: vi.fn(),
      clearTint: vi.fn(),
    } as unknown as Phaser.Physics.Arcade.Sprite;
    status.applyStun("e1", 400);
    fx.tick([{ id: "e1", sprite: enemySprite }], status);
    const loop = (scene.add.sprite as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value as { destroy: ReturnType<typeof vi.fn> };
    fx.reset();
    expect(loop.destroy).toHaveBeenCalled();
  });
});
