import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { PVFX_ANIM, PVFX_TEXTURE } from "../content/combatPvfxAssets";
import { meteorStrikeFxFlipX, playMeteorStrikeFx } from "./SpellMeteorStrikeFx";

(
  Phaser as { Animations?: { Events: { ANIMATION_COMPLETE: string } } }
).Animations = { Events: { ANIMATION_COMPLETE: "animationcomplete" } };
(Phaser as { BlendModes?: { ADD: number } }).BlendModes = { ADD: 1 };

function mockScene() {
  const scene = {
    textures: { exists: (key: string) => key === PVFX_TEXTURE.meteorStrike },
    anims: {
      exists: (key: string) => key === PVFX_ANIM.meteorStrike,
      create: vi.fn(),
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
        sprite.setBlendMode = chain;
        sprite.setAlpha = chain;
        sprite.setDisplaySize = chain;
        return sprite;
      }),
    },
  } as unknown as Phaser.Scene;
  return scene;
}

describe("meteorStrikeFxFlipX", () => {
  it("keeps default art when player is right of impact", () => {
    expect(meteorStrikeFxFlipX(120, 80)).toBe(false);
  });

  it("mirrors when player is left of impact", () => {
    expect(meteorStrikeFxFlipX(40, 100)).toBe(true);
  });
});

describe("playMeteorStrikeFx", () => {
  it("passes flipX to the meteor sprite", () => {
    const scene = mockScene();
    playMeteorStrikeFx(scene, 100, 200, 48, true);
    const sprite = (scene.add.sprite as ReturnType<typeof vi.fn>).mock
      .results[0]!.value as { setFlipX: ReturnType<typeof vi.fn> };
    expect(sprite.setFlipX).toHaveBeenCalledWith(true);
  });

  it("does nothing when the meteor anim is missing after register", () => {
    const scene = mockScene();
    (scene.anims as { exists: (key: string) => unknown }).exists = () =>
      undefined;
    playMeteorStrikeFx(scene, 100, 200, 48, false);
    expect(scene.add.sprite).not.toHaveBeenCalled();
  });
});
