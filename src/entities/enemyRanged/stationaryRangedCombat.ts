import type { EnemyInstance } from "../Enemy";
import type { EnemyAttackTarget } from "../EnemyCombat";
import { commitEnemyAttack } from "./attackCommit";
import {
  advanceCombatPhase,
  boltToCommittedAim,
  tickCooldownAndFaceTarget,
} from "./combatPhase";
import type { JavelinSpawnRequest, StationaryRangedCombatState } from "./types";

export function updateStationaryRangedCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: StationaryRangedCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnBolt?: JavelinSpawnRequest | undefined } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.stationaryRanged!;
  const dist = tickCooldownAndFaceTarget(enemy, target, deltaMs);

  const minVolley = Math.max(0, tune.preferredRangeWu - tune.kiteBandSlackWu);
  const inRange = dist <= tune.attackTriggerRangeWu && dist >= minVolley;

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
    spawnBolt = boltToCommittedAim(enemy, tune.damage);
    if (c.attackTargetKind === "wall" && !c.hitThisSwing) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  return { spawnBolt };
}
