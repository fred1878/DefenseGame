import { describe, expect, it, vi } from "vitest";
import { ENEMY_MELEE_SLASH_SFX_KEYS } from "../../audio/enemyMeleeSlashSfx";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import type { EnemyInstance } from "../../entities/Enemy";
import { createRangedHybridCombatState } from "../../entities/enemyRanged/types";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { fakeScene, type FakeGameObject } from "../../test/fakeScene";
import { enemyMeleeFxSpec } from "../../content/meleeFxAssets";
import {
  cancelEnemyMeleeFxTimer,
  destroyEnemyMeleeFx,
  enemyShouldShowMeleeSwipeFx,
  scheduleEnemyMeleeFx,
} from "./enemyMeleeFxSchedule";

function meleeEnemy(partial: Partial<EnemyInstance> = {}) {
  const scene = fakeScene({ audio: [...ENEMY_MELEE_SLASH_SFX_KEYS] });
  const enemy = mockEnemyInstance({
    behavior: "meleeChaser",
    defId: "no_clip_enemy",
    ...partial,
  });
  (enemy.sprite as unknown as { scene: unknown }).scene = scene;
  return { enemy, scene };
}

describe("enemyShouldShowMeleeSwipeFx", () => {
  it("is off for ranged-only behaviours and lobbers", () => {
    for (const behavior of [
      "javelineer",
      "lobber",
      "stationaryRanged",
    ] as const) {
      expect(enemyShouldShowMeleeSwipeFx(mockEnemyInstance({ behavior }))).toBe(
        false,
      );
    }
    expect(
      enemyShouldShowMeleeSwipeFx(
        mockEnemyInstance({ behavior: "meleeChaser" }),
      ),
    ).toBe(true);
  });

  it("hybrids only swipe in melee mode; chargers not while charging", () => {
    const hybrid = mockEnemyInstance({ behavior: "rangedHybrid" });
    const state = createRangedHybridCombatState();
    hybrid.rangedHybrid = state;
    expect(enemyShouldShowMeleeSwipeFx(hybrid)).toBe(false);
    state.mode = "melee";
    expect(enemyShouldShowMeleeSwipeFx(hybrid)).toBe(true);

    const charger = mockEnemyInstance({ behavior: "charger" });
    expect(enemyShouldShowMeleeSwipeFx(charger)).toBe(true);
    charger.behaviorExtra.chargeWindupMs = 100;
    expect(enemyShouldShowMeleeSwipeFx(charger)).toBe(false);
  });
});

describe("scheduleEnemyMeleeFx", () => {
  it("schedules one swipe + slash sound per swing at the windup FX start", () => {
    const { enemy, scene } = meleeEnemy();
    const melee = enemy.combatTuning.melee!;
    enemy.combat.phase = "windup";
    scheduleEnemyMeleeFx(enemy);
    scheduleEnemyMeleeFx(enemy); // second call in same swing ignored
    expect(scene.delayed).toHaveLength(1);
    expect(scene.delayed[0]!.delay).toBe(melee.fxStartMs);
    expect(enemy.combat.slashFxShown).toBe(true);

    scene.delayed[0]!.fn();
    expect(enemy.combat.slashFxTimer).toBeUndefined();
    expect(scene.made("image")[0]!.args[2]).toBe(COMBAT_FX_TEXTURE.gruntMelee);
    expect(scene.sound.play).toHaveBeenCalledTimes(1);
  });

  it("skips the swipe if the swing was cancelled back to idle", () => {
    const { enemy, scene } = meleeEnemy();
    enemy.combat.phase = "idle";
    scheduleEnemyMeleeFx(enemy);
    scene.delayed[0]!.fn();
    expect(scene.created).toHaveLength(0);
    expect(scene.sound.play).not.toHaveBeenCalled();
  });

  it("does nothing for enemies that never swipe or have no scene clock", () => {
    const { enemy, scene } = meleeEnemy({ behavior: "lobber" });
    scheduleEnemyMeleeFx(enemy);
    expect(scene.delayed).toHaveLength(0);

    const noClock = mockEnemyInstance({ behavior: "meleeChaser" });
    (noClock.sprite as unknown as { scene: unknown }).scene = undefined;
    scheduleEnemyMeleeFx(noClock);
    expect(noClock.combat.slashFxShown).toBe(true);
    expect(noClock.combat.slashFxTimer).toBeUndefined();
  });

  it("tracks each swipe sprite and leaves it playing when a swing restarts", () => {
    const spec = enemyMeleeFxSpec("grunt")!;
    const scene = fakeScene({
      textures: [spec.textureKey],
      anims: [spec.animKey],
      audio: [...ENEMY_MELEE_SLASH_SFX_KEYS],
    });
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      defId: "grunt",
    });
    (enemy.sprite as unknown as { scene: unknown }).scene = scene;
    enemy.combat.phase = "windup";
    scheduleEnemyMeleeFx(enemy);
    scene.delayed[0]!.fn();

    const [sprite] = scene.made("sprite");
    expect([...enemy.combat.slashFxSprites]).toEqual([sprite]);
    expect(sprite!.destroyed).toBe(false);

    cancelEnemyMeleeFxTimer(enemy.combat);
    expect(sprite!.destroyed).toBe(false);
    expect(enemy.combat.slashFxSprites.has(sprite as never)).toBe(true);
  });

  it("death cleanup releases live swipe sprites back to the pool", () => {
    const scene = fakeScene();
    const spawnSprite = scene.add.sprite as unknown as (
      x: number,
      y: number,
      key: string,
    ) => FakeGameObject;
    const combat = mockEnemyInstance({ behavior: "meleeChaser" }).combat;
    const a = spawnSprite(0, 0, "fx_melee_grunt");
    const b = spawnSprite(0, 0, "fx_melee_grunt");
    combat.slashFxSprites.add(a as never);
    combat.slashFxSprites.add(b as never);
    const remove = vi.fn();
    combat.slashFxTimer = { remove } as never;

    destroyEnemyMeleeFx(combat);

    expect(remove).toHaveBeenCalledOnce();
    expect(a.destroyed).toBe(false);
    expect(a.last("setVisible")).toEqual([false]);
    expect(b.last("setVisible")).toEqual([false]);
    expect(combat.slashFxSprites.size).toBe(0);
  });

  it("cancel removes a pending timer once", () => {
    const remove = vi.fn();
    const combat = mockEnemyInstance({ behavior: "meleeChaser" }).combat;
    combat.slashFxTimer = { remove } as never;
    cancelEnemyMeleeFxTimer(combat);
    cancelEnemyMeleeFxTimer(combat);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(false);
  });
});

describe("scheduleEnemyMeleeFx leftover branches", () => {
  it("does nothing when the enemy has no melee table", () => {
    const { enemy, scene } = meleeEnemy({ behavior: "meleeChaser" });
    delete (enemy.combatTuning as { melee?: unknown }).melee;
    scheduleEnemyMeleeFx(enemy);
    expect(scene.delayed).toHaveLength(0);
    expect(enemy.combat.slashFxShown).toBe(false);
  });
});
