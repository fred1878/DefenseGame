import type { EnemyInstance } from "../Enemy";
import { enemyIsAttacking, type EnemyAttackTarget } from "../EnemyCombat";
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
  c.facing = Math.atan2(dy, dx);

  const minVolley = Math.max(0, tune.preferredRange - 22);
  const inRange =
    dist <= tune.attackTriggerRange && dist >= minVolley;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.shotFired = false;
    c.hitThisSwing = false;
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

  if (c.phase === "active" && !extra.shotFired) {
    extra.shotFired = true;
    if (target.kind === "player" && inRange) {
      spawnBolt = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
      };
    } else if (target.kind === "wall" && inRange) {
      spawnBolt = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
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

  return { spawnBolt };
}