import Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import {
  projectileTextureRotationOffset,
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  registerCombatPvfxAnimations,
} from "./combatPvfxAssets";

describe("combatPvfxAssets", () => {
  it("uses zero rotation offset for right-facing PVFX projectile textures", () => {
    expect(projectileTextureRotationOffset("fx_pvfx_fireball_flight")).toBe(0);
    expect(projectileTextureRotationOffset("fx_pvfx_lightning_flight")).toBe(0);
    expect(projectileTextureRotationOffset("fx_stone_throw")).toBeUndefined();
  });

  it("registers PVFX animation keys when textures exist", () => {
    const created: string[] = [];
    const scene = {
      textures: {
        exists: (key: string) => PVFX_FX_ASSETS.some((a) => a.key === key),
      },
      anims: {
        exists: (key: string) => created.includes(key),
        create: (cfg: { key: string }) => {
          created.push(cfg.key);
        },
        generateFrameNumbers: vi.fn(() => []),
      },
    } as unknown as Phaser.Scene;

    registerCombatPvfxAnimations(scene);

    expect(created).toEqual(
      expect.arrayContaining([
        PVFX_ANIM.meteorStrike,
        PVFX_ANIM.iceShatterStunLoop,
        PVFX_ANIM.iceShatterRelease,
        PVFX_ANIM.arrowFlight,
        PVFX_ANIM.fireballFlight,
        PVFX_ANIM.lightningFlight,
      ]),
    );
  });
});