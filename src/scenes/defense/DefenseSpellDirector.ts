import { gearSpellDamageMult } from "../../gear/gearRuntime";
import type Phaser from "phaser";
import { toggleAutoCastSpellId } from "../../content/spellBarAutoCast";
import { spellGroundTapAutoCasts } from "../../content/spellGroundTapCast";
import { spellById, type SpellDefinition } from "../../content/spells";
import type { SaveGame } from "../../core/save/saveTypes";
import { persistSave } from "../../core/save/GameState";
import { pickAutoCastSpell } from "../../combat/rules/spellAutoCast";
import {
  isStickMoving,
  type SpellInputQueue,
} from "../../combat/rules/spellInputQueue";
import type {
  SpellCastController,
  SpellCastInputMode,
} from "../../combat/rules/SpellCastController";
import type { EnemySpellStatusMap } from "../../combat/rules/enemySpellStatus";
import type { SpellBlizzardChannelFx } from "../../combat/fx/SpellBlizzardChannelFx";
import type { SpellHealChannelFx } from "../../combat/fx/SpellHealChannelFx";
import type { SpellIceCastWindupFx } from "../../combat/fx/SpellIceCastWindupFx";
import type { EnemyIceRootFxController } from "../../combat/fx/EnemyIceRootFx";
import type { EnemyIceStunFxController } from "../../combat/fx/EnemyIceStunFx";
import {
  spellNeedsGroundAoeTelegraph,
  type SpellGroundAoeTelegraph,
} from "../../combat/fx/SpellGroundAoeTelegraph";
import type { SpellGroundZone } from "../../combat/rules/spellGroundZone";
import {
  spellAutoCastRequiresCombatTarget,
  spellCastUsesEnemyAim,
  spellRequiresManualTarget,
  spellTargetMode,
  spellUsesManualGroundAim,
} from "../../content/spellTargeting";
import type { DefenseObstacleRect } from "../../config/defense";
import type { EnemyInstance } from "../../entities/Enemy";
import type { PlayerProjectile } from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import type { SpellBar } from "../../ui/hud/SpellBar";
import type { CastBar } from "../../ui/hud/CastBar";
import { GroundTargetReticle } from "../../ui/hud/GroundTargetReticle";
import type { DefenseTargeting } from "./DefenseTargeting";
import {
  defenseAutoCastCombatTarget,
  defenseAutoCastGroundTarget,
} from "./DefenseSpellAutoCastTargets";
import {
  DefenseSpellChannelTicks,
  resumeDefenseMovementFromStick,
  spawnDefensePostChannelLinger,
  startDefenseChanneledGroundZone,
  updateDefenseSpellChanneling,
} from "./DefenseSpellChannel";
import {
  clearDefenseGroundCastTelegraphs,
  clearDefenseLingerAoeTelegraph,
  pulseDefenseImpactAoeTelegraph,
  syncDefenseGroundCastTelegraphs,
} from "./DefenseSpellTelegraphs";
import {
  blinkAimRad,
  blinkObstacleAABBs,
  castDefenseBlink,
  resolveDefenseSpellEffect,
  spawnDefenseIceWall,
  tickDefenseIceWalls,
} from "./DefenseSpellResolve";

