import Phaser from "phaser";
import { toggleAutoCastSpellId } from "../../content/spellBarAutoCast";
import { spellById, type SpellDefinition } from "../../content/spells";
import type { SaveGame } from "../../core/saveTypes";
import { persistSave, playerDamageMult } from "../../core/GameState";
import { pickAutoCastSpell } from "../../combat/spellAutoCast";
import { isStickMoving, SpellInputQueue } from "../../combat/spellInputQueue";
import { SpellCastController } from "../../combat/SpellCastController";
import { EnemySpellStatusMap } from "../../combat/enemySpellStatus";
import {
  applyChanneledHeal,
  applyChainLightning,
  applyInstantTargeted,
  applySpellBlastAt,
  applySpellCone,
  applySpellSwing,
  spawnSpellProjectile,
} from "../../combat/SpellEffects";
import {
  BLINK_DISTANCE_WU,
  FROST_ROOT_MS,
  ICE_WALL_DISTANCE_WU,
  ICE_WALL_DURATION_MS,
  resolveBlinkLanding,
  SHADOWFORM_DAMAGE_MULT,
  SHADOWFORM_DURATION_MS,
} from "../../combat/spellMechanics";
import { SpellBlizzardChannelFx } from "../../combat/SpellBlizzardChannelFx";
import {
  destroySpellGroundAoeTelegraph,
  registerSpellGroundAoeTelegraphWorld,
  spellGroundAoePalette,
  spellNeedsGroundAoeTelegraph,
  spawnSpellGroundAoeTelegraph,
  updateSpellGroundAoeTelegraph,
  type SpellGroundAoeTelegraph,
} from "../../combat/SpellGroundAoeTelegraph";
import { spawnGroundZone, type SpellGroundZone } from "../../combat/spellGroundZone";
import { DEFENSE_RENDER_DEPTH, PLAYER_TUNING, defenseHalfHeight, defenseHalfWidth } from "../../config";
import {
  spellAutoCastRequiresCombatTarget,
  spellAutoCastUsesRangedEnemyPick,
  spellCastMs,
  spellCastUsesEnemyAim,
  spellRequiresManualTarget,
  spellTargetMode,
} from "../../content/spellTargeting";
import { pickAutoCastCombatEnemy } from "../../combat/spellAutoCastCombatEnemy";
import {
  AUTO_CAST_GROUND_ENEMY_SEARCH_RANGE,
  resolveAutoCastGroundAim,
} from "../../combat/spellGroundAim";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import type { DefenseObstacleRect } from "../../config/defense";
import {
  correctPlayerObstacleBlockerOverlap,
  defenseObstacleBlockerAabb,
  readArcadeStaticBodyWorldAabb,
} from "../../world/defenseObstacleBlocker";
import { ENTITY_BODY_RADIUS } from "../../entities/entityPhysics";
import type { EnemyInstance } from "../../entities/Enemy";
import type { PlayerProjectile } from "../../entities/Projectile";
import type { Player } from "../../entities/Player";
import type { SpellBar } from "../../ui/SpellBar";
import type { CastBar } from "../../ui/CastBar";
import { GroundTargetReticle } from "../../ui/GroundTargetReticle";
import type { DefenseTargeting } from "./DefenseTargeting";
import {
  playFireWhooshSfx,
  spellPlaysFireWhooshOnChanneledAreaStart,
  spellPlaysFireWhooshOnChannelLinger,
  spellPlaysFireWhooshOnResolve,
} from "../../audio/fireWhooshSfx";

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
  channelAreaStarted: boolean;
  shadowformEndsAt: number;
  iceWallExpires: Array<{ sprite: Phaser.Physics.Arcade.Image; expiresAt: number }>;
  wu: (n: number) => number;
  enemyTargets: () => import("../../combat/SpellEffects").SpellEnemyTarget[];
  resolveStrikeMode: (auto: boolean) => "melee" | "ranged";
  flashNova: (x: number, y: number, radius: number, def?: { blastTextureKey?: string }) => void;
  nextProjectileId: () => string;
  filterDeadEnemies: () => void;
  timeNow: () => number;
  delayedCall: (ms: number, fn: () => void) => void;
  maskWorldObject?: (go: Phaser.GameObjects.GameObject) => void;
};


export class DefenseSpellDirector {
  constructor(private readonly host: DefenseSpellDirectorHost) {}

