import { setEnemyChaseVelocity } from "../../combat/enemyKnockback";
import type { EnemyInstance } from "../Enemy";
import {
  enemyIsAttacking,
  type EnemyAttackPhase,
  type EnemyAttackTarget,
  type EnemyCombatState,
} from "../EnemyCombat";
import { clearEnemyAttackCommit } from "./attackCommit";

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
    clearEnemyAttackCommit(c);
  }
}

export function freezeWindupRecovery(
  enemy: EnemyInstance,
  _phase: EnemyAttackPhase,
  _targetKind: EnemyAttackTarget["kind"],
): void {
  const hold = enemyIsAttacking(enemy.combat);
  if (hold) {
    setEnemyChaseVelocity(enemy, 0, 0);
  }
}