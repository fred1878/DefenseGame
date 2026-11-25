import { describe, expect, it, vi } from "vitest";
import { DEFENSE_RENDER_DEPTH } from "../config";
import {
  ICE_FX_ANIM,
  ICE_FX_ASSETS,
  ICE_FX_BOLT_DISPLAY_H_PX,
  ICE_FX_BOLT_DISPLAY_W_PX,
  ICE_FX_TEXTURE,
} from "../content/iceFxAssets";
import type { PlayerProjectile } from "../entities/Projectile";
import { asScene, fakeGameObject, fakeScene } from "../test/fakeScene";
import {
  attachIceBoltProjectileFx,
  destroyIceBoltProjectileFx,
  finishIceBoltProjectileHit,
  playIceBoltHitFx,
  syncIceBoltProjectileFx,
} from "./SpellIceBoltProjectileFx";

function iceScene() {
  return fakeScene({
    textures: ICE_FX_ASSETS.map((a) => a.key),
    anims: Object.values(ICE_FX_ANIM),
  });
}

function projectileMovingEast(x = 10, y = 20): PlayerProjectile {
  const sprite = fakeGameObject("physics.sprite", [x, y]);
  sprite.setVelocity(300, 0);
  return { sprite } as unknown as PlayerProjectile;
}

describe("SpellIceBoltProjectileFx", () => {
  it("refuses to attach when the ice pack is not loaded", () => {
    expect(() =>
      attachIceBoltProjectileFx(asScene(fakeScene()), projectileMovingEast()),
    ).toThrow(/Ice combat FX not ready \(ice_bolt travel\)/);
  });

  it("hides the physics body and plays start, then switches to the travel loop", () => {
    const scene = iceScene();
    const projectile = projectileMovingEast();
    const register = vi.fn();
    attachIceBoltProjectileFx(asScene(scene), projectile, register);

    const [overlay] = scene.made("sprite");
    expect(overlay!.args).toEqual([10, 20, ICE_FX_TEXTURE.boltStart]);
    expect(overlay!.last("setDepth")).toEqual([
      DEFENSE_RENDER_DEPTH.projectile + 0.2,
    ]);
    expect(overlay!.last("setDisplaySize")).toEqual([
      ICE_FX_BOLT_DISPLAY_W_PX,
      ICE_FX_BOLT_DISPLAY_H_PX,
    ]);
    expect(overlay!.last("setRotation")).toEqual([0]);
    expect(register).toHaveBeenCalledWith(overlay);
    expect((projectile.sprite as unknown as { alpha: number }).alpha).toBe(0);
    expect(projectile.iceBoltFx?.phase).toBe("start");
    expect(overlay!.last("play")).toEqual([ICE_FX_ANIM.boltStart]);

    overlay!.emit("animationcomplete");
    expect(projectile.iceBoltFx?.phase).toBe("travel");
    expect(overlay!.last("play")).toEqual([ICE_FX_ANIM.boltRepeat]);
  });

  it("ignores a stale start-complete after the FX was torn down", () => {
    const scene = iceScene();
    const projectile = projectileMovingEast();
    attachIceBoltProjectileFx(asScene(scene), projectile);
    const [overlay] = scene.made("sprite");
    destroyIceBoltProjectileFx(projectile);
    expect(overlay!.destroyed).toBe(true);
    expect(projectile.iceBoltFx).toBeUndefined();
    overlay!.emit("animationcomplete");
    expect(overlay!.callsTo("play")).toHaveLength(1);
    // Second destroy is a no-op.
    destroyIceBoltProjectileFx(projectile);
    expect(overlay!.callsTo("destroy")).toHaveLength(1);
  });

  it("sync follows the projectile and rotates along its velocity", () => {
    const scene = iceScene();
    const projectile = projectileMovingEast();
    attachIceBoltProjectileFx(asScene(scene), projectile);
    const [overlay] = scene.made("sprite");
    const body = projectile.sprite as unknown as {
      x: number;
      y: number;
      setVelocity(x: number, y: number): void;
    };
    body.x = 50;
    body.y = 60;
    body.setVelocity(0, 200);
    syncIceBoltProjectileFx(projectile);
    expect(overlay!.last("setPosition")).toEqual([50, 60]);
    expect(overlay!.last("setRotation")![0]).toBeCloseTo(Math.PI / 2);

    // Inactive projectile -> no further sync.
    (projectile.sprite as unknown as { active: boolean }).active = false;
    body.x = 99;
    syncIceBoltProjectileFx(projectile);
    expect(overlay!.last("setPosition")).toEqual([50, 60]);
  });

  it("plays a one-shot hit that destroys itself", () => {
    const scene = iceScene();
    const register = vi.fn();
    playIceBoltHitFx(asScene(scene), 1, 2, 0.5, register);
    const [hit] = scene.made("sprite");
    expect(hit!.args).toEqual([1, 2, ICE_FX_TEXTURE.boltHit]);
    expect(hit!.last("setRotation")).toEqual([0.5]);
    expect(hit!.last("play")).toEqual([ICE_FX_ANIM.boltHit]);
    expect(register).toHaveBeenCalledWith(hit);
    hit!.emit("animationcomplete");
    expect(hit!.destroyed).toBe(true);
  });

  it("finishing a hit swaps the travel overlay for a hit burst at the overlay position", () => {
    const scene = iceScene();
    const projectile = projectileMovingEast(10, 20);
    attachIceBoltProjectileFx(asScene(scene), projectile);
    const [overlay] = scene.made("sprite");
    overlay!.setPosition(70, 80);
    finishIceBoltProjectileHit(asScene(scene), projectile);
    expect(overlay!.destroyed).toBe(true);
    const hit = scene.made("sprite")[1]!;
    expect(hit.args).toEqual([70, 80, ICE_FX_TEXTURE.boltHit]);
  });

  it("finishing without an overlay bursts at the projectile body", () => {
    const scene = iceScene();
    const projectile = projectileMovingEast(3, 4);
    finishIceBoltProjectileHit(asScene(scene), projectile);
    expect(scene.made("sprite")[0]!.args).toEqual([
      3,
      4,
      ICE_FX_TEXTURE.boltHit,
    ]);
  });
});