export type DefenseSpellDirectorHost = {
  scene: Phaser.Scene;
  save: SaveGame;
  player: Player;
  enemies: EnemyInstance[];
  projectiles: PlayerProjectile[];
  targeting: DefenseTargeting;
  spellCaster: SpellCastController;
  spellInputQueue: SpellInputQueue;
  enemySpellStatus: EnemySpellStatusMap;
  spellBar: SpellBar;
  castBar: CastBar;
  groundReticle: GroundTargetReticle;
  obstacleGroup: Phaser.Physics.Arcade.StaticGroup;
  obstacleBlockers: DefenseObstacleRect[];
  spellChannelArea: { x: number; y: number } | null;
  spellGroundZones: SpellGroundZone[];
  pendingGroundCast: string | null;
  groundAim: { x: number; y: number } | null;
  groundAoeTelegraph: SpellGroundAoeTelegraph | null;
  lingerAoeTelegraph: SpellGroundAoeTelegraph | null;
  blizzardChannelFx: SpellBlizzardChannelFx | null;
  healChannelFx: SpellHealChannelFx | null;
  iceCastWindupFx: SpellIceCastWindupFx | null;
  enemyIceRootFx: EnemyIceRootFxController;
  enemyIceStunFx: EnemyIceStunFxController;
  channelAreaStarted: boolean;
  shadowformEndsAt: number;
  iceWallExpires: Array<{
    sprite: Phaser.Physics.Arcade.Image;
    expiresAt: number;
  }>;
  wu: (n: number) => number;
  enemyTargets: () => import("../../combat/rules/SpellEffects").SpellEnemyTarget[];
  resolveStrikeMode: (auto: boolean) => "melee" | "ranged";
  flashNova: (
    x: number,
    y: number,
    radius: number,
    def?: {
      blastTextureKey?: string | undefined;
      durationMs?: number;
      startAlpha?: number;
      scaleEnd?: number;
    },
  ) => void;
  nextProjectileId: () => string;
  filterDeadEnemies: () => void;
  timeNow: () => number;
  delayedCall: (ms: number, fn: () => void) => void;
  maskWorldObject?: (go: Phaser.GameObjects.GameObject) => void;
};

export class DefenseSpellDirector {
  readonly channelTicks: DefenseSpellChannelTicks;

  constructor(private readonly host: DefenseSpellDirectorHost) {
    this.channelTicks = new DefenseSpellChannelTicks(host, (def) =>
      this.spellDamageMult(def),
    );
  }

  updateChanneling(
    delta: number,
    dir: { x: number; y: number },
    shouldLockMeleeAimFacing: () => boolean,
  ): void {
    updateDefenseSpellChanneling(
      this.host,
      this,
      delta,
      dir,
      shouldLockMeleeAimFacing,
    );
  }

  /** @internal Re-apply stick movement after a cast ends (tests call this directly). */
  resumeMovementFromStick(
    dir: { x: number; y: number },
    shouldLockMeleeAimFacing: () => boolean,
  ): void {
    resumeDefenseMovementFromStick(this.host, dir, shouldLockMeleeAimFacing);
  }

  onSpellAutoCastToggle(slotIndex: number): void {
    const id = this.host.save.spellBar.slots[slotIndex] ?? "";
    if (!id) return;
    this.host.save.spellBar.autoCastSpellIds = toggleAutoCastSpellId(
      this.host.save.spellBar.autoCastSpellIds,
      id,
    );
    this.host.spellBar.refreshAutoCastBorders(
      this.host.save.spellBar.slots,
      this.host.save.spellBar.autoCastSpellIds,
    );
    persistSave(this.host.save);
  }

  tryAutoCastSpells(stickX: number, stickY: number): void {
    if (this.host.spellInputQueue.peek()) return;
    const moving = isStickMoving(stickX, stickY);
    const pick = pickAutoCastSpell(
      this.host.save.spellBar.slots,
      this.host.save.spellBar.autoCastSpellIds,
      moving,
      (id) => this.host.spellCaster.getCooldownRemaining(id),
      this.host.spellCaster.isChanneling(),
    );
    if (!pick) return;
    const def = spellById(pick.spellId);
    if (!def) return;
    if (spellAutoCastRequiresCombatTarget(def)) {
      const target = defenseAutoCastCombatTarget(this.host, def);
      if (!target) return;
      if (spellTargetMode(def) === "ground") {
        this.host.groundAim = defenseAutoCastGroundTarget(this.host, def);
      } else {
        this.host.targeting.setFocusEnemy(target.id);
        this.host.player.faceToward(target.x, target.y);
      }
    }
    this.beginSpellCast(pick.spellId, "auto", stickX, stickY);
  }

  /**
   * Arm a ground-aimed spell for press-drag placement without casting.
   * Short taps still go through {@link onSpellCastRequest} to auto-aim.
   */
  armGroundCast(spellId: string): void {
    const def = spellById(spellId);
    if (!def || !spellUsesManualGroundAim(def)) return;
    this.host.pendingGroundCast = spellId;
    const aim = defenseAutoCastGroundTarget(this.host, def);
    this.host.groundAim = aim;
    this.host.groundReticle.showAt(
      aim.x,
      aim.y,
      GroundTargetReticle.radiusForSpell(this.host.scene, def.blastRadiusWu!),
      GroundTargetReticle.styleForSpellId(spellId),
    );
  }

