import Phaser from "phaser";
import { ENEMY_TUNING } from "../config";
import { arcHitboxHitsTarget } from "../combat/Hitbox";
import type { Damageable } from "../combat/DamageSystem";
import type { EnemyInstance } from "./Enemy";

export type EnemyAttackPhase = "idle" | "windup" | "active" | "recovery";

export type EnemyCombatState = {
  phase: EnemyAttackPhase;
  phaseMs: number;
  cooldownMs: number;
  hitThisSwing: boolean;
  /** Set when DefenseScene spawns grunt melee swipe FX for this swing. */
  slashFxShown: boolean;
  facing: number;
};

export function createEnemyCombat(): EnemyCombatState {
  return {
    phase: "idle",
    phaseMs: 0,
    cooldownMs: 0,
    hitThisSwing: false,
    slashFxShown: false,
    facing: 0,
  };
}

export type EnemyAttackTarget =
  | {
      kind: "player";
      x: number;
      y: number;
      radius: number;
      damageable: Damageable;
    }
  | {
      kind: "wall";
      x: number;
      y: number;
    };

export function updateEnemyCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  deltaMs: number,
  onWallHit?: () => void,
): boolean {
  const c = enemy.combat;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  c.facing = Math.atan2(dy, dx);

  const triggerRange =
    target.kind === "wall"
      ? ENEMY_TUNING.wallAttackTriggerRange
      : ENEMY_TUNING.attackTriggerRange;
  const inRange = dist <= triggerRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    c.hitThisSwing = false;
    c.slashFxShown = false;
  }

  if (c.phase === "idle") return false;

  c.phaseMs += deltaMs;

  if (c.phase === "windup" && c.phaseMs >= ENEMY_TUNING.attackWindupMs) {
    c.phase = "active";
    c.phaseMs = 0;
  } else if (c.phase === "active" && c.phaseMs >= ENEMY_TUNING.attackActiveMs) {
    c.phase = "recovery";
    c.phaseMs = 0;
  } else if (
    c.phase === "recovery" &&
    c.phaseMs >= ENEMY_TUNING.attackRecoveryMs
  ) {
    c.phase = "idle";
    c.phaseMs = 0;
    c.cooldownMs = ENEMY_TUNING.attackCooldownMs;
  }

  if (c.phase === "active" && !c.hitThisSwing) {
    if (target.kind === "player" && target.damageable.alive) {
      const arcHalf = Phaser.Math.DegToRad(ENEMY_TUNING.attackArcDeg / 2);
      const hit = arcHitboxHitsTarget(
        enemy.sprite.x,
        enemy.sprite.y,
        c.facing,
        ENEMY_TUNING.attackRange,
        arcHalf,
        target.x,
        target.y,
        target.radius,
      );
      if (hit) {
        c.hitThisSwing = true;
        return true;
      }
    } else if (target.kind === "wall" && dist <= ENEMY_TUNING.wallAttackRange) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  if (enemyIsAttacking(c) && (c.phase === "windup" || c.phase === "recovery")) {
    enemy.sprite.setVelocity(0, 0);
  }

  return false;
}

export function enemyIsAttacking(combat: EnemyCombatState): boolean {
  return combat.phase !== "idle";
}