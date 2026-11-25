import { playEnemyMeleeSlashSfx } from "../audio/enemyMeleeSlashSfx";
import { RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS } from "../core/enemyTuning";
import type { EnemyInstance } from "../entities/Enemy";
import type { EnemyCombatState } from "../entities/EnemyCombat";
import { showEnemyMeleeSwipe } from "./MeleeSwipeFx";

/** Cancel a pending melee swipe VFX timer (interrupt / new swing). */
export function cancelEnemyMeleeFxTimer(combat: EnemyCombatState): void {
  if (!combat.slashFxTimer) return;
  combat.slashFxTimer.remove(false);
  combat.slashFxTimer = undefined;
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
  if (enemy.behavior === "lobber") return false;
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
    showEnemyMeleeSwipe(
      scene,
      enemy.defId,
      enemy.sprite.x,
      enemy.sprite.y,
      c.facing,
      melee.fxDurationMs,
      melee.activeMs,
    );
    playEnemyMeleeSlashSfx(scene);
  });
}