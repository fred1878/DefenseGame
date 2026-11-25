import Phaser from "phaser";
import { jitterTelegraphCenter } from "../../combat/aoeTelegraphJitter";
import {
  destroyArrowRainTelegraph,
  spawnArrowRainTelegraph,
  updateArrowRainTelegraph,
} from "../../combat/ArrowRainTelegraph";
import { worldUnit } from "../../core/worldPixelScale";
import type { EnemyInstance } from "../Enemy";
import { enemyIsAttacking, type EnemyAttackTarget } from "../EnemyCombat";
import { commitEnemyAttack } from "./attackCommit";
import { advanceCombatPhase, freezeWindupRecovery } from "./combatPhase";
import type { ArrowRainCombatState } from "./types";

export function updateArrowRainCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: ArrowRainCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { hitPlayer: boolean; damage: number } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.arrowRain!;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  if (c.phase === "idle") {
    c.facing = Math.atan2(dy, dx);
  }

  const minVolleyRange = tune.preferredRangeWu - tune.kiteBandSlackWu;
  const inRange = dist <= tune.attackTriggerRangeWu && dist >= minVolleyRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    c.hitThisSwing = false;
    extra.tickAccumulatorMs = 0;
    extra.ticksDealt = 0;
    if (target.kind === "player" || target.kind === "wall") {
      const jittered = jitterTelegraphCenter(target.x, target.y);
      extra.zoneX = jittered.x;
      extra.zoneY = jittered.y;
      commitEnemyAttack(
        c,
        enemy.sprite.x,
        enemy.sprite.y,
        target,
        extra.zoneX,
        extra.zoneY,
      );
      destroyArrowRainTelegraph(extra.telegraph);
      const zonePx = worldUnit(tune.zoneRadiusWu, enemy.sprite.scene.registry);
      extra.telegraph = spawnArrowRainTelegraph(
        enemy.sprite.scene,
        extra.zoneX,
        extra.zoneY,
        tune.windupMs,
        zonePx,
      );
    }
  }

  const zonePx = worldUnit(tune.zoneRadiusWu, enemy.sprite.scene.registry);

  if (c.phase === "windup" && extra.telegraph) {
    updateArrowRainTelegraph(extra.telegraph, deltaMs, false, zonePx);
  }

  advanceCombatPhase(
    c,
    tune.windupMs,
    tune.activeMs,
    tune.recoveryMs,
    tune.cooldownMs,
    deltaMs,
  );

  let hitPlayer = false;
  let damage = 0;

  if (c.phase === "active") {
    if (extra.telegraph) {
      updateArrowRainTelegraph(extra.telegraph, deltaMs, true, zonePx);
    }
    if (
      c.attackTargetKind === "player" &&
      target.kind === "player" &&
      target.damageable.alive
    ) {
      extra.tickAccumulatorMs += deltaMs;
      while (
        extra.tickAccumulatorMs >= tune.tickIntervalMs &&
        extra.ticksDealt < tune.maxTicks
      ) {
        extra.tickAccumulatorMs -= tune.tickIntervalMs;
        extra.ticksDealt += 1;
        const inZone =
          Phaser.Math.Distance.Between(
            target.x,
            target.y,
            extra.zoneX,
            extra.zoneY,
          ) <=
          zonePx + target.radius;
        if (inZone) {
          hitPlayer = true;
          damage += tune.damage * tune.tickDamageScale;
        }
      }
    } else if (c.attackTargetKind === "wall" && !c.hitThisSwing) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  if (c.phase === "idle" || c.phase === "recovery") {
    destroyArrowRainTelegraph(extra.telegraph);
    extra.telegraph = undefined;
  }

  if (enemyIsAttacking(c)) {
    enemy.sprite.setVelocity(0, 0);
  }
  freezeWindupRecovery(enemy, c.phase, target.kind);
  return { hitPlayer, damage };
}
