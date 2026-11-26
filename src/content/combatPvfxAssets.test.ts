import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { asScene, fakeScene } from "../test/fakeScene";
import {
  assertPvfxClipReady,
  enemyProjectileTextureKey,
  projectileTextureRotationOffset,
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
  pvfxPackLoaded,
  registerCombatPvfxAnimations,
  spellProjectileTextureKey,
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
        PVFX_ANIM.critHit,
        PVFX_ANIM.holyCast,
        PVFX_ANIM.shadowCast,
        PVFX_ANIM.flameRing,
        PVFX_ANIM.incinerate,
        PVFX_ANIM.firePillar,
        PVFX_ANIM.groundFlamesLoop,
      ]),
    );
  });
});
describe("combatPvfxAssets scene helpers", () => {
  const allKeys = PVFX_FX_ASSETS.map((a) => a.key);

  it("pvfxPackLoaded needs every sheet", () => {
    expect(pvfxPackLoaded(asScene(fakeScene({ textures: allKeys })))).toBe(
      true,
    );
    expect(
      pvfxPackLoaded(asScene(fakeScene({ textures: allKeys.slice(1) }))),
    ).toBe(false);
  });

  it("assertPvfxClipReady names the missing texture or animation", () => {
    expect(() =>
      assertPvfxClipReady(
        asScene(fakeScene()),
        PVFX_TEXTURE.critHit,
        PVFX_ANIM.critHit,
        "crit",
      ),
    ).toThrow("PVFX texture missing (crit): fx_pvfx_crit_hit");
    // Texture present but registration cannot make an unknown anim.
    expect(() =>
      assertPvfxClipReady(
        asScene(fakeScene({ textures: [PVFX_TEXTURE.critHit] })),
        PVFX_TEXTURE.critHit,
        "nope",
        "crit",
      ),
    ).toThrow("PVFX animation missing (crit): nope");
    const ok = fakeScene({ textures: [PVFX_TEXTURE.critHit] });
    expect(() =>
      assertPvfxClipReady(
        asScene(ok),
        PVFX_TEXTURE.critHit,
        PVFX_ANIM.critHit,
        "crit",
      ),
    ).not.toThrow();
  });

  it("registers one-shot clips with 0 repeat and ice-shatter split at the stun loop", () => {
    const scene = fakeScene({ textures: allKeys });
    registerCombatPvfxAnimations(asScene(scene));
    const byKey = new Map(
      scene.anims.create.mock.calls.map((c) => {
        const cfg = c[0] as unknown as {
          key: string;
          repeat: number;
          frames: unknown[];
        };
        return [cfg.key, cfg] as const;
      }),
    );
    expect(byKey.size).toBe(Object.keys(PVFX_ANIM).length);
    expect(byKey.get(PVFX_ANIM.iceShatterStunLoop)).toMatchObject({
      repeat: -1,
    });
    expect(byKey.get(PVFX_ANIM.iceShatterStunLoop)!.frames).toHaveLength(3);
    expect(byKey.get(PVFX_ANIM.iceShatterRelease)!.frames).toHaveLength(20);
    expect(byKey.get(PVFX_ANIM.critHit)).toMatchObject({ repeat: 0 });
    expect(byKey.get(PVFX_ANIM.fireballFlight)).toMatchObject({ repeat: -1 });
    // Idempotent.
    registerCombatPvfxAnimations(asScene(scene));
    expect(scene.anims.create).toHaveBeenCalledTimes(byKey.size);
  });

  it("prefers PVFX projectile textures only when the whole pack is loaded", () => {
    const loaded = asScene(fakeScene({ textures: allKeys }));
    const partial = asScene(
      fakeScene({ textures: [PVFX_TEXTURE.fireballFlight] }),
    );
    expect(spellProjectileTextureKey(loaded, "fire_bolt", "fb")).toBe(
      PVFX_TEXTURE.fireballFlight,
    );
    expect(spellProjectileTextureKey(loaded, "chain_lightning", "x")).toBe(
      PVFX_TEXTURE.lightningFlight,
    );
    expect(spellProjectileTextureKey(loaded, "water_bolt", "wb")).toBe("wb");
    expect(spellProjectileTextureKey(partial, "fire_bolt", "fb")).toBe("fb");
    expect(enemyProjectileTextureKey(loaded, "sentry_archer", "arrow")).toBe(
      PVFX_TEXTURE.arrowFlight,
    );
    expect(enemyProjectileTextureKey(loaded, "lobber", "rock")).toBe("rock");
    expect(enemyProjectileTextureKey(partial, "sentry_archer", "arrow")).toBe(
      "arrow",
    );
  });
});

describe("assertPvfxClipReady leftover branches", () => {
  it("treats a missing exists() result as an unregistered anim", () => {
    const scene = asScene(
      fakeScene({ textures: [PVFX_TEXTURE.fireballFlight] }),
    );
    (scene.anims as { exists: (key: string) => unknown }).exists = () =>
      undefined;
    expect(() =>
      assertPvfxClipReady(
        scene,
        PVFX_TEXTURE.fireballFlight,
        PVFX_ANIM.fireballFlight,
        "test",
      ),
    ).toThrow(/PVFX animation missing/);
  });
});
