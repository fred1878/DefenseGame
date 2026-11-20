import type { EnemyInstance } from "../Enemy";
import {
  enemyIsAttacking,
  updateEnemyCombat,
  type EnemyAttackTarget,
  type EnemyCombatState,
} from "../EnemyCombat";
import type { JavelinSpawnRequest, RangedHybridCombatState } from "./types";
import { updateStationaryRangedCombat } from "./stationaryRangedCombat";

export function resetHybridCombatPhase(c: EnemyCombatState): void {
  c.phase = "idle";
  c.phaseMs = 0;
  c.cooldownMs = 0;
  c.hitThisSwing = false;
}

export function updateRangedHybridCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: RangedHybridCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnBolt?: JavelinSpawnRequest; meleeHit: boolean } {
  const hybrid = enemy.combatTuning.hybrid!;
  const melee = enemy.combatTuning.melee;
  const c = enemy.combat;
  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);

  if (target.kind === "player" && melee) {
    const inMeleePattern = dist <= melee.triggerRange;
    const atPreferred =
      dist >= hybrid.preferredRange - hybrid.retreatRangeSlack;

    if (extra.mode === "melee") {
      const canAbortMelee =
        extra.meleeSwings === 0 &&
        c.phase === "idle" &&
        !enemyIsAttacking(c) &&
        dist > hybrid.closeMeleeRadius;
      if (canAbortMelee) {
        extra.mode = "ranged";
        extra.meleeSwings = 0;
        resetHybridCombatPhase(c);
        extra.shotFired = false;
      }
    } else if (extra.mode === "ranged" && inMeleePattern) {
      extra.mode = "melee";
      extra.meleeSwings = 0;
      resetHybridCombatPhase(c);
      extra.shotFired = false;
    } else if (extra.mode === "retreat" && atPreferred) {
      extra.mode = "ranged";
      extra.meleeSwings = 0;
      resetHybridCombatPhase(c);
      extra.shotFired = false;
    }
  }

  if (extra.mode === "retreat") {
    extra.prevPhase = c.phase;
    return { meleeHit: false };
  }

  if (extra.mode === "melee") {
    const hitPlayer = updateEnemyCombat(enemy, target, deltaMs, onWallHit);
    if (extra.prevPhase === "recovery" && c.phase === "idle") {
      extra.meleeSwings += 1;
      if (extra.meleeSwings >= hybrid.maxMeleeSwings) {
        extra.mode = "retreat";
      }
    }
    extra.prevPhase = c.phase;
    return { meleeHit: hitPlayer };
  }

  const bolt = updateStationaryRangedCombat(
    enemy,
    target,
    extra,
    deltaMs,
    onWallHit,
  );
  extra.prevPhase = c.phase;
  return { spawnBolt: bolt.spawnBolt, meleeHit: false };
}