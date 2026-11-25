import { describe, expect, it, vi } from "vitest";
import { ENEMY_MELEE_SLASH_SFX_KEYS } from "../audio/enemyMeleeSlashSfx";
import { COMBAT_FX_TEXTURE } from "../content/assets";
import type { EnemyInstance } from "../entities/Enemy";
import { createRangedHybridCombatState } from "../entities/enemyRanged/types";
import { mockEnemyInstance } from "../entities/testEnemyInstance";
import { fakeScene } from "../test/fakeScene";
import {
  cancelEnemyMeleeFxTimer,
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
