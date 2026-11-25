import type { EnemyInstance } from "../Enemy";
import { enemyIsAttacking, type EnemyAttackTarget } from "../EnemyCombat";
import { commitEnemyAttack } from "./attackCommit";
import {
  advanceCombatPhase,
  boltToCommittedAim,
  tickCooldownAndFaceTarget,
} from "./combatPhase";
import type { JavelineerCombatState, JavelinSpawnRequest } from "./types";

export function updateJavelineerCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: JavelineerCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnJavelin?: JavelinSpawnRequest | undefined; meleeHit: boolean } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.javelineer!;
  const dist = tickCooldownAndFaceTarget(enemy, target, deltaMs);

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
  const meleeHit = false;

  if (c.phase === "active" && !extra.shotFired && c.attackTargetKind != null) {
    extra.shotFired = true;
    if (c.attackTargetKind === "player") {
      spawnJavelin = boltToCommittedAim(enemy, tune.damage);
    } else if (c.attackTargetKind === "wall") {
      spawnJavelin = boltToCommittedAim(enemy, tune.damage);
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
