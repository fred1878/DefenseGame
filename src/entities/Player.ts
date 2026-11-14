import Phaser from "phaser";
import { PLAYER_TUNING } from "../config";
import { arcHitboxHitsTarget } from "../combat/Hitbox";
import type { Damageable } from "../combat/DamageSystem";

export type AttackPhase = "idle" | "windup" | "active" | "recovery";

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly damageable: Damageable;
  private facing = 0;
  private attackPhase: AttackPhase = "idle";
  private phaseElapsed = 0;
  private hitEnemyIds = new Set<string>();

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

  getFacingAngle(): number {
    return this.facing;
  }

  setVelocityFromStick(dx: number, dy: number, speed: number): void {
    if (this.attackPhase === "windup" || this.attackPhase === "recovery") {
      this.sprite.setVelocity(0, 0);
      return;
    }
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (dx !== 0 || dy !== 0) {
      this.facing = Math.atan2(dy, dx);
    }
    body.setVelocity(dx * speed, dy * speed);
  }

  tryStartAttack(): void {
    if (this.attackPhase !== "idle") return;
    this.attackPhase = "windup";
    this.phaseElapsed = 0;
    this.hitEnemyIds.clear();
  }

  updateAttack(deltaMs: number): void {
    if (this.attackPhase === "idle") return;
    this.phaseElapsed += deltaMs;
    const { attackWindupMs, attackActiveMs, attackRecoveryMs } = PLAYER_TUNING;

    if (this.attackPhase === "windup" && this.phaseElapsed >= attackWindupMs) {
      this.attackPhase = "active";
      this.phaseElapsed = 0;
    } else if (
      this.attackPhase === "active" &&
      this.phaseElapsed >= attackActiveMs
    ) {
      this.attackPhase = "recovery";
      this.phaseElapsed = 0;
    } else if (
      this.attackPhase === "recovery" &&
      this.phaseElapsed >= attackRecoveryMs
    ) {
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
    }>,
    damage: number,
  ): void {
    if (this.attackPhase !== "active") return;
    const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.attackArcDeg / 2);
    for (const e of enemies) {
      if (!e.damageable.alive || this.hitEnemyIds.has(e.id)) continue;
      const hit = arcHitboxHitsTarget(
        this.sprite.x,
        this.sprite.y,
        this.facing,
        PLAYER_TUNING.attackRange,
        arcHalf,
        e.x,
        e.y,
        e.radius,
      );
      if (hit) {
        this.hitEnemyIds.add(e.id);
        e.damageable.hp -= damage;
        if (e.damageable.hp <= 0) {
          e.damageable.alive = false;
          e.damageable.onDeath?.();
        }
      }
    }
  }
}