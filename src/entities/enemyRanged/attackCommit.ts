import type {
  EnemyAttackTarget,
  EnemyCombatState,
} from "../EnemyCombat";

export function commitEnemyAttack(
  c: EnemyCombatState,
  fromX: number,
  fromY: number,
  target: EnemyAttackTarget,
  aimX: number,
  aimY: number,
): void {
  c.attackTargetKind = target.kind;
  c.commitAimX = aimX;
  c.commitAimY = aimY;
  c.facing = Math.atan2(aimY - fromY, aimX - fromX);
}

export function clearEnemyAttackCommit(c: EnemyCombatState): void {
  c.attackTargetKind = null;
  c.commitAimX = 0;
  c.commitAimY = 0;
}

export function enemyAttackCommitted(c: EnemyCombatState): boolean {
  return c.attackTargetKind != null && c.phase !== "idle";
}