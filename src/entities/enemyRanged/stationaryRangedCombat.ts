import { setEnemyChaseVelocity } from "../../combat/enemyKnockback";
import type { EnemyInstance } from "../Enemy";
import { enemyIsAttacking, type EnemyAttackTarget } from "../EnemyCombat";
import { commitEnemyAttack } from "./attackCommit";
import { advanceCombatPhase } from "./combatPhase";
import type { JavelinSpawnRequest, StationaryRangedCombatState } from "./types";

export function updateStationaryRangedCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: StationaryRangedCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnBolt?: JavelinSpawnRequest } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.stationaryRanged!;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  if (c.phase === "idle") {
    c.facing = Math.atan2(dy, dx);
  }

  const minVolley = Math.max(0, tune.preferredRange - 22);
  const inRange =
    dist <= tune.attackTriggerRange && dist >= minVolley;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.shotFired = false;
    c.hitThisSwing = false;
    commitEnemyAttack(
      c,
      enemy.sprite.x,
      enemy.sprite.y,
      target,
      target.x,
      target.y,
    );
  }

  advanceCombatPhase(
    c,
    tune.windupMs,
    tune.activeMs,
    tune.recoveryMs,
    tune.cooldownMs,
    deltaMs,
  );

  let spawnBolt: JavelinSpawnRequest | undefined;

  if (c.phase === "active" && !extra.shotFired && c.attackTargetKind != null) {
    extra.shotFired = true;
    spawnBolt = {
      fromX: enemy.sprite.x,
      fromY: enemy.sprite.y,
      toX: c.commitAimX,
      toY: c.commitAimY,
      damage: enemy.damage,
    };
    if (c.attackTargetKind === "wall" && !c.hitThisSwing) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  if (enemyIsAttacking(c)) {
    setEnemyChaseVelocity(enemy, 0, 0);
  }

  return { spawnBolt };
}