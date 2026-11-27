import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { asScene, fakeScene, type FakeGameObject } from "../../test/fakeScene";
import {
  acquireMeleeFxSprite,
  destroyMeleeFxPool,
  releaseMeleeFxSprite,
} from "./meleeFxPool";

describe("meleeFxPool", () => {
  it("reuses a released swipe sprite for the same texture and scene", () => {
    const fake = fakeScene();
    const scene = asScene(fake);
    const acquire = (x: number, y: number, key: string) =>
      acquireMeleeFxSprite(scene, x, y, key) as unknown as FakeGameObject;

    const first = acquire(10, 20, "fx_melee_grunt");
    expect(fake.created).toHaveLength(1);

    const release = (sprite: FakeGameObject) =>
      releaseMeleeFxSprite(
        scene,
        sprite as unknown as Phaser.GameObjects.Sprite,
      );
    release(first);
    release(first); // duplicate release is ignored
    expect(first.destroyed).toBe(false);
    expect(first.last("setVisible")).toEqual([false]);

    const second = acquire(30, 40, "fx_melee_grunt");
    expect(second).toBe(first);
    expect(fake.created).toHaveLength(1);
    expect(second.last("setPosition")).toEqual([30, 40]);
    expect(second.last("setVisible")).toEqual([true]);

    const third = acquire(0, 0, "fx_melee_grunt");
    expect(third).not.toBe(first);
    expect(fake.created).toHaveLength(2);
  });

  it("keeps textures apart and destroys pooled sprites on scene shutdown", () => {
    const fake = fakeScene();
    const scene = asScene(fake);
    const acquire = (key: string) =>
      acquireMeleeFxSprite(scene, 0, 0, key) as unknown as FakeGameObject;
    const release = (sprite: FakeGameObject) =>
      releaseMeleeFxSprite(
        scene,
        sprite as unknown as Phaser.GameObjects.Sprite,
      );

    const grunt = acquire("fx_melee_grunt");
    release(grunt);
    const ward = acquire("fx_melee_ward");
    expect(ward).not.toBe(grunt);

    release(ward);
    destroyMeleeFxPool(scene);
    expect(grunt.destroyed).toBe(true);
    expect(ward.destroyed).toBe(true);

    const fresh = acquire("fx_melee_grunt");
    expect(fresh).not.toBe(grunt);
    expect(fake.created).toHaveLength(3);
  });
});
