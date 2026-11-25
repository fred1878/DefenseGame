import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { spawnChargerChargeStartSmokeFx } from "./ChargerChargeSmokeFx";
import { SMOKE_FX_ANIM, SMOKE_FX_ASSETS } from "../content/smokeFxAssets";

(
  Phaser as { Animations?: { Events: { ANIMATION_COMPLETE: string } } }
).Animations = { Events: { ANIMATION_COMPLETE: "animationcomplete" } };

function mockScene() {
  const created: string[] = [];
  const scene = {
    registry: { get: () => undefined },
    textures: {
      exists: (key: string) =>
        SMOKE_FX_ASSETS.some((entry) => entry.key === key),
    },
    anims: {
      exists: (key: string) =>
        created.includes(key) ||
        Object.values(SMOKE_FX_ANIM).includes(key as never),
      create: (cfg: { key: string }) => {
        created.push(cfg.key);
      },
      generateFrameNumbers: vi.fn(() => []),
    },
    add: {
      sprite: vi.fn(() => {
        const sprite: Record<string, unknown> = {
          destroy: vi.fn(),
          play: vi.fn(function (this: typeof sprite) {
            return this;
          }),
          once: vi.fn(),
          setFlipX: vi.fn(function (this: typeof sprite) {
            return this;
          }),
        };
        const chain = (): typeof sprite => sprite;
        sprite.setDepth = chain;
        sprite.setAlpha = chain;
        sprite.setDisplaySize = chain;
        return sprite;
      }),
    },
  } as unknown as Phaser.Scene;
  return { scene, created };
}

describe("spawnChargerChargeStartSmokeFx", () => {
  it("throws when Smoke A texture is missing", () => {
    const scene = {
      textures: { exists: () => false },
      anims: { exists: () => false },
    } as unknown as Phaser.Scene;
    expect(() => spawnChargerChargeStartSmokeFx(scene, 0, 0, false)).toThrow(
      /Smoke A texture missing/,
    );
  });

  it("spawns at fixed world position with flipX for leftward charge", () => {
    const { scene } = mockScene();
    spawnChargerChargeStartSmokeFx(scene, 12, 34, true);
    expect(scene.add.sprite).toHaveBeenCalledWith(
      12,
      34,
      SMOKE_FX_ASSETS[0]!.key,
    );
    const sprite = (scene.add.sprite as ReturnType<typeof vi.fn>).mock
      .results[0]!.value as {
      setFlipX: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
    };
    expect(sprite.setFlipX).toHaveBeenCalledWith(true);
    expect(sprite.play).toHaveBeenCalledWith(SMOKE_FX_ANIM.chargeStart);
  });
});