  onSpellCastRequest(spellId: string, stickX = 0, stickY = 0): void {
    const def = spellById(spellId);
    if (!def) return;
    if (!this.prepareManualCastTargeting(def)) return;
    if (!this.host.player.canAttack() || this.host.spellCaster.isChanneling()) {
      this.host.spellInputQueue.enqueue(spellId);
      return;
    }
    if (
      spellRequiresManualTarget(def) &&
      spellTargetMode(def) === "ground" &&
      !this.host.pendingGroundCast &&
      !spellGroundTapAutoCasts(def.id)
    ) {
      this.host.pendingGroundCast = spellId;
      const aim = defenseAutoCastGroundTarget(this.host, def);
      this.host.groundAim = aim;
      this.host.groundReticle.showAt(
        aim.x,
        aim.y,
        GroundTargetReticle.radiusForSpell(this.host.scene, def.blastRadiusWu!),
        GroundTargetReticle.styleForSpellId(spellId),
      );
      return;
    }
    this.beginSpellCast(spellId, "manual", stickX, stickY);
  }

  tryFlushQueuedSpellCast(stickX: number, stickY: number): void {
    if (!this.host.player.canAttack()) return;
    if (this.host.spellCaster.isChanneling()) return;
    const queued = this.host.spellInputQueue.consumeIfReady(
      stickX,
      stickY,
      spellById,
    );
    if (!queued) return;
    if (queued.kind === "manual_attack") {
      this.flushQueuedManualAttack();
      return;
    }
    const spellId = queued.spellId;
    const def = spellById(spellId);
    if (!def) return;
    if (!this.prepareManualCastTargeting(def)) return;
    if (spellTargetMode(def) === "ground") {
      this.host.groundAim = defenseAutoCastGroundTarget(this.host, def);
    }
    this.beginSpellCast(spellId, "manual", stickX, stickY);
  }

  /**
   * Auto-acquire nearest valid target when the player has not picked one manually.
   * Returns false when no valid target exists for spells that need one.
   */
  prepareManualCastTargeting(def: SpellDefinition): boolean {
    const mode = spellTargetMode(def);
    const target = defenseAutoCastCombatTarget(this.host, def);

    if (def.requireEnemyTarget === true && mode === "enemy") {
      if (!this.host.targeting.focusEnemyId && !target) return false;
      if (!this.host.targeting.focusEnemyId && target) {
        this.host.targeting.setFocusEnemy(target.id);
        this.host.player.faceToward(target.x, target.y);
      }
      return true;
    }

    if (spellGroundTapAutoCasts(def.id) && mode === "ground") {
      if (!target) return false;
      this.host.groundAim = defenseAutoCastGroundTarget(this.host, def);
      return true;
    }

    if (target && mode === "enemy" && !this.host.targeting.focusEnemyId) {
      this.host.targeting.setFocusEnemy(target.id);
      this.host.player.faceToward(target.x, target.y);
    }
    if (target && mode === "ground" && !this.host.groundAim) {
      this.host.groundAim = defenseAutoCastGroundTarget(this.host, def);
    }
    return true;
  }

  private flushQueuedManualAttack(): void {
    const player = this.host.player;
    const strike =
      player.mode === "auto"
        ? this.host.resolveStrikeMode(true)
        : player.mode === "ranged"
          ? "ranged"
          : "melee";
    const target = this.host.targeting.facingTarget(strike, true);
    if (target) player.faceToward(target.x, target.y);
    player.tryStartAttack(player.mode === "auto" ? strike : undefined);
  }

