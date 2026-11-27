import { describe, expect, it, vi } from "vitest";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../../content/assets";
import {
  enemyMeleeFxSpec,
  enemyMeleeFxTransform,
  meleeFxAnimDurationMs,
} from "../../content/meleeFxAssets";
import { asScene, fakeScene } from "../../test/fakeScene";
import { meleeFxPlaybackTimeScale } from "./meleeFxTiming";
import {
  meleeSwipeRotation,
  showEnemyMeleeSwipe,
  showPlayerMeleeSwipe,
} from "./MeleeSwipeFx";

describe("showPlayerMeleeSwipe", () => {
  it("places the slash 24wu ahead along facing, aimed with the art offset", () => {
    const scene = fakeScene();
    const register = vi.fn();
    showPlayerMeleeSwipe(
      asScene(scene),
      100,
      100,
      Math.PI / 2,
      undefined,
      160,
      register,
    );
    const [img] = scene.made("image");
    const [x, y, key] = img!.args as [number, number, string];
    expect(key).toBe(COMBAT_FX_TEXTURE.playerMelee);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(124);
    expect(img!.last("setRotation")![0]).toBeCloseTo(
      meleeSwipeRotation(Math.PI / 2),
    );
    expect(img!.last("setDisplaySize")).toEqual([
      SPRITE_DISPLAY.playerMeleeSlash,
      SPRITE_DISPLAY.playerMeleeSlash,
    ]);
    expect(img!.last("setDepth")).toEqual([
      DEFENSE_RENDER_DEPTH.playerCombatFx,
    ]);
    expect(register).toHaveBeenCalledWith(img);
  });

  it("natural timing: short hold then fade (natural-40ms, min 80ms)", () => {
    const scene = fakeScene();
    showPlayerMeleeSwipe(asScene(scene), 0, 0, 0, undefined, 160);
    expect(scene.tweenConfigs[0]).toMatchObject({
      alpha: 0,
      duration: 120,
      delay: 40,
    });

    const quick = fakeScene();
    showPlayerMeleeSwipe(asScene(quick), 0, 0, 0, undefined, 60);
    expect(quick.tweenConfigs[0]).toMatchObject({ duration: 80, delay: 15 });
  });

  it("explicit FX duration fades immediately over that duration and destroys", () => {
    const scene = fakeScene();
    showPlayerMeleeSwipe(asScene(scene), 0, 0, 0, 250, 160);
    const tween = scene.tweenConfigs[0]!;
    expect(tween).toMatchObject({ duration: 250, delay: 0 });
    tween.onComplete?.();
    expect(scene.made("image")[0]!.destroyed).toBe(true);
  });
});

const VFX = { vfxOffsetWu: 21, vfxDisplayW: 112, vfxDisplayH: 96 };

describe("showEnemyMeleeSwipe", () => {
  it("falls back to the grunt slash image for enemies without a clip", () => {
    const scene = fakeScene();
    showEnemyMeleeSwipe(
      asScene(scene),
      "no_such_enemy",
      0,
      0,
      0,
      undefined,
      200,
      VFX,
    );
    const [img] = scene.made("image");
    expect(img!.args[2]).toBe(COMBAT_FX_TEXTURE.gruntMelee);
    expect(img!.args[0]).toBeCloseTo(12);
    expect(img!.last("setDepth")).toEqual([DEFENSE_RENDER_DEPTH.enemyCombatFx]);
    expect(scene.made("sprite")).toHaveLength(0);
  });

  it("throws when an enemy's melee clip texture or animation is missing", () => {
    const spec = enemyMeleeFxSpec("grunt")!;
    expect(() =>
      showEnemyMeleeSwipe(
        asScene(fakeScene()),
        "grunt",
        0,
        0,
        0,
        undefined,
        200,
        VFX,
      ),
    ).toThrow(/Missing melee FX texture/);
    expect(() =>
      showEnemyMeleeSwipe(
        asScene(fakeScene({ textures: [spec.textureKey] })),
        "grunt",
        0,
        0,
        0,
        undefined,
        200,
        VFX,
      ),
    ).toThrow(/Missing melee FX animation/);
  });

  it("plays the enemy clip retimed to the attack and pools it on completion", () => {
    const spec = enemyMeleeFxSpec("grunt")!;
    const scene = fakeScene({
      textures: [spec.textureKey],
      anims: [spec.animKey],
    });
    const facing = Math.PI;
    showEnemyMeleeSwipe(asScene(scene), "grunt", 50, 50, facing, 300, 200, VFX);
    const [sprite] = scene.made("sprite");
    expect(sprite!.args[0]).toBeCloseTo(50 - VFX.vfxOffsetWu);
    expect(sprite!.args[1]).toBeCloseTo(50);
    const pose = enemyMeleeFxTransform(facing, spec);
    expect(sprite!.last("setRotation")).toEqual([pose.rotation]);
    expect(sprite!.last("setFlipX")).toEqual([pose.flipX]);
    expect(sprite!.last("setDisplaySize")).toEqual([
      VFX.vfxDisplayW,
      VFX.vfxDisplayH,
    ]);
    expect((sprite!.anims as { timeScale: number }).timeScale).toBeCloseTo(
      meleeFxPlaybackTimeScale(meleeFxAnimDurationMs(spec.clipId), 300),
    );
    expect(sprite!.last("play")).toEqual([spec.animKey]);
    sprite!.emit("animationcomplete");
    expect(sprite!.destroyed).toBe(false);
    expect(sprite!.last("setVisible")).toEqual([false]);
  });
});
