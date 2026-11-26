import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { spawnLobberGroundImpactSmokeFx } from "./LobberImpactSmokeFx";
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
          setDisplaySize: vi.fn(function (this: typeof sprite) {
            return this;
          }),
        };
        const chain = (): typeof sprite => sprite;
        sprite.setDepth = chain;
        sprite.setAlpha = chain;
        return sprite;
      }),
    },
  } as unknown as Phaser.Scene;
  return { scene };
}

describe("spawnLobberGroundImpactSmokeFx", () => {
  it("throws when Smoke B texture is missing", () => {
    const scene = {
      textures: { exists: () => false },
      anims: { exists: () => false },
    } as unknown as Phaser.Scene;
    expect(() => spawnLobberGroundImpactSmokeFx(scene, 0, 0, 100, 2.4)).toThrow(
      /Smoke B texture missing/,
    );
  });

  it("plays lob impact animation when pack is loaded", () => {
    const { scene } = mockScene();
    spawnLobberGroundImpactSmokeFx(scene, 12, 34, 100, 2.4);
    const sprite = (scene.add.sprite as ReturnType<typeof vi.fn>).mock
      .results[0]!.value as {
      play: ReturnType<typeof vi.fn>;
      setDisplaySize: ReturnType<typeof vi.fn>;
    };
    expect(sprite.play).toHaveBeenCalledWith(SMOKE_FX_ANIM.lobImpact);
    expect(sprite.setDisplaySize).toHaveBeenCalled();
    const [w, h] = sprite.setDisplaySize.mock.calls[0] as [number, number];
    expect(w).toBe(h);
    expect(w).toBeGreaterThan(0);
  });

  it("throws when the lob impact animation did not register", () => {
    const { scene } = mockScene();
    scene.anims.exists = () => false;
    expect(() => spawnLobberGroundImpactSmokeFx(scene, 0, 0, 100, 2.4)).toThrow(
      /animation/,
    );
  });
});
