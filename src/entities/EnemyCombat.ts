import Phaser from "phaser";
import { setEnemyChaseVelocity } from "../combat/enemyKnockback";
import { arcHitboxHitsTarget } from "../combat/Hitbox";
import { worldUnit } from "../core/worldPixelScale";
import type { Damageable } from "../combat/DamageSystem";
import type { EnemyInstance } from "./Enemy";
import { RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS } from "../core/enemyTuning";
import {
  clearEnemyAttackCommit,
  commitEnemyAttack,
  enemyAttackCommitted,
} from "./enemyRanged/attackCommit";

export type EnemyAttackPhase = "idle" | "windup" | "active" | "recovery";

/** Behaviors that use `combat.melee.triggerRangeWu` vs the player for melee windup. */
export function enemyUsesMeleePlayerActivationRange(behavior: string): boolean {
  return !RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS.has(behavior);
}

/**
 * Hitbox debug arcs — ranged kits reuse `combat.phase` for windup/active/recovery but
 * only arc behaviors deal melee damage on `active` (see `DefenseEnemyTick` slash FX).
 */
export function enemyShouldDrawMeleeArcOverlay(enemy: EnemyInstance): boolean {
  if (enemy.combat.phase !== "active") return false;
  if (RANGED_ONLY_MELEE_ACTIVATION_BEHAVIORS.has(enemy.behavior)) {
    return false;
  }
  if (enemy.behavior === "rangedHybrid") {
    return enemy.rangedHybrid?.mode === "melee";
  }
  if (enemy.behavior === "charger") {
    const extra = enemy.behaviorExtra;
    return extra.chargeActiveMs <= 0 && extra.chargeWindupMs <= 0;
  }
  return true;
}

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
  if (
    c.phase === "idle" &&
    !(enemy.behavior === "ward" && enemy.behaviorExtra.wardPostHolding)
  ) {
    c.facing = Math.atan2(dy, dx);
  }

  const { wall, melee } = enemy.combatTuning;
  if (!melee) {
    throw new Error(
      `updateEnemyCombat requires combat.melee for behavior ${enemy.behavior}`,
    );
  }
  const reg = enemy.sprite.scene.registry;
  const triggerRangeWu =
    target.kind === "wall" ? wall.triggerRangeWu : melee.triggerRangeWu;
  const triggerRangePx = worldUnit(triggerRangeWu, reg);
  const inRange = dist <= triggerRangePx;

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
    if (
      strikeKind === "player" &&
      target.kind === "player" &&
      target.damageable.alive
    ) {
      const arcHalf = Phaser.Math.DegToRad(melee.arcDeg / 2);
      const px = enemyAttackCommitted(c) ? c.commitAimX : target.x;
      const py = enemyAttackCommitted(c) ? c.commitAimY : target.y;
      const hit = arcHitboxHitsTarget(
        enemy.sprite.x,
        enemy.sprite.y,
        c.facing,
        worldUnit(melee.rangeWu, reg),
        arcHalf,
        px,
        py,
        target.radius,
      );
      if (hit) {
        c.hitThisSwing = true;
        return true;
      }
    } else if (
      target.kind === "wall" &&
      dist <= worldUnit(wall.hitRangeWu, reg)
    ) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  const hitRangePx = worldUnit(wall.hitRangeWu, reg);
  const inWallTrigger = target.kind === "wall" && dist <= triggerRangePx;
  const inWallHit = target.kind === "wall" && dist <= hitRangePx;
  const holdPosition =
    inWallTrigger &&
    (enemyIsAttacking(c) || (c.phase === "idle" && inWallHit));
  if (holdPosition) {
    setEnemyChaseVelocity(enemy, 0, 0);
  }

  return false;
}

export function enemyIsAttacking(combat: EnemyCombatState): boolean {
  return combat.phase !== "idle";
}