import { playerTuning } from "../../config/player";
import { gearRangedProjectile } from "../../gear/gearRuntime";
import Phaser from "phaser";
import { DEFENSE_RENDER_DEPTH } from "../../config";
import { MELEE_HIT_FLAVOR } from "../../combat/rules/DamageSystem";
import { showPlayerMeleeSwipe } from "../../combat/fx/MeleeSwipeFx";
import type { SpellCastController } from "../../combat/rules/SpellCastController";
import type { SpellInputQueue } from "../../combat/rules/spellInputQueue";
import { playPlayerMeleeSlashSfx } from "../../audio/playerMeleeSlashSfx";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import type { EnemyInstance } from "../../entities/Enemy";
import type { AttackPhase, Player } from "../../entities/Player";
import {
  spawnPlayerProjectile,
  type PlayerProjectile,
} from "../../entities/Projectile";
import type { DefenseTargeting } from "./DefenseTargeting";

/** Live scene state the player-combat helpers read (getters keep values current). */
export type DefensePlayerCombatHost = {
  scene: Phaser.Scene;
  readonly player: Player;
  readonly enemies: EnemyInstance[];
  readonly projectiles: PlayerProjectile[];
  readonly targeting: DefenseTargeting;
  readonly spellCaster: SpellCastController;
  readonly spellInputQueue: SpellInputQueue;
  readonly autoAttackEnabled: boolean;
  wu: (atDefault2x: number) => number;
  nextPlayerProjectileId: () => string;
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
};

export type SpellBlastFxDef = {
  blastTextureKey?: string | undefined;
  durationMs?: number;
  startAlpha?: number;
  scaleEnd?: number;
};

/** Player melee/ranged attacks, auto-attack, swipe FX and spell blast flashes. */
export class DefensePlayerCombat {
  private prevPlayerAttackPhase: AttackPhase = "idle";
  private playerMeleeFxScheduled = false;
  private playerMeleeFxTimer?: Phaser.Time.TimerEvent | undefined;

  constructor(private readonly host: DefensePlayerCombatHost) {}

  resetForNewRun(): void {
    this.cancelPlayerMeleeFxTimer();
    this.prevPlayerAttackPhase = "idle";
    this.playerMeleeFxScheduled = false;
  }

  private cancelPlayerMeleeFxTimer(): void {
    this.playerMeleeFxTimer?.remove(false);
    this.playerMeleeFxTimer = undefined;
  }

  flashNova(x: number, y: number, radius: number, def?: SpellBlastFxDef): void {
    const scene = this.host.scene;
    const key = def?.blastTextureKey;
    if (!key || !scene.textures.exists(key)) {
      console.warn(
        `spell blast missing MobileRPG texture${key ? `: ${key}` : ""}`,
      );
      return;
    }
    const durationMs = def?.durationMs ?? 320;
    const startAlpha = def?.startAlpha ?? 0.9;
    const scaleEnd = def?.scaleEnd ?? 1.25;
    const sprite = scene.add
      .image(x, y, key)
      .setDepth(DEFENSE_RENDER_DEPTH.playerCombatFx)
      .setAlpha(startAlpha)
      .setBlendMode(Phaser.BlendModes.ADD);
    const size = radius * 2.2;
    sprite.setDisplaySize(size, size);
    this.host.registerWorldDraw(sprite);
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: scaleEnd,
      duration: durationMs,
      ease: "Quad.easeOut",
      onComplete: () => sprite.destroy(),
    });
  }

  manualAttack(): void {
    const { player } = this.host;
    if (this.host.spellCaster.isChanneling() || !player.canAttack()) {
      this.host.spellInputQueue.enqueueManualAttack();
      return;
    }
    const strike =
      player.mode === "auto"
        ? this.resolveStrikeMode(true)
        : player.mode === "ranged"
          ? "ranged"
          : "melee";
    const target = this.host.targeting.facingTarget(strike, true);
    if (target) player.faceToward(target.x, target.y);
    player.tryStartAttack(player.mode === "auto" ? strike : undefined);
  }

  /** Keep melee arc aimed at the auto target while the player can still move. */
  shouldLockMeleeAimFacing(): boolean {
    const { player } = this.host;
    if (player.attackPhaseNow === "idle") return false;
    if (player.strikeMode() !== "melee") return false;
    return this.host.autoAttackEnabled || player.mode === "auto";
  }

  tryAutoAttack(): void {
    const { player } = this.host;
    if (this.host.spellCaster.isChanneling()) return;
    const autoCombat = player.mode === "auto";
    if (!this.host.autoAttackEnabled && !autoCombat) return;
    if (!player.canAttack()) return;
    const strike = this.resolveStrikeMode(autoCombat);
    const target = this.host.targeting.facingTarget(strike, false);
    if (!target) return;
    player.faceToward(target.x, target.y);
    player.tryStartAttack(autoCombat ? strike : undefined);
  }

  resolveStrikeMode(autoCombat: boolean): "melee" | "ranged" {
    const { player } = this.host;
    if (!autoCombat) {
      return player.mode === "ranged" ? "ranged" : "melee";
    }
    const px = player.sprite.x;
    const py = player.sprite.y;
    let bestMelee: number | null = null;
    for (const e of this.host.enemies) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
      if (d > this.host.wu(playerTuning().autoAttackMeleeRange)) continue;
      if (bestMelee === null || d < bestMelee) bestMelee = d;
    }
    return bestMelee !== null ? "melee" : "ranged";
  }

  syncMeleeSwipeFx(): void {
    const { player } = this.host;
    const phase = player.attackPhaseNow;
    const melee = player.strikeMode() === "melee";

    if (phase === "idle") {
      this.cancelPlayerMeleeFxTimer();
      this.playerMeleeFxScheduled = false;
    } else if (
      melee &&
      phase === "windup" &&
      this.prevPlayerAttackPhase !== "windup" &&
      !this.playerMeleeFxScheduled
    ) {
      this.playerMeleeFxScheduled = true;
      this.cancelPlayerMeleeFxTimer();
      const scene = this.host.scene;
      this.playerMeleeFxTimer = scene.time.delayedCall(
        playerTuning().meleeFxStartMs,
        () => {
          this.playerMeleeFxTimer = undefined;
          if (
            player.attackPhaseNow === "idle" ||
            player.strikeMode() !== "melee"
          ) {
            return;
          }
          showPlayerMeleeSwipe(
            scene,
            player.sprite.x,
            player.sprite.y,
            player.meleeHitboxFacingRad(),
            playerTuning().meleeFxDurationMs,
            playerTuning().meleeActiveMs,
            this.host.registerWorldDraw,
          );
          playPlayerMeleeSlashSfx(scene);
        },
      );
    }
    this.prevPlayerAttackPhase = phase;
  }

  fireProjectile(damage: number): void {
    const { player } = this.host;
    const angle = player.getFacingAngle();
    const id = this.host.nextPlayerProjectileId();
    const shot = gearRangedProjectile();
    const p = spawnPlayerProjectile(
      this.host.scene,
      player.sprite.x,
      player.sprite.y,
      angle,
      playerTuning().projectileSpeedWu,
      damage,
      this.host.wu(playerTuning().rangedMaxRangeWu),
      id,
      shot?.textureKey ?? COMBAT_FX_TEXTURE.stoneThrow,
      MELEE_HIT_FLAVOR,
    );
    if (shot?.tint !== undefined) p.sprite.setTint(shot.tint);
    this.host.registerWorldDraw(p.sprite);
    this.host.projectiles.push(p);
  }
}
