import Phaser from "phaser";
import { ARROW_RAIN_TUNING, ENEMY_TUNING, JAVELINEER_TUNING } from "../config";
import type { Damageable } from "../combat/DamageSystem";
import {
  destroyArrowRainTelegraph,
  spawnArrowRainTelegraph,
  updateArrowRainTelegraph,
  type ArrowRainTelegraph,
} from "../combat/ArrowRainTelegraph";
import type { EnemyInstance } from "./Enemy";
import {
  enemyIsAttacking,
  type EnemyAttackPhase,
  type EnemyAttackTarget,
  type EnemyCombatState,
} from "./EnemyCombat";

export type ArrowRainCombatState = {
  telegraph?: ArrowRainTelegraph;
  zoneX: number;
  zoneY: number;
  tickAccumulatorMs: number;
  ticksDealt: number;
};

export type JavelineerCombatState = {
  shotFired: boolean;
};

function advanceCombatPhase(
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
  }
}

function freezeWindupRecovery(enemy: EnemyInstance, phase: EnemyAttackPhase): void {
  if (enemyIsAttacking(enemy.combat) && (phase === "windup" || phase === "recovery")) {
    enemy.sprite.setVelocity(0, 0);
  }
}

export function createArrowRainCombatState(): ArrowRainCombatState {
  return {
    zoneX: 0,
    zoneY: 0,
    tickAccumulatorMs: 0,
    ticksDealt: 0,
  };
}

export function createJavelineerCombatState(): JavelineerCombatState {
  return { shotFired: false };
}

export type JavelinSpawnRequest = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  damage: number;
};

export function updateArrowRainCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: ArrowRainCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { hitPlayer: boolean; damage: number } {
  const c = enemy.combat;
  const tune = ARROW_RAIN_TUNING;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  c.facing = Math.atan2(dy, dx);

  const triggerRange =
    target.kind === "wall"
      ? ENEMY_TUNING.wallAttackTriggerRange
      : tune.attackTriggerRange;
  const inRange = dist <= triggerRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.tickAccumulatorMs = 0;
    extra.ticksDealt = 0;
    if (target.kind === "player") {
      extra.zoneX = target.x;
      extra.zoneY = target.y;
      destroyArrowRainTelegraph(extra.telegraph);
      extra.telegraph = spawnArrowRainTelegraph(
        enemy.sprite.scene,
        extra.zoneX,
        extra.zoneY,
        tune.windupMs,
      );
    }
  }

  if (c.phase === "windup" && extra.telegraph) {
    updateArrowRainTelegraph(extra.telegraph, deltaMs, false);
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
      updateArrowRainTelegraph(extra.telegraph, deltaMs, true);
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
    } else if (target.kind === "wall" && dist <= ENEMY_TUNING.wallAttackRange) {
      onWallHit?.();
    }
  }

  if (c.phase === "idle" || c.phase === "recovery") {
    destroyArrowRainTelegraph(extra.telegraph);
    extra.telegraph = undefined;
  }

  freezeWindupRecovery(enemy, c.phase);
  return { hitPlayer, damage };
}

export function updateJavelineerCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: JavelineerCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnJavelin?: JavelinSpawnRequest; meleeHit: boolean } {
  const c = enemy.combat;
  const tune = JAVELINEER_TUNING;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  c.facing = Math.atan2(dy, dx);

  const inBand =
    target.kind === "player" &&
    dist >= tune.minRange &&
    dist <= tune.maxRange;
  const wallInRange =
    target.kind === "wall" && dist <= ENEMY_TUNING.wallAttackTriggerRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && (inBand || wallInRange)) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.shotFired = false;
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

  if (c.phase === "active" && !extra.shotFired) {
    extra.shotFired = true;
    if (target.kind === "player" && inBand) {
      spawnJavelin = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
      };
    } else if (target.kind === "wall" && dist <= ENEMY_TUNING.wallAttackRange) {
      onWallHit?.();
    } else if (target.kind === "player" && dist < tune.minRange) {
      meleeHit = true;
    }
  }

  freezeWindupRecovery(enemy, c.phase);
  return { spawnJavelin, meleeHit };
}

export function playerInsideArrowRain(
  px: number,
  py: number,
  radius: number,
  extra: ArrowRainCombatState,
): boolean {
  return (
    Phaser.Math.Distance.Between(px, py, extra.zoneX, extra.zoneY) <=
    ARROW_RAIN_TUNING.zoneRadius + radius
  );
}

export type EnemyProjectileTarget = {
  x: number;
  y: number;
  radius: number;
  damageable: Damageable;
};