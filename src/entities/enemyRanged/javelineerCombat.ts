import type { EnemyInstance } from "../Enemy";
import { enemyIsAttacking, type EnemyAttackTarget } from "../EnemyCombat";
import { commitEnemyAttack } from "./attackCommit";
import { advanceCombatPhase } from "./combatPhase";
import type { JavelineerCombatState, JavelinSpawnRequest } from "./types";

export function updateJavelineerCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: JavelineerCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnJavelin?: JavelinSpawnRequest; meleeHit: boolean } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.javelineer!;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  if (c.phase === "idle") {
    c.facing = Math.atan2(dy, dx);
  }

  const inBand =
    target.kind === "player" &&
    dist >= tune.minRangeWu &&
    dist <= tune.maxRangeWu;
  const wallInBand =
    target.kind === "wall" &&
    dist >= tune.minRangeWu &&
    dist <= tune.maxRangeWu;

  if (c.phase === "idle" && c.cooldownMs <= 0 && (inBand || wallInBand)) {
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

  let spawnJavelin: JavelinSpawnRequest | undefined;
  let meleeHit = false;

  if (c.phase === "active" && !extra.shotFired && c.attackTargetKind != null) {
    extra.shotFired = true;
    if (c.attackTargetKind === "player") {
      spawnJavelin = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: c.commitAimX,
        toY: c.commitAimY,
        damage: tune.damage,
      };
    } else if (c.attackTargetKind === "wall") {
      spawnJavelin = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: c.commitAimX,
        toY: c.commitAimY,
        damage: tune.damage,
      };
      if (!c.hitThisSwing) {
        c.hitThisSwing = true;
        onWallHit?.();
      }
    }
  }

  if (enemyIsAttacking(c)) {
    enemy.sprite.setVelocity(0, 0);
  }

  return { spawnJavelin, meleeHit };
}