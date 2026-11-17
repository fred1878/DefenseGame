import Phaser from "phaser";
import {
  destroyArrowRainTelegraph,
  spawnArrowRainTelegraph,
  updateArrowRainTelegraph,
} from "../../combat/ArrowRainTelegraph";
import type { EnemyInstance } from "../Enemy";
import type { EnemyAttackTarget } from "../EnemyCombat";
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
  c.facing = Math.atan2(dy, dx);

  const minVolleyRange = tune.preferredRange - 24;
  const inRange =
    dist <= tune.attackTriggerRange &&
    dist >= minVolleyRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    c.hitThisSwing = false;
    extra.tickAccumulatorMs = 0;
    extra.ticksDealt = 0;
    if (target.kind === "player" || target.kind === "wall") {
      extra.zoneX = target.x;
      extra.zoneY = target.y;
      destroyArrowRainTelegraph(extra.telegraph);
      extra.telegraph = spawnArrowRainTelegraph(
        enemy.sprite.scene,
        extra.zoneX,
        extra.zoneY,
        tune.windupMs,
        tune.zoneRadius,
      );
    }
  }

  if (c.phase === "windup" && extra.telegraph) {
    updateArrowRainTelegraph(extra.telegraph, deltaMs, false, tune.zoneRadius);
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
      updateArrowRainTelegraph(extra.telegraph, deltaMs, true, tune.zoneRadius);
    }
    if (target.kind === "player" && target.damageable.alive) {
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
          ) <= tune.zoneRadius + target.radius;
        if (inZone) {
          hitPlayer = true;
          damage += enemy.damage * tune.tickDamageScale;
        }
      }
    } else if (
      target.kind === "wall" &&
      dist <= tune.attackTriggerRange
    ) {
      if (!c.hitThisSwing) {
        c.hitThisSwing = true;
        onWallHit?.();
      }
    }
  }

  if (c.phase === "idle" || c.phase === "recovery") {
    destroyArrowRainTelegraph(extra.telegraph);
    extra.telegraph = undefined;
  }

  freezeWindupRecovery(enemy, c.phase, target.kind);
  return { hitPlayer, damage };
}

export function playerInsideArrowRain(
  px: number,
  py: number,
  radius: number,
  zoneRadius: number,
  extra: ArrowRainCombatState,
): boolean {
  return (
    Phaser.Math.Distance.Between(px, py, extra.zoneX, extra.zoneY) <=
    zoneRadius + radius
  );
}