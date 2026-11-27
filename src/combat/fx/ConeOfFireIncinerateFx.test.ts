import { describe, expect, it, vi } from "vitest";
import { asScene, fakeScene } from "../../test/fakeScene";
import {
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
} from "../../content/combatPvfxAssets";
import {
  CONE_OF_FIRE_FAN_STEP_RAD,
  coneOfFireFanAngles,
  incinerateRotationRad,
  playConeOfFireIncinerateFx,
  PVFX_INCINERATE_UP_ROT_OFFSET,
} from "./ConeOfFireIncinerateFx";

describe("coneOfFireIncinerateFx", () => {
  it("fans three incinerate instances ±25° with sheet-up aligned to aim", () => {
    const facing = 1.2;
    expect(coneOfFireFanAngles(facing)).toEqual([
      facing - CONE_OF_FIRE_FAN_STEP_RAD,
      facing,
      facing + CONE_OF_FIRE_FAN_STEP_RAD,
    ]);
    expect(incinerateRotationRad(facing)).toBe(
      facing + PVFX_INCINERATE_UP_ROT_OFFSET,
    );
  });

  it("spawns three sprites and registers animations when PVFX is loaded", () => {
    const allKeys = PVFX_FX_ASSETS.map((a) => a.key);
    const anims = Object.values(PVFX_ANIM);
    const scene = fakeScene({ textures: allKeys, anims });
    const register = vi.fn();
    playConeOfFireIncinerateFx(asScene(scene), 10, 20, 0, 180, register);
    expect(scene.made("sprite")).toHaveLength(3);
    for (const call of scene.made("sprite")) {
      expect(call.args[2]).toBe(PVFX_TEXTURE.incinerate);
    }
    expect(register).toHaveBeenCalledTimes(3);
  });

  it("throws when the incinerate texture is missing", () => {
    const scene = fakeScene({
      textures: PVFX_FX_ASSETS.map((a) => a.key).filter(
        (k) => k !== PVFX_TEXTURE.incinerate,
      ),
    });
    expect(() =>
      playConeOfFireIncinerateFx(asScene(scene), 0, 0, 0, 100),
    ).toThrow(/PVFX texture missing.*cone_of_fire/);
  });
});