  updateChanneling(
    delta: number,
    dir: { x: number; y: number },
    shouldLockMeleeAimFacing: () => boolean,
  ): void {
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    if (!this.host.spellCaster.isChanneling()) return;
    this.host.player.sprite.setVelocity(0, 0);
    const channel = this.host.spellCaster.updateChannel(delta, dir.x, dir.y);
    if (channel.type === "windup" || channel.type === "channeling") {
      this.host.castBar.setVisible(true);
      this.host.castBar.setPhase(channel.type);
      this.host.castBar.setWorldPosition(px, py);
      this.host.castBar.setProgress(channel.progress);
      const chDef = spellById(channel.spellId);
      if (chDef) {
        this.syncGroundCastTelegraphs(chDef, channel.type, channel.progress, delta);
      }
      if (channel.type === "channeling" && chDef && !this.host.channelAreaStarted) {
        this.startChanneledGroundZone(chDef);
      }
    } else if (channel.type === "interrupted") {
      this.host.castBar.setVisible(false);
      this.clearGroundCastTelegraphs();
      this.clearSpellChannelState();
      const lockMeleeAim = shouldLockMeleeAimFacing();
      this.host.player.setVelocityFromStick(dir.x, dir.y, this.host.save.player.moveSpeed, { lockMeleeAim });
      if (lockMeleeAim) {
        const target = this.host.targeting.facingTarget("melee", false);
        if (target) this.host.player.faceToward(target.x, target.y);
      }
    } else if (channel.type === "completed") {
      this.host.castBar.setVisible(false);
      const impactCenter = this.host.spellChannelArea;
      this.resolveSpellEffect(channel.def);
      this.spawnPostChannelLinger(channel.def);
      if (impactCenter && spellNeedsGroundAoeTelegraph(channel.def)) {
        this.pulseImpactAoeTelegraph(channel.def, impactCenter.x, impactCenter.y);
      }
      this.clearGroundCastTelegraphs();
      this.clearSpellChannelState();
    }
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
      const target = this.autoCastCombatTarget(def);
      if (!target) return;
      if (spellTargetMode(def) === "ground") {
        this.host.groundAim = this.autoCastGroundTarget(def);
      } else {
        this.host.targeting.setFocusEnemy(target.id);
        this.host.player.faceToward(target.x, target.y);
      }
    }
    this.beginSpellCast(pick.spellId);
  }

  /** @internal Used by `defense/DefenseSceneE2E` until spell director lands */
  onSpellCastRequest(spellId: string): void {
    const def = spellById(spellId);
    if (!def) return;
    if (
      def.requireEnemyTarget &&
      spellTargetMode(def) === "enemy" &&
      !this.host.targeting.focusEnemyId
    ) {
      return;
    }
    if (!this.host.player.canAttack() || this.host.spellCaster.isChanneling()) {
      this.host.spellInputQueue.enqueue(spellId);
      return;
    }
    if (
      spellRequiresManualTarget(def) &&
      spellTargetMode(def) === "ground" &&
      !this.host.pendingGroundCast
    ) {
      this.host.pendingGroundCast = spellId;
      const aim = this.defaultGroundTarget(def);
      this.host.groundAim = aim;
      this.host.groundReticle.showAt(
        aim.x,
        aim.y,
        GroundTargetReticle.radiusForSpell(this.host.scene, def.blastRadius),
        GroundTargetReticle.styleForSpellId(spellId),
      );
      return;
    }
    this.beginSpellCast(spellId);
  }

  tryFlushQueuedSpellCast(stickX: number, stickY: number): void {
    if (!this.host.player.canAttack()) return;
    if (this.host.spellCaster.isChanneling()) return;
    const spellId = this.host.spellInputQueue.consumeIfReady(stickX, stickY, spellById);
    if (!spellId) return;
    const def = spellById(spellId);
    if (!def) return;
    if (
      def.requireEnemyTarget &&
      spellTargetMode(def) === "enemy" &&
      !this.host.targeting.focusEnemyId
    ) {
      return;
    }
    if (spellTargetMode(def) === "ground") {
      this.host.groundAim = this.defaultGroundTarget(def);
    }
    this.beginSpellCast(spellId);
  }

  beginSpellCast(spellId: string): void {
    const def = spellById(spellId);
    if (!def || this.host.spellCaster.isChanneling()) return;
    if (spellTargetMode(def) === "ground") {
      this.host.spellChannelArea =
        this.host.groundAim ??
        this.defaultGroundTarget(def);
    } else if (def.mechanicType === "channeled_area") {
      const target = this.host.targeting.facingTarget("ranged", true);
      this.host.spellChannelArea = target
        ? { x: target.x, y: target.y }
        : { x: this.host.player.sprite.x, y: this.host.player.sprite.y };
    }
    const begun = this.host.spellCaster.tryBeginCast(spellId);
    if (begun === false) return;
    this.host.channelAreaStarted = false;
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

  groundAimEnemies(): {
    id: string;
    x: number;
    y: number;
    radius: number;
    alive: boolean;
  }[] {
    return this.host.enemies.map((e) => ({
      id: e.id,
      x: e.sprite.x,
      y: e.sprite.y,
      radius: e.sprite.displayWidth * 0.25,
      alive: e.damageable.alive,
    }));
  }

  autoCastGroundTarget(def: SpellDefinition): { x: number; y: number } {
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const maxR = this.host.wu(def.groundTargetMaxRangeWu ?? 240);
    const strike = this.host.resolveStrikeMode(this.host.player.mode === "auto");
    return resolveAutoCastGroundAim(
      px,
      py,
      this.host.player.getFacingAngle(),
      this.host.targeting.focusEnemyId,
      this.groundAimEnemies(),
      strike,
      this.host.wu(PLAYER_TUNING.autoAttackMeleeRange),
      this.host.wu(PLAYER_TUNING.autoAttackRangedRange),
      maxR,
    );
  }

  autoCastEnemyTarget(
    def: SpellDefinition,
  ): { id: string; x: number; y: number } | null {
    return this.autoCastCombatTarget(def);
  }

  autoCastCombatTarget(def: SpellDefinition): {
    id: string;
    x: number;
    y: number;
  } | null {
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const searchR =
      spellTargetMode(def) === "ground"
        ? AUTO_CAST_GROUND_ENEMY_SEARCH_RANGE
        : this.host.wu(
            def.groundTargetMaxRangeWu ?? PLAYER_TUNING.autoAttackRangedRange,
          );
    const strike = spellAutoCastUsesRangedEnemyPick(def)
      ? "ranged"
      : this.host.resolveStrikeMode(this.host.player.mode === "auto");
    return (
      pickAutoCastCombatEnemy(
        px,
        py,
        this.host.targeting.focusEnemyId,
        this.groundAimEnemies(),
        strike,
        this.host.wu(PLAYER_TUNING.autoAttackMeleeRange),
        this.host.wu(PLAYER_TUNING.autoAttackRangedRange),
        searchR,
      ) ??
      null
    );
  }

  /** Aim instant directional spells (e.g. water bolt) before resolving — windup spells already face in windup. */
  private aimDirectedSpellCast(def: SpellDefinition): void {
    if (!spellCastUsesEnemyAim(def)) return;
    const target = this.autoCastCombatTarget(def);
    if (target) {
      this.host.targeting.setFocusEnemy(target.id);
      this.host.player.faceToward(target.x, target.y);
      return;
    }
    const facing = this.host.targeting.facingTarget("ranged", true);
    if (facing) this.host.player.faceToward(facing.x, facing.y);
  }

  defaultGroundTarget(def: SpellDefinition): { x: number; y: number } {
    return this.autoCastGroundTarget(def);
  }

  clearSpellChannelState(): void {
    this.host.spellChannelArea = null;
    this.host.channelAreaStarted = false;
    this.host.groundAim = null;
    this.host.pendingGroundCast = null;
    this.host.groundReticle.hide();
  }

  clearGroundCastTelegraphs(): void {
    destroySpellGroundAoeTelegraph(this.host.groundAoeTelegraph);
    this.host.groundAoeTelegraph = null;
    this.host.blizzardChannelFx?.destroy();
    this.host.blizzardChannelFx = null;
  }

  clearLingerAoeTelegraph(): void {
    destroySpellGroundAoeTelegraph(this.host.lingerAoeTelegraph);
    this.host.lingerAoeTelegraph = null;
  }

  syncGroundCastTelegraphs(
    def: SpellDefinition,
    phase: "windup" | "channeling",
    progress: number,
    deltaMs: number,
  ): void {
    if (!spellNeedsGroundAoeTelegraph(def)) return;
    const center =
      this.host.spellChannelArea ??
      this.host.groundAim ??
      this.defaultGroundTarget(def);
    const radiusWu = this.host.wu(def.blastRadius ?? 72);
    const reticleStyle = GroundTargetReticle.styleForSpellId(def.id);
    if (phase === "windup") {
      this.host.groundReticle.showAt(center.x, center.y, radiusWu, reticleStyle);
    } else {
      this.host.groundReticle.hide();
    }
    const telegraphMode = phase === "windup" ? "windup" : "channel";
    if (!this.host.groundAoeTelegraph) {
      this.host.groundAoeTelegraph = spawnSpellGroundAoeTelegraph(this.host.scene,
        center.x,
        center.y,
        radiusWu,
        spellGroundAoePalette(def),
        spellCastMs(def),
        telegraphMode,
      );
      registerSpellGroundAoeTelegraphWorld(
        this.host.groundAoeTelegraph,
        this.host.maskWorldObject,
      );
    } else {
      this.host.groundAoeTelegraph.zoneX = center.x;
      this.host.groundAoeTelegraph.zoneY = center.y;
      this.host.groundAoeTelegraph.zoneRadius = radiusWu;
    }
    updateSpellGroundAoeTelegraph(
      this.host.groundAoeTelegraph,
      deltaMs,
      telegraphMode,
      progress,
    );
    if (def.id === "blizzard" && phase === "channeling") {
      if (!this.host.blizzardChannelFx) {
        this.host.blizzardChannelFx = new SpellBlizzardChannelFx(this.host.scene);
        this.host.blizzardChannelFx.start(
          center.x,
          center.y,
          radiusWu,
          SpellBlizzardChannelFx.defaultTextureKey(),
        );
      }
    } else if (this.host.blizzardChannelFx) {
      this.host.blizzardChannelFx.stop();
    }
  }

  pulseImpactAoeTelegraph(
    def: SpellDefinition,
    x: number,
    y: number,
  ): void {
    const radiusWu = this.host.wu(def.blastRadius ?? 72);
    const impact = spawnSpellGroundAoeTelegraph(this.host.scene,
      x,
      y,
      radiusWu,
      spellGroundAoePalette(def),
      1,
      "impact",
    );
    registerSpellGroundAoeTelegraphWorld(impact, this.host.maskWorldObject);
    updateSpellGroundAoeTelegraph(impact, 0, "impact", 1);
    this.host.delayedCall(360, () => destroySpellGroundAoeTelegraph(impact));
  }

  startChanneledGroundZone(def: SpellDefinition): void {
    if (this.host.channelAreaStarted) return;
    const mult = this.spellDamageMult();
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const center = this.host.spellChannelArea ?? { x: px, y: py };
    if (def.mechanicType === "channeled_area" || def.mechanicType === "channeled") {
      this.host.spellGroundZones.push(
        spawnGroundZone(this.host.scene, def, center.x, center.y, mult, this.host.timeNow(), {
          durationMs: def.channelMs,
          tickDamageScale: def.mechanicType === "channeled" ? 0.35 : 0.4,
          includeBurst: Boolean(def.burstDamage),
        }),
      );
      this.host.channelAreaStarted = true;
      if (def.mechanicType === "channeled_area") {
        this.host.flashNova(center.x, center.y, this.host.wu(def.blastRadius ?? 78), {
          blastTextureKey: COMBAT_FX_TEXTURE.spellFireNova,
        });
        if (spellPlaysFireWhooshOnChanneledAreaStart(def)) {
          playFireWhooshSfx(this.host.scene);
        }
      }
    }
  }

  spawnPostChannelLinger(def: SpellDefinition): void {
    if (!def.lingerMs || def.lingerMs <= 0) return;
    const center = this.host.spellChannelArea ?? {
      x: this.host.player.sprite.x,
      y: this.host.player.sprite.y,
    };
    this.host.spellGroundZones.push(
      spawnGroundZone(this.host.scene,
        def,
        center.x,
        center.y,
        this.spellDamageMult(),
        this.host.timeNow(),
        {
          durationMs: def.lingerMs,
          lingerDot: true,
          tickDamageScale: 0,
        },
      ),
    );
    this.clearLingerAoeTelegraph();
    const radiusWu = this.host.wu(def.blastRadius ?? 78);
    this.host.lingerAoeTelegraph = spawnSpellGroundAoeTelegraph(this.host.scene,
      center.x,
      center.y,
      radiusWu,
      spellGroundAoePalette(def),
      1,
      "channel",
    );
    registerSpellGroundAoeTelegraphWorld(
      this.host.lingerAoeTelegraph,
      this.host.maskWorldObject,
    );
    updateSpellGroundAoeTelegraph(this.host.lingerAoeTelegraph, 0, "channel", 1);
    this.host.flashNova(center.x, center.y, radiusWu, {
      blastTextureKey: COMBAT_FX_TEXTURE.spellFireNova,
    });
    if (spellPlaysFireWhooshOnChannelLinger(def)) {
      playFireWhooshSfx(this.host.scene);
    }
  }

  spellDamageMult(): number {
    const mult = playerDamageMult(this.host.save.buildings);
    return this.host.shadowformEndsAt > this.host.timeNow() ? mult * SHADOWFORM_DAMAGE_MULT : mult;
  }

  resolveSpellEffect(def: SpellDefinition): void {
    if (spellPlaysFireWhooshOnResolve(def)) {
      playFireWhooshSfx(this.host.scene);
    }
    const mult = this.spellDamageMult();
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const angle = this.blinkAimRad(def);
    const targets = this.host.enemyTargets();
    switch (def.mechanicType) {
      case "blast": {
        const remote =
          spellTargetMode(def) === "ground" && this.host.spellChannelArea
            ? this.host.spellChannelArea
            : null;
        const bx = remote?.x ?? px;
        const by = remote?.y ?? py;
        applySpellBlastAt(this.host.scene, bx, by, def, targets, mult, 140, this.host.enemySpellStatus);
        this.host.flashNova(bx, by, this.host.wu(def.blastRadius ?? 80), {
          blastTextureKey:
            def.id === "meteor"
              ? COMBAT_FX_TEXTURE.spellShockwave
              : def.id === "flamestrike"
                ? COMBAT_FX_TEXTURE.spellFireNova
                : def.blastTextureKey,
        });
        if (def.id === "frost_nova") this.applyFrostNovaRoot();
        break;
      }
      case "projectile":
      case "projectile_aoe": {
        const id = `spell_proj_${this.host.nextProjectileId()}`;
        const projSpell = spawnSpellProjectile(
          this.host.scene,
          px,
          py,
          angle,
          def,
          mult,
          id,
        );
        this.host.maskWorldObject?.(projSpell.sprite);
        this.host.projectiles.push(projSpell);
        break;
      }
      case "tracking_projectile": {
        const focus = this.host.targeting.focusEnemyId;
        const id = `spell_proj_${this.host.nextProjectileId()}`;
        const trackingProj = spawnSpellProjectile(
          this.host.scene,
          px,
          py,
          angle,
          def,
          mult,
          id,
          {
            behavior: "tracking",
            trackEnemyId: focus,
          },
        );
        this.host.maskWorldObject?.(trackingProj.sprite);
        this.host.projectiles.push(trackingProj);
        if (def.id === "chain_lightning") {
          applyChainLightning(
            this.host.scene,
            px,
            py,
            def,
            targets,
            mult,
            focus,
            this.host.enemySpellStatus,
          );
        }
        break;
      }
      case "swing":
      case "tracking_swing": {
        if (def.mechanicType === "tracking_swing") {
          const t = this.host.targeting.facingTarget("melee", true);
          if (t) this.host.player.faceToward(t.x, t.y);
        }
        applySpellSwing(this.host.scene,
          px,
          py,
          this.host.player.getFacingAngle(),
          def,
          targets,
          mult,
          this.host.enemySpellStatus,
        );
        break;
      }
      case "cone":
        applySpellCone(this.host.scene, px, py, angle, def, targets, mult, this.host.enemySpellStatus);
        break;
      case "channeled":
      case "channeled_area":
        break;
      case "instant_targeted": {
        const hitId = applyInstantTargeted(this.host.scene,
          def,
          targets,
          this.host.targeting.focusEnemyId,
          px,
          py,
          mult,
          this.host.enemySpellStatus,
        );
        if (def.projectileTextureKey) {
          const t = hitId ? this.host.targeting.getEnemyById(hitId) : null;
          const tx = t?.sprite.x ?? px + Math.cos(angle) * 40;
          const ty = t?.sprite.y ?? py + Math.sin(angle) * 40;
          const aim = Math.atan2(ty - py, tx - px);
          const id = `spell_proj_${this.host.nextProjectileId()}`;
          const aimedProj = spawnSpellProjectile(
            this.host.scene,
            px,
            py,
            aim,
            def,
            mult,
            id,
          );
          this.host.maskWorldObject?.(aimedProj.sprite);
          this.host.projectiles.push(aimedProj);
        }
        break;
      }
      case "heal":
        applyChanneledHeal(this.host.player.damageable, def);
        break;
      case "blink":
        this.castBlink(angle);
        break;
      case "buff":
        if (def.id === "shadowform") {
          this.host.shadowformEndsAt = this.host.timeNow() + SHADOWFORM_DURATION_MS;
        }
        break;
      case "ice_wall":
        this.spawnIceWall(angle);
        break;
      default:
        break;
    }
    this.host.filterDeadEnemies();
  }

  applyFrostNovaRoot(): void {
    const def = spellById("frost_nova");
    const rootMs = def?.onHit?.rootMs ?? FROST_ROOT_MS;
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const r = this.host.wu(def?.blastRadius ?? 85);
    for (const e of this.host.enemies) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
      if (d <= r + this.host.wu(ENTITY_BODY_RADIUS.enemy)) {
        this.host.enemySpellStatus.applyRoot(e.id, rootMs);
      }
    }
  }

  /** Motion velocity when moving; otherwise caster facing (blink aim). */
  blinkAimRad(def: SpellDefinition): number {
    if (def.mechanicType !== "blink") {
      return this.host.player.getFacingAngle();
    }
    const body = this.host.player.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > 6) return Math.atan2(body.velocity.y, body.velocity.x);
    return this.host.player.getFacingAngle();
  }

  blinkObstacleAABBs(): ReturnType<typeof defenseObstacleBlockerAabb>[] {
    const rects = this.host.obstacleBlockers.map((b) =>
      defenseObstacleBlockerAabb(b),
    );
    for (const entry of this.host.iceWallExpires) {
      const body = entry.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) rects.push(readArcadeStaticBodyWorldAabb(body));
    }
    return rects;
  }

  castBlink(facingRad: number): void {
    const halfW = defenseHalfWidth();
    const halfH = defenseHalfHeight();
    const px = this.host.player.sprite.x;
    const py = this.host.player.sprite.y;
    const playerR = this.host.wu(ENTITY_BODY_RADIUS.player);
    const bounds = {
      minX: -halfW + 24,
      maxX: halfW - 24,
      minY: -halfH + 24,
      maxY: halfH - 24,
    };
    const enemies = this.host
      .enemyTargets()
      .filter((e) => e.damageable.alive)
      .map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        radius: e.radius,
      }));
    const landing = resolveBlinkLanding(
      px,
      py,
      facingRad,
      this.host.wu(BLINK_DISTANCE_WU),
      bounds,
      playerR,
      this.blinkObstacleAABBs(),
      enemies,
    );
    const blinkFxR = playerR * 1.4;
    this.host.flashNova(px, py, blinkFxR, {
      blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
    });
    this.host.player.sprite.setPosition(landing.x, landing.y);
    const body = this.host.player.sprite.body as Phaser.Physics.Arcade.Body;
    body?.reset(landing.x, landing.y);
    body?.updateCenter();
    correctPlayerObstacleBlockerOverlap(
      this.host.player.sprite,
      this.host.obstacleBlockers,
    );
    if (landing.moved) {
      this.host.flashNova(landing.x, landing.y, blinkFxR, {
        blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
      });
    }
  }

  spawnIceWall(facingRad: number): void {
    const dist = this.host.wu(ICE_WALL_DISTANCE_WU);
    const cx = this.host.player.sprite.x + Math.cos(facingRad) * dist;
    const cy = this.host.player.sprite.y + Math.sin(facingRad) * dist;
    const perpX = -Math.sin(facingRad);
    const perpY = Math.cos(facingRad);
    const gap = this.host.wu(28);
    const key = COMBAT_FX_TEXTURE.spellIceBolt;
    for (let i = -1; i <= 1; i++) {
      const x = cx + perpX * gap * i;
      const y = cy + perpY * gap * i;
      const block = this.host.scene.physics.add.staticImage(x, y, key);
      const size = this.host.wu(20);
      block.setDisplaySize(size, size);
      block.setDepth(DEFENSE_RENDER_DEPTH.obstacleBlock);
      block.refreshBody();
      this.host.obstacleGroup.add(block);
      this.host.iceWallExpires.push({
        sprite: block,
        expiresAt: this.host.timeNow() + ICE_WALL_DURATION_MS,
      });
    }
  }

  tickIceWalls(): void {
    const now = this.host.timeNow();
    this.host.iceWallExpires = this.host.iceWallExpires.filter((entry) => {
      if (entry.expiresAt > now) return true;
      this.host.obstacleGroup.remove(entry.sprite, true, true);
      return false;
    });
  }

}
