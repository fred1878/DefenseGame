import { describe, expect, it, vi } from "vitest";
import {
  acquireProjectileSprite,
  releaseProjectileSprite,
} from "./projectilePool";

function mockProjectileSprite(scene: Phaser.Scene, key: string) {
  return {
    texture: { key },
    scene,
    active: true,
    visible: true,
    setPosition: vi.fn().mockReturnThis(),
    setTexture: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setCircle: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    clearTint: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    body: {
      reset: vi.fn(),
      enable: true,
      stop: vi.fn(),
    },
  } as unknown as Phaser.Physics.Arcade.Sprite;
}

function mockScene(): Phaser.Scene {
  const scene = {
    physics: { add: { sprite: vi.fn() } },
  } as unknown as Phaser.Scene;
  (
    scene.physics.add as { sprite: typeof scene.physics.add.sprite }
  ).sprite = vi.fn((_x, _y, key) =>
    mockProjectileSprite(scene, key),
  ) as unknown as typeof scene.physics.add.sprite;
  return scene;
}

describe("projectilePool", () => {
  it("reuses a sprite after release", () => {
    const scene = mockScene();
    const first = acquireProjectileSprite(
      scene,
      1,
      2,
      "fx_stone_throw",
      8,
      4,
      10,
    );
    expect(scene.physics.add.sprite).toHaveBeenCalledTimes(1);
    releaseProjectileSprite(scene, first);
    const second = acquireProjectileSprite(
      scene,
      3,
      4,
      "fx_stone_throw",
      8,
      4,
      10,
    );
    expect(second).toBe(first);
    expect(scene.physics.add.sprite).toHaveBeenCalledTimes(1);
  });
});