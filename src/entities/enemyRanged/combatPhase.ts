import type { EnemyInstance } from "../Enemy";
import type { EnemyAttackTarget, EnemyCombatState } from "../EnemyCombat";
import { clearEnemyAttackCommit } from "./attackCommit";
import type { JavelinSpawnRequest } from "./types";

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

/**
 * Shared ranged prelude: tick the cooldown, face the target while idle, and
 * return the distance to it.
 */
export function tickCooldownAndFaceTarget(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  deltaMs: number,
): number {
  const c = enemy.combat;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);
  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  if (c.phase === "idle") {
    c.facing = Math.atan2(dy, dx);
  }
  return Math.hypot(dx, dy);
}

/** Straight bolt from the enemy to its committed aim point. */
export function boltToCommittedAim(
  enemy: EnemyInstance,
  damage: number,
): JavelinSpawnRequest {
  return {
    fromX: enemy.sprite.x,
    fromY: enemy.sprite.y,
    toX: enemy.combat.commitAimX,
    toY: enemy.combat.commitAimY,
    damage,
  };
}
