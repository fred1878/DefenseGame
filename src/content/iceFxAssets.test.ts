import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  ICE_FX_ANIM,
  ICE_FX_ASSETS,
  assertIceCombatFxReady,
  registerIceFxAnimations,
} from "./iceFxAssets";

describe("registerIceFxAnimations", () => {
  it("registers all ice pack animation keys when textures exist", () => {
    const created: string[] = [];
    const scene = {
      textures: {
        exists: (key: string) =>
          ICE_FX_ASSETS.some((entry) => entry.key === key),
      },
      anims: {
        exists: (key: string) => created.includes(key),
        create: (cfg: { key: string }) => {
          created.push(cfg.key);
        },
        generateFrameNumbers: vi.fn(() => []),
      },
    } as unknown as Phaser.Scene;

    registerIceFxAnimations(scene);

    expect(created).toEqual(
      expect.arrayContaining([
        ICE_FX_ANIM.boltStart,
        ICE_FX_ANIM.boltRepeat,
        ICE_FX_ANIM.boltHit,
        ICE_FX_ANIM.castStart,
        ICE_FX_ANIM.rootActive,
        ICE_FX_ANIM.rootEnding,
        ICE_FX_ANIM.wallEnding,
      ]),
    );
    expect(created).toHaveLength(7);
  });
});

describe("assertIceCombatFxReady", () => {
  it("throws with missing texture and anim ids", () => {
    const scene = {
      textures: { exists: () => false },
      anims: { exists: () => false },
    } as unknown as Phaser.Scene;
    expect(() => assertIceCombatFxReady(scene, "test")).toThrow(
      /Ice combat FX not ready \(test\)/,
    );
  });
});

describe("ice FX leftover exists() branches", () => {
  it("treats a missing exists() result as an unregistered anim", () => {
    const scene = {
      textures: {
        exists: (key: string) =>
          ICE_FX_ASSETS.some((entry) => entry.key === key),
      },
      anims: { exists: () => undefined },
    } as unknown as Phaser.Scene;
    expect(() => assertIceCombatFxReady(scene, "test")).toThrow(
      /missing anims/,
    );
  });

  it("throws when textures are loaded but animations stay unregistered", () => {
    const scene = {
      textures: {
        exists: (key: string) =>
          ICE_FX_ASSETS.some((entry) => entry.key === key),
      },
      anims: {
        exists: () => undefined,
        create: vi.fn(),
        generateFrameNumbers: vi.fn(() => []),
      },
    } as unknown as Phaser.Scene;
    expect(() => registerIceFxAnimations(scene)).toThrow(
      /textures loaded but Phaser animations were not registered/,
    );
  });
});
