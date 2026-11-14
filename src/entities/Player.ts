import Phaser from "phaser";
import { PLAYER_TUNING, type AttackMode } from "../config";
import { arcHitboxHitsTarget } from "../combat/Hitbox";
import type { Damageable } from "../combat/DamageSystem";
import { applyKnockbackFrom } from "../combat/Knockback";

export type AttackPhase = "idle" | "windup" | "active" | "recovery";

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly damageable: Damageable;
  private facing = 0;
  private attackPhase: AttackPhase = "idle";
  private phaseElapsed = 0;
  private hitEnemyIds = new Set<string>();
  private attackMode: AttackMode = "melee";
  private rangedShotPending = false;

  constructor(scene: Phaser.Scene, x: number, y: number, hpMax: number) {
    this.sprite = scene.physics.add.sprite(x, y, "player");
    this.sprite.setCircle(14);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);

    this.damageable = {
      id: "player",
      hp: hpMax,
      maxHp: hpMax,
      alive: true,
      team: "player",
    };
  }

  get attackPhaseNow(): AttackPhase {
    return this.attackPhase;
  }

  get mode(): AttackMode {
    return this.attackMode;
  }

  getFacingAngle(): number {
    return this.facing;
  }

  canAttack(): boolean {
    return this.attackPhase === "idle";
  }

  setAttackMode(mode: AttackMode): void {
    this.attackMode = mode;
  }

  toggleAttackMode(): AttackMode {
    this.attackMode = this.attackMode === "melee" ? "ranged" : "melee";
    return this.attackMode;
  }

  faceToward(x: number, y: number): void {
    this.facing = Math.atan2(y - this.sprite.y, x - this.sprite.x);
  }

  setVelocityFromStick(dx: number, dy: number, speed: number): void {
    const slowed =
      this.attackPhase === "windup" || this.attackPhase === "recovery";
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (slowed) {
      this.sprite.setVelocity(0, 0);
      return;
    }
    if (dx !== 0 || dy !== 0) {
      this.facing = Math.atan2(dy, dx);
    }
    const moveScale = this.attackPhase === "active" && this.attackMode === "melee" ? 0.35 : 1;
    body.setVelocity(dx * speed * moveScale, dy * speed * moveScale);
  }

  tryStartAttack(): boolean {
    if (this.attackPhase !== "idle") return false;
    this.attackPhase = "windup";
    this.phaseElapsed = 0;
    this.hitEnemyIds.clear();
    this.rangedShotPending = false;
    return true;
  }

  consumeRangedShot(): boolean {
    if (!this.rangedShotPending) return false;
    this.rangedShotPending = false;
    return true;
  }

  updateAttack(deltaMs: number): void {
    if (this.attackPhase === "idle") return;
    this.phaseElapsed += deltaMs;

    const isRanged = this.attackMode === "ranged";
    const windup = isRanged ? PLAYER_TUNING.rangedWindupMs : PLAYER_TUNING.meleeWindupMs;
    const active = isRanged ? PLAYER_TUNING.rangedActiveMs : PLAYER_TUNING.meleeActiveMs;
    const recovery = isRanged ? PLAYER_TUNING.rangedRecoveryMs : PLAYER_TUNING.meleeRecoveryMs;

    if (this.attackPhase === "windup" && this.phaseElapsed >= windup) {
      this.attackPhase = "active";
      this.phaseElapsed = 0;
      if (isRanged) this.rangedShotPending = true;
    } else if (this.attackPhase === "active" && this.phaseElapsed >= active) {
      this.attackPhase = "recovery";
      this.phaseElapsed = 0;
    } else if (this.attackPhase === "recovery" && this.phaseElapsed >= recovery) {
      this.attackPhase = "idle";
      this.phaseElapsed = 0;
    }
  }

  damageEnemiesInArc(
    enemies: Array<{
      id: string;
      x: number;
      y: number;
      radius: number;
      damageable: Damageable;
      sprite: Phaser.Physics.Arcade.Sprite;
    }>,
    damage: number,
    knockback: number,
  ): void {
    if (this.attackMode !== "melee" || this.attackPhase !== "active") return;
    const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.meleeArcDeg / 2);
    for (const e of enemies) {
      if (!e.damageable.alive || this.hitEnemyIds.has(e.id)) continue;
      const hit = arcHitboxHitsTarget(
        this.sprite.x,
        this.sprite.y,
        this.facing,
        PLAYER_TUNING.meleeRange,
        arcHalf,
        e.x,
        e.y,
        e.radius,
      );
      if (hit) {
        this.hitEnemyIds.add(e.id);
        e.damageable.hp -= damage;
        applyKnockbackFrom(
          e.sprite,
          this.sprite.x,
          this.sprite.y,
          knockback,
        );
        if (e.damageable.hp <= 0) {
          e.damageable.alive = false;
          e.damageable.onDeath?.();
        }
      }
    }
  }
}