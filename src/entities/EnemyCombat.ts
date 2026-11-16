import Phaser from "phaser";
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

  const { wall, melee } = enemy.combatTuning;
  const triggerRange =
    target.kind === "wall" ? wall.triggerRange : melee.triggerRange;
  const inRange = dist <= triggerRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    c.hitThisSwing = false;
    c.slashFxShown = false;
  }

  if (c.phase === "idle") return false;

  c.phaseMs += deltaMs;

  if (c.phase === "windup" && c.phaseMs >= melee.windupMs) {
    c.phase = "active";
    c.phaseMs = 0;
  } else if (c.phase === "active" && c.phaseMs >= melee.activeMs) {
    c.phase = "recovery";
    c.phaseMs = 0;
  } else if (c.phase === "recovery" && c.phaseMs >= melee.recoveryMs) {
    c.phase = "idle";
    c.phaseMs = 0;
    c.cooldownMs = melee.cooldownMs;
  }

  if (c.phase === "active" && !c.hitThisSwing) {
    if (target.kind === "player" && target.damageable.alive) {
      const arcHalf = Phaser.Math.DegToRad(melee.arcDeg / 2);
      const hit = arcHitboxHitsTarget(
        enemy.sprite.x,
        enemy.sprite.y,
        c.facing,
        melee.range,
        arcHalf,
        target.x,
        target.y,
        target.radius,
      );
      if (hit) {
        c.hitThisSwing = true;
        return true;
      }
    } else if (target.kind === "wall" && dist <= wall.hitRange) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  const inWallTrigger =
    target.kind === "wall" && dist <= wall.triggerRange;
  const holdPosition =
    inWallTrigger &&
    (enemyIsAttacking(c) || c.phase === "idle");
  if (holdPosition) {
    enemy.sprite.setVelocity(0, 0);
  }

  return false;
}

export function enemyIsAttacking(combat: EnemyCombatState): boolean {
  return combat.phase !== "idle";
}