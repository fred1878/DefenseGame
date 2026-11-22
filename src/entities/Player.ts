import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH, PLAYER_TUNING, type AttackMode } from "../config";
import { PLAYER_TEXTURE, SPRITE_DISPLAY, type PlayerCardinal } from "../content/assets";
import { worldDisplayPx, worldUnit } from "../core/worldPixelScale";
import { arcHitboxHitsTarget } from "../combat/Hitbox";
import type { Damageable } from "../combat/DamageSystem";
import { applyDamage } from "../combat/DamageSystem";
import { reapplySpriteHitFlashIfActive } from "../combat/HitFlash";
import { applyEnemyKnockbackFrom } from "../combat/enemyKnockback";
import type { EnemyInstance } from "./Enemy";
import { cardinalFromAngle, cardinalFromDelta } from "./playerFacing";
import {
  enemyCollisionBodyRadius,
  playerBodyRadiusPx,
  applyArcadeCircleCollider,
  tuneArcadeDynamicBody,
} from "./entityPhysics";

export type AttackPhase = "idle" | "windup" | "active" | "recovery";

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly damageable: Damageable;
  private facing = 0;
  /** Arc direction fixed when a melee swing begins (windup). */
  private meleeSwingFacingRad = 0;
  private cardinalFacing: PlayerCardinal = "s";
  private attackPhase: AttackPhase = "idle";
  private phaseElapsed = 0;
  private hitEnemyIds = new Set<string>();
  private attackMode: AttackMode = "melee";
  /** When auto-combat picks melee vs ranged for the current swing. */
  private strikeModeOverride: "melee" | "ranged" | null = null;
  private rangedShotPending = false;

  constructor(scene: Phaser.Scene, x: number, y: number, hpMax: number) {
    this.sprite = scene.physics.add.sprite(x, y, PLAYER_TEXTURE.s);
    const reg = scene.registry;
    this.sprite.setDisplaySize(
      worldDisplayPx(SPRITE_DISPLAY.player, reg),
      worldDisplayPx(SPRITE_DISPLAY.player, reg),
    );
    tuneArcadeDynamicBody(this.sprite, worldUnit(playerBodyRadiusPx(), reg), {
      pushable: false,
      worldBounds: true,
    });
    this.sprite.setDepth(DEFENSE_RENDER_DEPTH.player);

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

  /** Active attack style (melee/ranged only) for the current or next strike. */
  strikeMode(): "melee" | "ranged" {
    if (this.strikeModeOverride) return this.strikeModeOverride;
    if (this.attackMode === "auto") return "ranged";
    return this.attackMode;
  }

  getFacingAngle(): number {
    return this.facing;
  }

  /** Melee hitbox / swipe FX bearing; locked for the whole swing. */
  meleeHitboxFacingRad(): number {
    if (this.strikeMode() === "melee" && this.attackPhase !== "idle") {
      return this.meleeSwingFacingRad;
    }
    return this.facing;
  }

  canAttack(): boolean {
    return this.attackPhase === "idle";
  }

  setAttackMode(mode: AttackMode): void {
    this.attackMode = mode;
  }

  cycleAttackMode(): AttackMode {
    if (this.attackMode === "melee") this.attackMode = "ranged";
    else if (this.attackMode === "ranged") this.attackMode = "auto";
    else this.attackMode = "melee";
    return this.attackMode;
  }

  /** @deprecated use cycleAttackMode */
  toggleAttackMode(): AttackMode {
    return this.cycleAttackMode();
  }

  faceToward(x: number, y: number): void {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    this.facing = Math.atan2(dy, dx);
    const card = cardinalFromDelta(dx, dy) ?? cardinalFromAngle(this.facing);
    this.setCardinalTexture(card);
  }

  setVelocityFromStick(
    dx: number,
    dy: number,
    speed: number,
    opts?: { lockMeleeAim?: boolean },
  ): void {
    const rooted =
      this.attackMode === "ranged" &&
      (this.attackPhase === "windup" || this.attackPhase === "recovery");
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (rooted) {
      this.sprite.setVelocity(0, 0);
      return;
    }
    const lockMeleeAim =
      opts?.lockMeleeAim === true &&
      this.strikeMode() === "melee" &&
      this.attackPhase !== "idle";
    if (dx !== 0 || dy !== 0) {
      if (!lockMeleeAim) {
        this.facing = Math.atan2(dy, dx);
        const card = cardinalFromDelta(dx, dy);
        if (card) this.setCardinalTexture(card);
      }
    } else if (!lockMeleeAim) {
      this.setCardinalTexture("s");
    }
    body.setVelocity(dx * speed, dy * speed);
  }

  private setCardinalTexture(card: PlayerCardinal): void {
    if (card === this.cardinalFacing) return;
    this.cardinalFacing = card;
    const key = PLAYER_TEXTURE[card];
    if (this.sprite.texture.key !== key) {
      this.sprite.setTexture(key);
      reapplySpriteHitFlashIfActive(this.sprite);
      const reg = this.sprite.scene.registry;
      const side = worldDisplayPx(SPRITE_DISPLAY.player, reg);
      this.sprite.setDisplaySize(side, side);
      applyArcadeCircleCollider(
        this.sprite,
        worldUnit(playerBodyRadiusPx(), reg),
      );
    }
  }

  tryStartAttack(strikeMode?: "melee" | "ranged"): boolean {
    if (this.attackPhase !== "idle") return false;
    this.attackPhase = "windup";
    this.phaseElapsed = 0;
    this.hitEnemyIds.clear();
    this.rangedShotPending = false;
    this.strikeModeOverride = strikeMode ?? null;
    if (this.strikeMode() === "melee") {
      this.meleeSwingFacingRad = this.facing;
    }
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

    const isRanged = this.strikeMode() === "ranged";
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
      this.strikeModeOverride = null;
    }
  }

  damageEnemiesInArc(
    enemies: EnemyInstance[],
    damage: number,
    knockback: number,
  ): void {
    if (this.strikeMode() !== "melee" || this.attackPhase !== "active") return;
    const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.meleeArcDeg / 2);
    for (const e of enemies) {
      if (!e.damageable.alive || this.hitEnemyIds.has(e.id)) continue;
      const hit = arcHitboxHitsTarget(
        this.sprite.x,
        this.sprite.y,
        this.meleeSwingFacingRad,
        worldUnit(PLAYER_TUNING.meleeStrikeRange, this.sprite.scene.registry),
        arcHalf,
        e.sprite.x,
        e.sprite.y,
        worldUnit(enemyCollisionBodyRadius(e.defId), this.sprite.scene.registry),
      );
      if (hit) {
        this.hitEnemyIds.add(e.id);
        applyDamage(e.damageable, damage, "default");
        applyEnemyKnockbackFrom(e, this.sprite.x, this.sprite.y, knockback);
      }
    }
  }
}