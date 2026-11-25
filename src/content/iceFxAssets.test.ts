import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  ICE_FX_ANIM,
  ICE_FX_ASSETS,
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
      ]),
    );
    expect(created).toHaveLength(6);
  });
});