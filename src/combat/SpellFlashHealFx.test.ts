import { describe, expect, it, vi } from "vitest";
import { DEFENSE_RENDER_DEPTH } from "../config";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import {
  HOLY_FX_ANIM,
  HOLY_FX_FLASH_ALPHA,
  HOLY_FX_FLASH_DISPLAY_PX,
  HOLY_FX_TEXTURE,
} from "../content/holyFxAssets";
import { asScene, fakeScene, finishTween } from "../test/fakeScene";
import { showFlashHealPulseFx } from "./SpellFlashHealFx";

const DEPTH = DEFENSE_RENDER_DEPTH.playerCombatFx;

describe("showFlashHealPulseFx", () => {
  it("draws expanding gold/white rings that fade and clean up after ~420ms", () => {
    const scene = fakeScene();
    const register = vi.fn();
    showFlashHealPulseFx(asScene(scene), 100, 200, register);

    const [gfx] = scene.made("graphics");
    expect(gfx).toBeDefined();
    expect(gfx!.last("setDepth")).toEqual([DEPTH]);
    expect(register).toHaveBeenCalledWith(gfx);

    // Initial frame (t=0): outer ring radius 14 at the cast point.
    const firstStroke = gfx!.callsTo("strokeCircle")[0]!;
    expect(firstStroke).toEqual([100, 200, 14]);

    expect(scene.tweenConfigs).toHaveLength(1);
    const pulse = scene.tweenConfigs[0]!;
    expect(pulse.duration).toBe(420);
    expect(pulse.t).toBe(1);

    finishTween(pulse);
    // Final frame (t=1): radius 14 + 54 = 68, inner ring at 78%.
    const strokes = gfx!.callsTo("strokeCircle");
    expect(strokes.at(-2)).toEqual([100, 200, 68]);
    expect(strokes.at(-1)![2]).toBeCloseTo(68 * 0.78);
    // Alpha fades to 12% of the start.
    const lineAlphas = gfx!.callsTo("lineStyle").map((a) => a[2] as number);
    expect(lineAlphas.at(-2)).toBeCloseTo(0.92 * 0.12);
    expect(gfx!.destroyed).toBe(true);
  });

  it("plays the Holy 01 Impact sprite when texture and anim are loaded", () => {
    const scene = fakeScene({
      textures: [HOLY_FX_TEXTURE.impact, COMBAT_FX_TEXTURE.spellShockwave],
      anims: [HOLY_FX_ANIM.flashImpact],
    });
    const register = vi.fn();
    showFlashHealPulseFx(asScene(scene), 5, 6, register);

    const [holy] = scene.made("sprite");
    expect(holy!.args).toEqual([5, 6, HOLY_FX_TEXTURE.impact]);
    expect(holy!.last("play")).toEqual([HOLY_FX_ANIM.flashImpact]);
    expect(holy!.last("setAlpha")).toEqual([HOLY_FX_FLASH_ALPHA]);
    expect(holy!.last("setDisplaySize")).toEqual([
      HOLY_FX_FLASH_DISPLAY_PX,
      HOLY_FX_FLASH_DISPLAY_PX,
    ]);
    expect(holy!.last("setDepth")).toEqual([DEPTH + 1]);
    expect(register).toHaveBeenCalledWith(holy);
    // Sprite path wins: no shockwave fallback, no extra overlay tween.
    expect(scene.made("image")).toHaveLength(0);
    expect(scene.tweenConfigs).toHaveLength(1);

    holy!.emit("animationcomplete");
    expect(holy!.destroyed).toBe(true);
    // Pulse end does not try to destroy the finished sprite twice.
    finishTween(scene.tweenConfigs[0]!);
    expect(holy!.callsTo("destroy")).toHaveLength(1);
  });

  it("destroys a still-playing holy sprite when the pulse ends", () => {
    const scene = fakeScene({
      textures: [HOLY_FX_TEXTURE.impact],
      anims: [HOLY_FX_ANIM.flashImpact],
    });
    showFlashHealPulseFx(asScene(scene), 0, 0);
    const [holy] = scene.made("sprite");
    finishTween(scene.tweenConfigs[0]!);
    expect(holy!.destroyed).toBe(true);
  });

  it("falls back to a tinted shockwave image that fades and grows", () => {
    // Texture loaded but animation missing -> no holy sprite.
    const scene = fakeScene({
      textures: [HOLY_FX_TEXTURE.impact, COMBAT_FX_TEXTURE.spellShockwave],
    });
    const register = vi.fn();
    showFlashHealPulseFx(asScene(scene), 1, 2, register);

    expect(scene.made("sprite")).toHaveLength(0);
    const [shock] = scene.made("image");
    expect(shock!.args).toEqual([1, 2, COMBAT_FX_TEXTURE.spellShockwave]);
    expect(shock!.last("setDepth")).toEqual([DEPTH - 1]);
    expect(shock!.last("setTint")).toEqual([0xfff0c0]);
    expect(shock!.last("setDisplaySize")).toEqual([56, 56]);
    expect(register).toHaveBeenCalledWith(shock);

    expect(scene.tweenConfigs).toHaveLength(2);
    const fade = scene.tweenConfigs[1]!;
    expect(fade.targets).toBe(shock);
    expect(fade.alpha).toBe(0);
    expect(fade.scale).toBe(1.35);

    finishTween(scene.tweenConfigs[0]!);
    expect(shock!.destroyed).toBe(true);
  });

  it("only draws rings when neither holy nor shockwave textures exist", () => {
    const scene = fakeScene();
    showFlashHealPulseFx(asScene(scene), 0, 0);
    expect(scene.made("sprite")).toHaveLength(0);
    expect(scene.made("image")).toHaveLength(0);
    expect(scene.tweenConfigs).toHaveLength(1);
  });
});
