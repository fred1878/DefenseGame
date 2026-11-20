import Phaser from "phaser";
import { arcHitboxHitsTarget } from "../combat/Hitbox";
import type { Damageable } from "../combat/DamageSystem";
import type { EnemyInstance } from "./Enemy";
import {
  clearEnemyAttackCommit,
  commitEnemyAttack,
  enemyAttackCommitted,
} from "./enemyRanged/attackCommit";

export type EnemyAttackPhase = "idle" | "windup" | "active" | "recovery";

export type EnemyCombatState = {
  phase: EnemyAttackPhase;
  phaseMs: number;
  cooldownMs: number;
  hitThisSwing: boolean;
  /** Set when DefenseScene spawns melee swipe FX for this swing. */
  slashFxShown: boolean;
  facing: number;
  attackTargetKind: EnemyAttackTarget["kind"] | null;
  commitAimX: number;
  commitAimY: number;
};

export function createEnemyCombat(): EnemyCombatState {
  return {
    phase: "idle",
    phaseMs: 0,
    cooldownMs: 0,
    hitThisSwing: false,
    slashFxShown: false,
    facing: 0,
    attackTargetKind: null,
    commitAimX: 0,
    commitAimY: 0,
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
  if (c.phase === "idle") {
    c.facing = Math.atan2(dy, dx);
  }

  const { wall, melee } = enemy.combatTuning;
  const triggerRange =
    target.kind === "wall" ? wall.triggerRange : melee.triggerRange;
  const inRange = dist <= triggerRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    c.hitThisSwing = false;
    c.slashFxShown = false;
    const aimX = target.kind === "player" ? target.x : target.x;
    const aimY = target.kind === "player" ? target.y : target.y;
    commitEnemyAttack(
      c,
      enemy.sprite.x,
      enemy.sprite.y,
      target,
      aimX,
      aimY,
    );
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
    clearEnemyAttackCommit(c);
  }

  if (c.phase === "active" && !c.hitThisSwing) {
    const strikeKind = c.attackTargetKind ?? target.kind;
    if (strikeKind === "player" && target.damageable.alive) {
      const arcHalf = Phaser.Math.DegToRad(melee.arcDeg / 2);
      const px = enemyAttackCommitted(c) ? c.commitAimX : target.x;
      const py = enemyAttackCommitted(c) ? c.commitAimY : target.y;
      const hit = arcHitboxHitsTarget(
        enemy.sprite.x,
        enemy.sprite.y,
        c.facing,
        melee.range,
        arcHalf,
        px,
        py,
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
  const inWallHit = target.kind === "wall" && dist <= wall.hitRange;
  const holdPosition =
    inWallTrigger &&
    (enemyIsAttacking(c) || (c.phase === "idle" && inWallHit));
  if (holdPosition) {
    enemy.sprite.setVelocity(0, 0);
  }

  return false;
}

export function enemyIsAttacking(combat: EnemyCombatState): boolean {
  return combat.phase !== "idle";
}