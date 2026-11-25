import { destroyArrowRainTelegraph } from "../../combat/ArrowRainTelegraph";
import { cancelEnemyMeleeFxTimer } from "../../combat/enemyMeleeFxSchedule";
import type { EnemyInstance } from "../Enemy";
import { clearEnemyAttackCommit } from "./attackCommit";

/** External CC (stun) — clears telegraphs and attack phase; not used for range-based self-cancel. */
export function interruptEnemyAttack(enemy: EnemyInstance): void {
  const c = enemy.combat;
  if (c.phase === "idle" && c.attackTargetKind == null) return;

  destroyArrowRainTelegraph(enemy.arrowRain?.telegraph);
  if (enemy.arrowRain) {
    enemy.arrowRain.telegraph = undefined;
  }
  destroyArrowRainTelegraph(enemy.lobber?.telegraph);
  if (enemy.lobber) {
    enemy.lobber.telegraph = undefined;
    enemy.lobber.lobThrown = false;
  }
  if (enemy.javelineer) enemy.javelineer.shotFired = false;
  if (enemy.stationaryRanged) enemy.stationaryRanged.shotFired = false;
  if (enemy.rangedHybrid) enemy.rangedHybrid.shotFired = false;

  c.phase = "idle";
  c.phaseMs = 0;
  c.hitThisSwing = false;
  cancelEnemyMeleeFxTimer(c);
  c.slashFxShown = false;
  clearEnemyAttackCommit(c);
}