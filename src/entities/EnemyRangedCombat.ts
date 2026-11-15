import Phaser from "phaser";
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

function freezeWindupRecovery(
  enemy: EnemyInstance,
  phase: EnemyAttackPhase,
  targetKind: EnemyAttackTarget["kind"],
): void {
  const hold =
    enemyIsAttacking(enemy.combat) &&
    (targetKind === "wall" || phase === "windup" || phase === "recovery");
  if (hold) {
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
  c.facing = Math.atan2(dy, dx);

  const inBand =
    target.kind === "player" &&
    dist >= tune.minRange &&
    dist <= tune.maxRange;
  const wallInBand =
    target.kind === "wall" &&
    dist >= tune.minRange &&
    dist <= tune.maxRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && (inBand || wallInBand)) {
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
    } else if (target.kind === "wall" && wallInBand) {
      spawnJavelin = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
      };
      onWallHit?.();
    } else if (target.kind === "player" && dist < tune.minRange) {
      meleeHit = true;
    }
  }

  freezeWindupRecovery(enemy, c.phase, target.kind);
  return { spawnJavelin, meleeHit };
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

export type EnemyProjectileTarget = {
  x: number;
  y: number;
  radius: number;
  damageable: Damageable;
};