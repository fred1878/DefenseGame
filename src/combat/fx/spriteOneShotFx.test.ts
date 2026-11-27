import { describe, expect, it, vi } from "vitest";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import {
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
} from "../../content/combatPvfxAssets";
import {
  ICE_FX_ANIM,
  ICE_FX_ASSETS,
  ICE_FX_CAST_START_DISPLAY_PX,
  ICE_FX_ROOT_DISPLAY_PX,
  ICE_FX_TEXTURE,
} from "../../content/iceFxAssets";
import { asScene, fakeScene } from "../../test/fakeScene";
import { playBruiserMeleeCritHitOnPlayerFx } from "./BruiserPlayerCritHitFx";
import { playIceWallSegmentEndFx } from "./IceWallEndFx";
import { playShadowformCastFx } from "./ShadowformCastFx";
import { SpellIceCastWindupFx } from "./SpellIceCastWindupFx";
import { playMeteorStrikeFx } from "./SpellMeteorStrikeFx";

const iceTextures = ICE_FX_ASSETS.map((a) => a.key);
const iceAnims = Object.values(ICE_FX_ANIM);
const pvfxTextures = PVFX_FX_ASSETS.map((a) => a.key);

describe("playMeteorStrikeFx", () => {
  it("is a no-op without the PVFX meteor texture", () => {
    const scene = fakeScene();
    playMeteorStrikeFx(asScene(scene), 0, 0, 50, false);
    expect(scene.created).toHaveLength(0);
  });

  it("scales to the blast (2.4x radius, min 96px) and self-destroys", () => {
    const scene = fakeScene({ textures: pvfxTextures });
    const register = vi.fn();
    playMeteorStrikeFx(asScene(scene), 3, 4, 100, true, register);
    playMeteorStrikeFx(asScene(scene), 3, 4, 10, false);
    const [big, small] = scene.made("sprite");
    expect(big!.args).toEqual([3, 4, PVFX_TEXTURE.meteorStrike]);
    expect(big!.last("setDisplaySize")).toEqual([240, 240]);
    expect(small!.last("setDisplaySize")).toEqual([96, 96]);
    expect(big!.last("setFlipX")).toEqual([true]);
    expect(big!.last("play")).toEqual([PVFX_ANIM.meteorStrike]);
    expect(register).toHaveBeenCalledWith(big);
    big!.emit("animationcomplete");
    expect(big!.destroyed).toBe(true);
  });
});

describe("playShadowformCastFx", () => {
  it("throws when the PVFX shadow clip is not loaded", () => {
    expect(() => playShadowformCastFx(asScene(fakeScene()), 0, 0)).toThrow(
      /PVFX texture missing \(shadowform buff start\)/,
    );
  });

  it("plays the shadow cast on the player and self-destroys", () => {
    const scene = fakeScene({ textures: pvfxTextures });
    const register = vi.fn();
    playShadowformCastFx(asScene(scene), 7, 8, register);
    const [s] = scene.made("sprite");
    expect(s!.args).toEqual([7, 8, PVFX_TEXTURE.shadowCast]);
    expect(s!.last("setDisplaySize")).toEqual([72, 72]);
    expect(s!.last("play")).toEqual([PVFX_ANIM.shadowCast]);
    expect(register).toHaveBeenCalledWith(s);
    s!.emit("animationcomplete");
    expect(s!.destroyed).toBe(true);
  });
});

