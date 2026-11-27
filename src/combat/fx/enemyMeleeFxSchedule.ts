import { playEnemyMeleeSlashSfx } from "../../audio/enemyMeleeSlashSfx";
import { RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS } from "../../core/enemyTuning";
import type { EnemyInstance } from "../../entities/Enemy";
import type { EnemyCombatState } from "../../entities/EnemyCombat";
import { showEnemyMeleeSwipe } from "./MeleeSwipeFx";
import { releaseMeleeFxSprite } from "./meleeFxPool";

/** Cancel a pending swing FX timer (interrupt, new windup, pool release). */
export function cancelEnemyMeleeFxTimer(combat: EnemyCombatState): void {
  if (!combat.slashFxTimer) return;
  combat.slashFxTimer.remove(false);
  combat.slashFxTimer = undefined;
}

/**
 * Death cleanup, only when `combat.melee.fxRecycleOnDeath` is authored true:
 * drop a pending timer and pull every swipe sprite still playing back into the
 * scene pool. Swings that start again normally leave the previous sprite to
 * finish on its own.
 */
export function destroyEnemyMeleeFx(combat: EnemyCombatState): void {
  cancelEnemyMeleeFxTimer(combat);
  for (const sprite of combat.slashFxSprites) {
    if (sprite.scene) releaseMeleeFxSprite(sprite.scene, sprite);
    else sprite.destroy();
  }
  combat.slashFxSprites.clear();
}

export function enemyShouldShowMeleeSwipeFx(enemy: EnemyInstance): boolean {
  if (RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS.has(enemy.behavior)) {
    return false;
  }
  if (enemy.behavior === "rangedHybrid") {
    return enemy.rangedHybrid?.mode === "melee";
  }
  if (enemy.behavior === "charger") {
    const extra = enemy.behaviorExtra;
    if (extra.chargeActiveMs > 0 || extra.chargeWindupMs > 0) {
      return false;
    }
  }
  return true;
}

/** Schedule swipe FX once per swing from windup start (`fxStartMs` delay). */
export function scheduleEnemyMeleeFx(enemy: EnemyInstance): void {
  if (!enemyShouldShowMeleeSwipeFx(enemy)) return;
  const c = enemy.combat;
  if (c.slashFxShown) return;

  const melee = enemy.combatTuning.melee;
  if (!melee) return;

  c.slashFxShown = true;
  cancelEnemyMeleeFxTimer(c);

  const scene = enemy.sprite.scene;
  const time = scene?.time;
  if (!time?.delayedCall) {
    return;
  }

  c.slashFxTimer = time.delayedCall(melee.fxStartMs, () => {
    c.slashFxTimer = undefined;
    if (c.phase === "idle") return;
    const sprite = showEnemyMeleeSwipe(
      scene,
      enemy.defId,
      enemy.sprite.x,
      enemy.sprite.y,
      c.facing,
      melee.fxDurationMs,
      melee.activeMs,
      {
        vfxDisplayW: melee.vfxDisplayW,
        vfxDisplayH: melee.vfxDisplayH,
        vfxOffsetWu: melee.vfxOffsetWu,
      },
    );
    if (sprite) {
      for (const live of c.slashFxSprites) {
        if (!live.active) c.slashFxSprites.delete(live);
      }
      c.slashFxSprites.add(sprite);
    }
    playEnemyMeleeSlashSfx(scene);
  });
}
