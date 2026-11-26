import { describe, expect, it, vi } from "vitest";
import type { Player } from "../../entities/Player";
import { fakeGameObject } from "../../test/fakeScene";
import {
  destroyDefenseSceneObjects,
  syncShadowformPlayerFx,
} from "./DefenseSceneLifecycle";

describe("destroyDefenseSceneObjects", () => {
  it("destroys HUD handles and clears projectile sprites", () => {
    const stick = { destroy: vi.fn() };
    const returnBtn = {
      container: fakeGameObject("container"),
    };
    const scene = {
      scene: { key: "Defense" },
      textures: { exists: () => false },
    };
    const projectiles = [
      { sprite: fakeGameObject("sprite") },
    ] as unknown as Parameters<
      typeof destroyDefenseSceneObjects
    >[0]["projectiles"];
    destroyDefenseSceneObjects({
      scene: scene as never,
      stick,
      clearSpellTelegraphs: vi.fn(),
      returnToTownBtn: returnBtn as never,
      leaveEndlessBtn: null,
      projectiles,
      enemyProjectiles: [],
      enemies: [],
    });
    expect(stick.destroy).toHaveBeenCalled();
    expect((returnBtn.container as { destroyed: boolean }).destroyed).toBe(
      true,
    );
    const sprite = projectiles[0]?.sprite as unknown as { destroyed: boolean };
    expect(sprite?.destroyed).toBe(true);
  });
});

describe("syncShadowformPlayerFx", () => {
  it("tints the player sprite while shadowform is active", () => {
    const sprite = fakeGameObject("sprite");
    const player = { sprite } as unknown as Player;
    syncShadowformPlayerFx(player, true);
    expect(sprite.callsTo("setAlpha").length).toBeGreaterThan(0);
    syncShadowformPlayerFx(player, false);
    expect(sprite.callsTo("clearTint").length).toBeGreaterThan(0);
  });
});
