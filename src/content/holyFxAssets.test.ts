import { describe, expect, it } from "vitest";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  HOLY_FX_ANIM,
  HOLY_FX_ASSETS,
  HOLY_FX_TEXTURE,
  registerHolyFxAnimations,
} from "./holyFxAssets";

describe("registerHolyFxAnimations", () => {
  it("creates the one-shot impact (7 frames) and looping channel (16 frames) anims", () => {
    const scene = fakeScene({
      textures: [HOLY_FX_TEXTURE.impact, HOLY_FX_TEXTURE.channel],
    });
    registerHolyFxAnimations(asScene(scene));

    const created = scene.anims.create.mock.calls.map(
      (c) =>
        c[0] as unknown as { key: string; frames: unknown[]; repeat: number },
    );
    expect(created.map((c) => c.key)).toEqual([
      HOLY_FX_ANIM.flashImpact,
      HOLY_FX_ANIM.channelLoop,
    ]);
    expect(created[0]!.frames).toHaveLength(7);
    expect(created[0]!.repeat).toBe(0);
    expect(created[1]!.frames).toHaveLength(16);
    expect(created[1]!.repeat).toBe(-1);
  });

  it("is idempotent and skips anims whose texture is not loaded", () => {
    const scene = fakeScene({ textures: [HOLY_FX_TEXTURE.channel] });
    registerHolyFxAnimations(asScene(scene));
    registerHolyFxAnimations(asScene(scene));
    expect(scene.anims.create).toHaveBeenCalledTimes(1);
    expect(scene.anims.exists(HOLY_FX_ANIM.flashImpact)).toBe(false);
    expect(scene.anims.exists(HOLY_FX_ANIM.channelLoop)).toBe(true);
  });

  it("manifest keys match the texture keys the FX code looks up", () => {
    expect(HOLY_FX_ASSETS.map((a) => a.key).sort()).toEqual(
      Object.values(HOLY_FX_TEXTURE).sort(),
    );
  });
});