describe("playIceWallSegmentEndFx", () => {
  it("requires the ice pack and the wall-ending animation", () => {
    expect(() => playIceWallSegmentEndFx(asScene(fakeScene()), 0, 0)).toThrow(
      /ice_wall segment end/,
    );
  });

  it("plays the trimmed ending strip just above obstacles", () => {
    const scene = fakeScene({ textures: iceTextures, anims: iceAnims });
    const register = vi.fn();
    playIceWallSegmentEndFx(asScene(scene), 1, 2, register);
    const [s] = scene.made("sprite");
    expect(s!.args).toEqual([1, 2, ICE_FX_TEXTURE.rootEnding]);
    expect(s!.last("setDepth")).toEqual([
      DEFENSE_RENDER_DEPTH.obstacleBlock + 0.5,
    ]);
    expect(s!.last("setDisplaySize")).toEqual([
      ICE_FX_ROOT_DISPLAY_PX,
      ICE_FX_ROOT_DISPLAY_PX,
    ]);
    expect(s!.last("play")).toEqual([ICE_FX_ANIM.wallEnding]);
    expect(register).toHaveBeenCalledWith(s);
    s!.emit("animationcomplete");
    expect(s!.destroyed).toBe(true);
  });
});

describe("SpellIceCastWindupFx", () => {
  it("requires the ice pack", () => {
    expect(() =>
      new SpellIceCastWindupFx(asScene(fakeScene())).start(0, 0, 500),
    ).toThrow(/frost cast windup/);
  });

  it("plays the cast start, retimes it to the cast, follows and stops", () => {
    const scene = fakeScene({ textures: iceTextures, anims: iceAnims });
    scene.anims.get = (key: string) => ({ key, duration: 600 });
    const register = vi.fn();
    const fx = new SpellIceCastWindupFx(asScene(scene));
    fx.start(10, 20, 300, register);
    const [s] = scene.made("sprite");
    expect(s!.args).toEqual([10, 20, ICE_FX_TEXTURE.castStart]);
    expect(s!.last("setDisplaySize")).toEqual([
      ICE_FX_CAST_START_DISPLAY_PX,
      ICE_FX_CAST_START_DISPLAY_PX,
    ]);
    expect(s!.last("play")).toEqual([ICE_FX_ANIM.castStart]);
    expect((s!.anims as { timeScale: number }).timeScale).toBe(2);
    expect(register).toHaveBeenCalledWith(s);

    fx.follow(30, 40);
    expect(s!.last("setPosition")).toEqual([30, 40]);

    // Restart replaces the old sprite.
    fx.start(0, 0, 0);
    expect(s!.destroyed).toBe(true);
    const next = scene.made("sprite")[1]!;
    expect((next.anims as { timeScale: number }).timeScale).toBe(1);
    fx.stop();
    expect(next.destroyed).toBe(true);
    // follow after stop is harmless
    fx.follow(1, 1);
    expect(next.callsTo("setPosition")).toHaveLength(0);
  });

  it("uses a zero timescale when the clip has no duration", () => {
    const scene = fakeScene({ textures: iceTextures, anims: iceAnims });
    scene.anims.get = () => undefined as never;
    const fx = new SpellIceCastWindupFx(asScene(scene));
    fx.start(10, 20, 300);
    const [s] = scene.made("sprite");
    expect((s!.anims as { timeScale: number }).timeScale).toBe(1);
    fx.stop();
  });
});

describe("playBruiserMeleeCritHitOnPlayerFx", () => {
  it("requires the crit clip, then plays it once on the player", () => {
    expect(() =>
      playBruiserMeleeCritHitOnPlayerFx(asScene(fakeScene()), 0, 0),
    ).toThrow(/bruiser melee crit on player/);
    const scene = fakeScene({ textures: pvfxTextures });
    const register = vi.fn();
    playBruiserMeleeCritHitOnPlayerFx(asScene(scene), 4, 5, register);
    const [s] = scene.made("sprite");
    expect(s!.args).toEqual([4, 5, PVFX_TEXTURE.critHit]);
    expect(s!.last("setDisplaySize")).toEqual([96, 80]);
    expect(s!.last("play")).toEqual([PVFX_ANIM.critHit]);
    expect(register).toHaveBeenCalledWith(s);
    s!.emit("animationcomplete");
    expect(s!.destroyed).toBe(true);
  });
});
