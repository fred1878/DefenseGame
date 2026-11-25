import { describe, expect, it, vi } from "vitest";
import {
  PVFX_ANIM,
  PVFX_FX_ASSETS,
  PVFX_TEXTURE,
} from "../content/combatPvfxAssets";
import type { PlayerProjectile } from "../entities/Projectile";
import { asScene, fakeGameObject, fakeScene } from "../test/fakeScene";
import {
  attachPvfxProjectileFx,
  destroyPvfxProjectileFx,
  syncPvfxProjectileFx,
} from "./SpellPvfxProjectileFx";

function projectile(vx: number, vy: number): PlayerProjectile {
  const sprite = fakeGameObject("physics.sprite", [5, 6]);
  sprite.setVelocity(vx, vy);
  return { sprite } as unknown as PlayerProjectile;
}

const pvfxScene = () =>
  fakeScene({ textures: PVFX_FX_ASSETS.map((a) => a.key) });

describe("SpellPvfxProjectileFx", () => {
  it("does nothing for textures without a flight loop", () => {
    const scene = pvfxScene();
    const p = projectile(1, 0);
    attachPvfxProjectileFx(asScene(scene), p, "fx_stone_throw");
    expect(scene.created).toHaveLength(0);
    expect(p.pvfxFlightFx).toBeUndefined();
  });

  it("does nothing when the flight texture (and so its anim) is missing", () => {
    const scene = fakeScene();
    const p = projectile(1, 0);
    attachPvfxProjectileFx(asScene(scene), p, PVFX_TEXTURE.fireballFlight);
    expect(scene.created).toHaveLength(0);
  });

  it("registers anims and plays the fireball loop sized 1.85x its frame", () => {
    const scene = pvfxScene();
    const p = projectile(0, -100);
    const register = vi.fn();
    attachPvfxProjectileFx(
      asScene(scene),
      p,
      PVFX_TEXTURE.fireballFlight,
      register,
    );
    const [overlay] = scene.made("sprite");
    expect(overlay!.args).toEqual([5, 6, PVFX_TEXTURE.fireballFlight]);
    expect(overlay!.last("setDisplaySize")).toEqual([72 * 1.85, 32 * 1.85]);
    expect(overlay!.last("setRotation")![0]).toBeCloseTo(-Math.PI / 2);
    expect(overlay!.last("play")).toEqual([PVFX_ANIM.fireballFlight]);
    expect(register).toHaveBeenCalledWith(overlay);
    expect(p.pvfxFlightFx?.sprite).toBe(overlay);
    expect((p.sprite as unknown as { alpha: number }).alpha).toBe(0);
  });

  it("scales the arrow flight a bit larger (2.1x)", () => {
    const scene = pvfxScene();
    attachPvfxProjectileFx(
      asScene(scene),
      projectile(1, 0),
      PVFX_TEXTURE.arrowFlight,
    );
    expect(scene.made("sprite")[0]!.last("setDisplaySize")).toEqual([
      51 * 2.1,
      15 * 2.1,
    ]);
  });

  it("sync tracks position/heading while active; destroy clears it once", () => {
    const scene = pvfxScene();
    const p = projectile(1, 0);
    attachPvfxProjectileFx(asScene(scene), p, PVFX_TEXTURE.lightningFlight);
    const overlay = scene.made("sprite")[0]!;
    const body = p.sprite as unknown as {
      x: number;
      y: number;
      setVelocity(x: number, y: number): void;
    };
    body.x = 40;
    body.y = 41;
    body.setVelocity(-10, 0);
    syncPvfxProjectileFx(p);
    expect(overlay.last("setPosition")).toEqual([40, 41]);
    expect(overlay.last("setRotation")![0]).toBeCloseTo(Math.PI);

    destroyPvfxProjectileFx(p);
    expect(overlay.destroyed).toBe(true);
    expect(p.pvfxFlightFx).toBeUndefined();
    destroyPvfxProjectileFx(p);
    expect(overlay.callsTo("destroy")).toHaveLength(1);
    // No overlay -> sync is a no-op.
    expect(() => syncPvfxProjectileFx(p)).not.toThrow();
  });
});
