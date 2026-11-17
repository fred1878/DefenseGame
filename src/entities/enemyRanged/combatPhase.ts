import type { EnemyInstance } from "../Enemy";
import {
  enemyIsAttacking,
  type EnemyAttackPhase,
  type EnemyAttackTarget,
  type EnemyCombatState,
} from "../EnemyCombat";

export function advanceCombatPhase(
  c: EnemyCombatState,
  windupMs: number,
  activeMs: number,
  recoveryMs: number,
  cooldownMs: number,
  deltaMs: number,
): void {
  if (c.phase === "idle") return;
  c.phaseMs += deltaMs;
  if (c.phase === "windup" && c.phaseMs >= windupMs) {
    c.phase = "active";
    c.phaseMs = 0;
  } else if (c.phase === "active" && c.phaseMs >= activeMs) {
    c.phase = "recovery";
    c.phaseMs = 0;
  } else if (c.phase === "recovery" && c.phaseMs >= recoveryMs) {
    c.phase = "idle";
    c.phaseMs = 0;
    c.cooldownMs = cooldownMs;
  }
}

export function freezeWindupRecovery(
  enemy: EnemyInstance,
  phase: EnemyAttackPhase,
  targetKind: EnemyAttackTarget["kind"],
): void {
  const hold =
    enemyIsAttacking(enemy.combat) &&
    (targetKind === "wall" || phase === "windup" || phase === "recovery");
  if (hold) {
    enemy.sprite.setVelocity(0, 0);
  }
}