  beginSpellCast(
    spellId: string,
    inputMode: SpellCastInputMode = "manual",
    stickX = 0,
    stickY = 0,
  ): void {
    const def = spellById(spellId);
    if (!def || this.host.spellCaster.isChanneling()) return;
    if (spellTargetMode(def) === "ground") {
      this.host.spellChannelArea =
        this.host.groundAim ?? defenseAutoCastGroundTarget(this.host, def);
    } else if (def.mechanicType === "channeled_area") {
      const target = this.host.targeting.facingTarget("ranged", true);
      this.host.spellChannelArea = target
        ? { x: target.x, y: target.y }
        : { x: this.host.player.sprite.x, y: this.host.player.sprite.y };
    }
    const begun = this.host.spellCaster.tryBeginCast(
      spellId,
      inputMode,
      stickX,
      stickY,
    );
    if (begun === false) return;
    this.host.channelAreaStarted = false;
    this.channelTicks.reset();
    if (begun === "windup" || begun === "channel") {
      this.host.player.sprite.setVelocity(0, 0);
      const target = this.host.targeting.facingTarget("ranged", true);
      if (target) this.host.player.faceToward(target.x, target.y);
      return;
    }
    if (typeof begun === "object") {
      this.aimDirectedSpellCast(def);
      this.resolveSpellEffect(begun);
    }
    this.host.pendingGroundCast = null;
    if (!spellNeedsGroundAoeTelegraph(def)) {
      this.host.groundAim = null;
      this.host.groundReticle.hide();
    }
  }

  /** Aim instant directional spells (e.g. water bolt) before resolving — windup spells already face in windup. */
  private aimDirectedSpellCast(def: SpellDefinition): void {
    if (!spellCastUsesEnemyAim(def)) return;
    const target = defenseAutoCastCombatTarget(this.host, def);
    if (target) {
      this.host.targeting.setFocusEnemy(target.id);
      this.host.player.faceToward(target.x, target.y);
      return;
    }
    const facing = this.host.targeting.facingTarget("ranged", true);
    if (facing) this.host.player.faceToward(facing.x, facing.y);
  }

  clearSpellChannelState(): void {
    this.host.spellChannelArea = null;
    this.host.channelAreaStarted = false;
    this.channelTicks.reset();
    this.host.groundAim = null;
    this.host.pendingGroundCast = null;
    this.host.groundReticle.hide();
  }

  clearGroundCastTelegraphs(): void {
    clearDefenseGroundCastTelegraphs(this.host);
  }

  clearLingerAoeTelegraph(): void {
    clearDefenseLingerAoeTelegraph(this.host);
  }

  syncGroundCastTelegraphs(
    def: SpellDefinition,
    phase: "windup" | "channeling",
    progress: number,
    deltaMs: number,
  ): void {
    syncDefenseGroundCastTelegraphs(
      this.host,
      def,
      phase,
      progress,
      deltaMs,
      (d) => defenseAutoCastGroundTarget(this.host, d),
    );
  }

  pulseImpactAoeTelegraph(def: SpellDefinition, x: number, y: number): void {
    pulseDefenseImpactAoeTelegraph(this.host, def, x, y);
  }

  startChanneledGroundZone(def: SpellDefinition): void {
    startDefenseChanneledGroundZone(this.host, def, this.spellDamageMult(def));
  }

  spawnPostChannelLinger(def: SpellDefinition): void {
    spawnDefensePostChannelLinger(
      this.host,
      def,
      this.spellDamageMult(def),
      () => this.clearLingerAoeTelegraph(),
    );
  }

  /** Gear spell power (plus element / named-spell bonus when `def` is known). */
  spellDamageMult(def?: SpellDefinition): number {
    return gearSpellDamageMult(def);
  }

  resolveSpellEffect(def: SpellDefinition): void {
    resolveDefenseSpellEffect(this.host, def, this.spellDamageMult(def));
  }

  /** Motion velocity when moving; otherwise caster facing (blink aim). */
  blinkAimRad(def: SpellDefinition): number {
    return blinkAimRad(this.host, def);
  }

  blinkObstacleAABBs(): ReturnType<typeof blinkObstacleAABBs> {
    return blinkObstacleAABBs(this.host);
  }

  castBlink(facingRad: number, def: SpellDefinition): void {
    castDefenseBlink(this.host, facingRad, def);
  }

  spawnIceWall(facingRad: number, def: SpellDefinition): void {
    spawnDefenseIceWall(this.host, facingRad, def);
  }

  tickIceWalls(): void {
    tickDefenseIceWalls(this.host);
  }
}
