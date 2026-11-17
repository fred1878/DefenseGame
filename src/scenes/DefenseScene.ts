import Phaser from "phaser";
import {
  DEFENSE_MAP,
  DEFENSE_RENDER_DEPTH,
  defenseHalfHeight,
  defenseHalfWidth,
  PLAYER_TUNING,
  type AttackMode,
} from "../config";
import { toggleAutoCastSpellId } from "../content/spellBarAutoCast";
import {
  createDefaultSpellBarAutoCast,
  createDefaultSpellBarSlots,
  spellById,
  type SpellDefinition,
} from "../content/spells";
import type { SaveGame } from "../core/saveTypes";
import { DataStore, type EnemyDef } from "../core/DataStore";
import {
  persistSave,
  playerDamageMult,
} from "../core/GameState";
import {
  type EndlessRunSelection,
  readDefenseRunMode,
  resolveEndlessRunSelections,
} from "../core/defenseRunMode";
import { applyDamage } from "../combat/DamageSystem";
import { showPlayerMeleeSwipe } from "../combat/MeleeSwipeFx";
import { pickAutoCastSpell } from "../combat/spellAutoCast";
import { isStickMoving, SpellInputQueue } from "../combat/spellInputQueue";
import { SpellCastController } from "../combat/SpellCastController";
import { EnemySpellStatusMap } from "../combat/enemySpellStatus";
import {
  applyChanneledHeal,
  applyChainLightning,
  applyInstantTargeted,
  applySpellBlastAt,
  applySpellCone,
  applySpellSwing,
  spawnSpellProjectile,
} from "../combat/SpellEffects";
import {
  blinkDestination,
  BLINK_DISTANCE_WU,
  FROST_ROOT_MS,
  ICE_WALL_DISTANCE_WU,
  ICE_WALL_DURATION_MS,
  SHADOWFORM_DAMAGE_MULT,
  SHADOWFORM_DURATION_MS,
} from "../combat/spellMechanics";
import { buildNavGrid, type NavGrid } from "../pathfinding/grid";
import {
  showEnemyPaths,
  showHitboxes,
  showTouchInput,
} from "../debug/DebugState";
import {
  DEBUG_MENU_CLOSE,
  pauseForDebugMenu,
  resumeFromDebugMenu,
} from "../debug/debugMenuLifecycle";
import { HitboxDebugDraw } from "../debug/HitboxDebugDraw";
import { PathDebugDraw } from "../debug/PathDebugDraw";
import {
  TouchInputDebugDraw,
  type FocusTapFlash,
} from "../debug/TouchInputDebugDraw";
import { ENTITY_BODY_RADIUS } from "../entities/entityPhysics";
import {
  updateEnemySpriteFacing,
  type EnemyInstance,
} from "../entities/Enemy";
import { destroyArrowRainTelegraph } from "../combat/ArrowRainTelegraph";
import { SpellBlizzardChannelFx } from "../combat/SpellBlizzardChannelFx";
import {
  destroySpellGroundAoeTelegraph,
  spellGroundAoePalette,
  spellNeedsGroundAoeTelegraph,
  spawnSpellGroundAoeTelegraph,
  updateSpellGroundAoeTelegraph,
  type SpellGroundAoeTelegraph,
} from "../combat/SpellGroundAoeTelegraph";
import {
  spawnPlayerProjectile,
  type EnemyProjectile,
  type PlayerProjectile,
} from "../entities/Projectile";
import { Player, type AttackPhase } from "../entities/Player";
import {
  configureSceneInput,
} from "../input/inputTuning";
import { VirtualStick } from "../input/VirtualStick";
import { createTouchToggleButton } from "../ui/touchButton";
import { evaluateEndlessEnd, evaluateNightEnd } from "./defenseNightLogic";
import { getEndlessConcurrentCap } from "../systems/endlessEnemyRoster";
import {
  countLivingWithDefId,
  planEndlessSpawns,
} from "../systems/endlessSpawnScheduler";
import { playPlayerMeleeSlashSfx } from "../audio/playerMeleeSlashSfx";
import { CastBar } from "../ui/CastBar";
import { SpellBar } from "../ui/SpellBar";
import { TargetIndicator } from "../ui/TargetIndicator";
import { GroundTargetReticle } from "../ui/GroundTargetReticle";
import {
  spellAutoCastNeedsEnemyTarget,
  spellCastMs,
  spellRequiresManualTarget,
  spellTargetMode,
} from "../content/spellTargeting";
import { resolveAutoCastEnemyAim } from "../combat/spellAutoCastEnemyAim";
import {
  resolveAutoCastGroundAim,
  resolveManualDefaultGroundAim,
} from "../combat/spellGroundAim";
import { clampGroundTarget } from "../combat/spellMechanics";
import {
  spawnGroundZone,
  tickSpellGroundZones,
  type SpellGroundZone,
} from "../combat/spellGroundZone";
import { pickWaveSpawnPoint } from "../world/defenseSpawns";
import { cameraWorldPoint, type SafeInsets } from "../ui/screenLayout";
import { updateEnemyNameplate } from "../ui/enemyNameplate";
import {
  scaledDefenseObstacles,
  worldDisplayPx,
  worldUnit,
} from "../core/worldPixelScale";
import type { TouchButtonHandle } from "../ui/touchButton";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY } from "../content/assets";
import type { CombatHudChrome } from "../ui/combatHudChrome";
import { DefenseMinimap, defenseMinimapLayout } from "../ui/defenseMinimap";
import {
  type DefenseSceneE2eDelegate,
  defenseSceneE2eAttackPhase,
  defenseSceneE2eAutoAttackEnabled,
  defenseSceneE2eBottomChromeTextureKey,
  defenseSceneE2eCastSpellSlot,
  defenseSceneE2eDamagePlayer,
  defenseSceneE2eEndlessEnemyId,
  defenseSceneE2eEndlessEnemyIds,
  defenseSceneE2eEnemyCount,
  defenseSceneE2eForceWinNight,
  defenseSceneE2eGetDefenseCameraScroll,
  defenseSceneE2eGetObstacleAlignment,
  defenseSceneE2eGetSpellSlotHitRects,
  defenseSceneE2eGetUiTapTargets,
  defenseSceneE2eHasLeaveEndlessButton,
  defenseSceneE2eHasReturnButton,
  defenseSceneE2eIsEndlessMode,
  defenseSceneE2eIsReady,
  defenseSceneE2eIsTouchButtonPressed,
  defenseSceneE2eKillAllEnemies,
  defenseSceneE2eNightEnded,
  defenseSceneE2ePlayerPosition,
  defenseSceneE2eProjectileCount,
  defenseSceneE2eSetManualReturn,
  defenseSceneE2eSetPlayerPosition,
  defenseSceneE2eSetShowEnemyPaths,
  defenseSceneE2eSetSpawnPlanComplete,
  defenseSceneE2eSetStick,
  defenseSceneE2eSimulateScreenTap,
  defenseSceneE2eSpawnEnemy,
  defenseSceneE2eTapMelee,
  defenseSceneE2eTapRanged,
  defenseSceneE2eWallHp,
} from "./defense/DefenseSceneE2E";
import {
  spawnDefenseEnemyAt,
  type DefenseEnemySpawnerHost,
} from "./defense/DefenseEnemySpawner";
import { scheduleDefenseWave } from "./defense/DefenseWaveSpawner";
import {
  runDefenseCampaignNightEnd,
  runDefenseEndlessNightEnd,
  transitionDefenseToTown,
} from "./defense/DefenseNightEnd";
import { DefenseTargeting } from "./defense/DefenseTargeting";
import { createDefenseHudController } from "./defense/DefenseHudController";
import { bootstrapDefenseWorld } from "./defense/DefenseWorldBootstrap";
import { tickDefenseProjectiles } from "./defense/DefenseProjectileTick";
import { tickDefenseEnemies } from "./defense/DefenseEnemyTick";

export class DefenseScene extends Phaser.Scene {
  private save!: SaveGame;
  private player!: Player;
  private stick!: VirtualStick;
  private enemies: EnemyInstance[] = [];
  private projectiles: PlayerProjectile[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private projectileSerial = 0;
  private hudText!: Phaser.GameObjects.Text;
  attackButton!: Phaser.GameObjects.Container;
  private autoAttackEnabled = false;
  autoToggle!: ReturnType<typeof createTouchToggleButton>;
  modeToggle!: ReturnType<typeof createTouchToggleButton>;
  private uiBlockers: Phaser.GameObjects.GameObject[] = [];
  private wallHp = 0;
  private wallHpStart = 0;
  private navGrid!: NavGrid;
  private playerInvulnMs = 0;
  private hitboxDebug!: HitboxDebugDraw;
  private pathDebug!: PathDebugDraw;
  private touchDebug!: TouchInputDebugDraw;
  private enemyPathGoals = new Map<
    string,
    { targetKind: "wall" | "player"; x: number; y: number }
  >();
  private focusTapFlash: FocusTapFlash | null = null;
  private rewardGold = 40;
  private spawnPlanComplete = false;
  private nightEnded = false;
  returnToTownBtn: TouchButtonHandle | null = null;
  private targeting!: DefenseTargeting;
  private targetIndicator!: TargetIndicator;
  private spellCaster = new SpellCastController();
  private spellInputQueue = new SpellInputQueue();
  private enemySpellStatus = new EnemySpellStatusMap();
  private spellChannelArea: { x: number; y: number } | null = null;
  private spellGroundZones: SpellGroundZone[] = [];
  private pendingGroundCast: string | null = null;
  private groundAim: { x: number; y: number } | null = null;
  private groundReticle!: GroundTargetReticle;
  private groundAoeTelegraph: SpellGroundAoeTelegraph | null = null;
  private lingerAoeTelegraph: SpellGroundAoeTelegraph | null = null;
  private blizzardChannelFx: SpellBlizzardChannelFx | null = null;
  private channelAreaStarted = false;
  private shadowformEndsAt = 0;
  private iceWallExpires: Array<{
    sprite: Phaser.Physics.Arcade.Image;
    expiresAt: number;
  }> = [];
  private spellBar!: SpellBar;
  private castBar!: CastBar;
  debugBtn!: TouchButtonHandle;
  private safe!: SafeInsets;
  private onPointerUpBound = (p: Phaser.Input.Pointer) => this.onScreenTap(p);
  private setHudChromeVisible = (visible: boolean): void => {
    this.hudSetChromeVisible?.(visible);
  };
  private hudSetChromeVisible: ((visible: boolean) => void) | null = null;
  private onDebugMenuClose = (): void => {
    this.setHudChromeVisible(true);
    resumeFromDebugMenu(this);
  };
  private prevPlayerAttackPhase: AttackPhase = "idle";
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  hudChrome!: CombatHudChrome;
  private minimap!: DefenseMinimap;
  private minimapLayout!: ReturnType<typeof defenseMinimapLayout>;
  private endlessSelections: EndlessRunSelection[] | null = null;
  private leaveEndlessBtn: TouchButtonHandle | null = null;

  constructor() {
    super({ key: "Defense" });
  }

  private wu(atDefault2x: number): number {
    return worldUnit(atDefault2x, this.registry);
  }

  /** Phaser reuses scene instances; clear per-night state when a new defense run starts. */
  private resetDefenseRunState(): void {
    this.nightEnded = false;
    this.spawnPlanComplete = false;
    this.returnToTownBtn = null;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.projectileSerial = 0;
    this.enemyPathGoals.clear();
    this.targeting?.resetForNewRun();
    this.focusTapFlash = null;
    this.prevPlayerAttackPhase = "idle";
    this.autoAttackEnabled = false;
    this.playerInvulnMs = 0;
    this.spellCaster = new SpellCastController();
    this.spellInputQueue = new SpellInputQueue();
    this.enemySpellStatus = new EnemySpellStatusMap();
    this.spellChannelArea = null;
    this.spellGroundZones = [];
    this.pendingGroundCast = null;
    this.groundAim = null;
    this.shadowformEndsAt = 0;
    for (const wall of this.iceWallExpires) wall.sprite.destroy();
    this.iceWallExpires = [];
    this.endlessSelections = null;
    this.leaveEndlessBtn = null;
  }

  /** @internal Used by `defense/DefenseSceneE2E` until night/spawn modules land */
  isEndlessMode(): boolean {
    return (this.endlessSelections?.length ?? 0) > 0;
  }

  create(): void {
    configureSceneInput(this);
    this.save = { ...(this.registry.get("save") as SaveGame) };
    if (!this.save.spellBar?.slots?.length) {
      this.save.spellBar = {
        slots: createDefaultSpellBarSlots(),
        autoCastSpellIds: createDefaultSpellBarAutoCast(),
      };
    }
    if (!this.save.spellBar.autoCastSpellIds) {
      this.save.spellBar.autoCastSpellIds = createDefaultSpellBarAutoCast();
    }
    this.resetDefenseRunState();
    this.wallHp = Math.max(0, this.save.townWallHp);
    this.wallHpStart = this.wallHp;
    this.navGrid = buildNavGrid(
      scaledDefenseObstacles(this.registry),
      worldUnit(DEFENSE_MAP.cellSize, this.registry),
      worldUnit(DEFENSE_MAP.pathClearancePx, this.registry),
    );
    const store = this.registry.get("dataStore") as DataStore;
    const runMode = readDefenseRunMode(this.registry);
    const endless = runMode.kind === "endless";
    if (endless) {
      this.endlessSelections = resolveEndlessRunSelections(
        runMode.selections,
        (enemyId) =>
          getEndlessConcurrentCap(
            enemyId,
            store.enemies[enemyId],
          ),
      );
      this.rewardGold = 0;
    }
    const wave = endless ? undefined : store.getWaveForNight(this.save.night);
    if (wave) this.rewardGold = wave.rewardGold;

    const world = bootstrapDefenseWorld({
      scene: this,
      night: this.save.night,
      playerHpMax: this.save.player.hpMax,
    });
    this.player = world.player;
    this.playerInvulnMs = world.playerInvulnMs;
    this.obstacleGroup = world.obstacleGroup;
    this.enemyGroup = world.enemyGroup;

    const hud = createDefenseHudController({
      scene: this,
      save: this.save,
      player: this.player,
      endless,
      onManualAttack: () => this.manualAttack(),
      onSpellCastRequest: (id) => this.onSpellCastRequest(id),
      onSpellAutoCastToggle: (slot) => this.onSpellAutoCastToggle(slot),
      onOpenDebugMenu: () => this.openDebugMenu(),
      onLeaveEndless: () => this.endEndlessRun("quit"),
      getAutoAttackEnabled: () => this.autoAttackEnabled,
      setAutoAttackEnabled: (on) => {
        this.autoAttackEnabled = on;
      },
    });
    this.safe = hud.safe;
    this.hudChrome = hud.hudChrome;
    this.attackButton = hud.attackButton;
    this.modeToggle = hud.modeToggle;
    this.autoToggle = hud.autoToggle;
    this.spellCaster = hud.spellCaster;
    this.castBar = hud.castBar;
    this.spellBar = hud.spellBar;
    this.hudText = hud.hudText;
    this.debugBtn = hud.debugBtn;
    this.leaveEndlessBtn = hud.leaveEndlessBtn;
    this.minimap = hud.minimap;
    this.minimapLayout = hud.minimapLayout;
    this.stick = hud.stick;
    this.uiBlockers = hud.uiBlockers;
    this.hudSetChromeVisible = hud.setHudChromeVisible;
    this.refreshModeToggle = hud.refreshModeToggle;

    this.targetIndicator = new TargetIndicator(this);
    this.targeting = new DefenseTargeting({
      scene: this,
      registry: this.registry,
      scale: this.scale,
      input: this.input,
      player: this.player,
      enemies: this.enemies,
      targetIndicator: this.targetIndicator,
      uiBlockers: this.uiBlockers,
      safe: this.safe,
      wu: (n) => this.wu(n),
    });
    this.groundReticle = new GroundTargetReticle(this);
    this.hitboxDebug = new HitboxDebugDraw(this);
    this.pathDebug = new PathDebugDraw(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.input.on("pointerup", this.onPointerUpBound);

    this.game.events.on(DEBUG_MENU_CLOSE, this.onDebugMenuClose);

    if (endless) {
      this.spawnPlanComplete = true;
      this.ensureEndlessSpawnCap();
    } else if (wave && !isE2EEnabled()) {
      this.scheduleWave(store, wave);
    } else if (isE2EEnabled()) {
      this.spawnPlanComplete = false;
    } else {
      this.spawnPlanComplete = true;
    }

    if (isE2EEnabled()) {
      publishE2E({
        scene: "Defense",
        ready: true,
        player: this.e2ePlayerPosition(),
      });
    }

    this.events.on("shutdown", () => {
      this.game.events.off(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
      this.input.off("pointerup", this.onPointerUpBound);
      this.stick.destroy(this);
      this.targetIndicator.destroy();
      this.groundReticle.destroy();
      this.clearGroundCastTelegraphs();
      this.clearLingerAoeTelegraph();
      this.castBar.destroy();
      this.spellBar.destroy();
      this.hitboxDebug.destroy();
      this.pathDebug.destroy();
      this.touchDebug.destroy();
      this.minimap.destroy();
      for (const p of this.projectiles) p.sprite.destroy();
      this.projectiles = [];
      for (const p of this.enemyProjectiles) p.sprite.destroy();
      this.enemyProjectiles = [];
      for (const e of this.enemies) {
        destroyArrowRainTelegraph(e.arrowRain?.telegraph);
        destroyArrowRainTelegraph(e.lobber?.telegraph);
      }
    });
  }

  update(_time: number, delta: number): void {
    this.spellCaster.tickCooldowns(delta);
    const dir = this.stick.getDirection();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    if (this.spellCaster.isChanneling()) {
      this.player.sprite.setVelocity(0, 0);
      const channel = this.spellCaster.updateChannel(delta, dir.x, dir.y);
      if (channel.type === "windup" || channel.type === "channeling") {
        this.castBar.setVisible(true);
        this.castBar.setPhase(channel.type);
        this.castBar.setWorldPosition(px, py);
        this.castBar.setProgress(channel.progress);
        const chDef = spellById(channel.spellId);
        if (chDef) {
          this.syncGroundCastTelegraphs(chDef, channel.type, channel.progress, delta);
        }
        if (channel.type === "channeling" && chDef && !this.channelAreaStarted) {
          this.startChanneledGroundZone(chDef);
        }
      } else if (channel.type === "interrupted") {
        this.castBar.setVisible(false);
        this.clearGroundCastTelegraphs();
        this.clearSpellChannelState();
        const lockMeleeAim = this.shouldLockMeleeAimFacing();
        this.player.setVelocityFromStick(dir.x, dir.y, this.save.player.moveSpeed, {
          lockMeleeAim,
        });
        if (lockMeleeAim) {
          const target = this.targeting.facingTarget("melee", false);
          if (target) this.player.faceToward(target.x, target.y);
        }
      } else if (channel.type === "completed") {
        this.castBar.setVisible(false);
        const impactCenter = this.spellChannelArea;
        this.resolveSpellEffect(channel.def);
        this.spawnPostChannelLinger(channel.def);
        if (
          impactCenter &&
          spellNeedsGroundAoeTelegraph(channel.def)
        ) {
          this.pulseImpactAoeTelegraph(channel.def, impactCenter.x, impactCenter.y);
        }
        this.clearGroundCastTelegraphs();
        this.clearSpellChannelState();
      }
    } else {
      const lockMeleeAim = this.shouldLockMeleeAimFacing();
      this.player.setVelocityFromStick(dir.x, dir.y, this.save.player.moveSpeed, {
        lockMeleeAim,
      });
      if (lockMeleeAim) {
        const target = this.targeting.facingTarget("melee", false);
        if (target) this.player.faceToward(target.x, target.y);
      }
      this.castBar.setVisible(false);
    }

    if (!this.spellCaster.isChanneling()) {
      this.tryAutoAttack();
      this.tryAutoCastSpells(dir.x, dir.y);
    }
    this.player.updateAttack(delta);
    this.tryFlushQueuedSpellCast(dir.x, dir.y);
    this.syncMeleeSwipeFx();

    const mult = playerDamageMult(this.save.buildings);
    this.player.damageEnemiesInArc(
      this.enemyTargets(),
      PLAYER_TUNING.meleeDamage * mult,
      PLAYER_TUNING.meleeKnockback,
    );

    if (this.player.consumeRangedShot()) {
      this.fireProjectile(PLAYER_TUNING.rangedDamage * mult);
    }

    const projTick = tickDefenseProjectiles(
      {
        scene: this,
        registry: this.registry,
        player: this.player,
        playerInvulnMs: this.playerInvulnMs,
        projectiles: this.projectiles,
        enemyProjectiles: this.enemyProjectiles,
        enemyTargets: () => this.enemyTargets(),
        spellDamageMult: () => this.spellDamageMult(),
        wu: (n) => this.wu(n),
        findEnemy: (id) => {
          const e = this.targeting.getEnemyById(id);
          if (!e) return undefined;
          return {
            id: e.id,
            x: e.sprite.x,
            y: e.sprite.y,
            radius: this.wu(ENTITY_BODY_RADIUS.enemy),
            damageable: e.damageable,
            sprite: e.sprite,
          };
        },
        flashNova: (x, y, r, def) => this.flashNova(x, y, r, def),
      },
      delta,
    );
    this.projectiles = projTick.projectiles;
    this.enemyProjectiles = projTick.enemyProjectiles;
    this.playerInvulnMs = projTick.playerInvulnMs;

    this.playerInvulnMs = Math.max(0, this.playerInvulnMs - delta);

    const playerHurtbox = {
      x: px,
      y: py,
      radius: this.wu(ENTITY_BODY_RADIUS.player),
      damageable: this.player.damageable,
    };
    this.targeting.focusSelectLockMs = Math.max(0, this.targeting.focusSelectLockMs - delta);
    this.enemySpellStatus.tick(delta, (enemyId, amount, flavor) => {
      const e = this.targeting.getEnemyById(enemyId);
      if (e?.damageable.alive) applyDamage(e.damageable, amount, flavor);
    });
    for (const e of this.enemies) {
      e.statusSpeedMul = this.enemySpellStatus.moveSpeedMultiplier(e.id);
    }
    this.spellGroundZones = tickSpellGroundZones(
      this,
      this.spellGroundZones,
      this.time.now,
      delta,
      this.enemyTargets(),
      this.enemySpellStatus,
      this.spellDamageMult(),
    );
    if (this.lingerAoeTelegraph) {
      updateSpellGroundAoeTelegraph(
        this.lingerAoeTelegraph,
        delta,
        "channel",
        1,
      );
    }
    this.tickIceWalls();

    const enemyTick = tickDefenseEnemies(
      {
        scene: this,
        registry: this.registry,
        navGrid: this.navGrid,
        enemies: this.enemies,
        enemyProjectiles: this.enemyProjectiles,
        enemySpellStatus: this.enemySpellStatus,
        enemyPathGoals: this.enemyPathGoals,
        wallHp: this.wallHp,
        playerInvulnMs: this.playerInvulnMs,
        playerHurtbox,
        nextProjectileId: (prefix) => `${prefix}${this.projectileSerial++}`,
      },
      delta,
    );
    this.wallHp = enemyTick.wallHp;
    this.playerInvulnMs = enemyTick.playerInvulnMs;
    this.enemyProjectiles = enemyTick.enemyProjectiles;

    const enemySpriteSide = worldDisplayPx(SPRITE_DISPLAY.enemy, this.registry);
    for (const e of this.enemies) {
      if (!e.damageable.alive || e.nameplate.dying) continue;
      updateEnemySpriteFacing(e);
      updateEnemyNameplate(
        e.nameplate,
        e.sprite.x,
        e.sprite.y,
        enemySpriteSide,
        e.damageable,
      );
    }

    this.drawDebugHitboxes();
    this.drawEnemyPaths();
    this.drawTouchDebug(delta);
    this.minimap.draw(
      this.minimapLayout,
      this.player.sprite.x,
      this.player.sprite.y,
      this.enemies,
    );

    this.enemies = this.enemies.filter((e) => e.damageable.alive);
    this.targeting.syncFocusTarget();

    const living = this.enemies.filter((e) => e.damageable.alive).length;
    const focus =
      this.targeting.focusEnemyId && this.targeting.getEnemyById(this.targeting.focusEnemyId)?.damageable.alive
        ? " (focus)"
        : "";
    const mode =
      this.player.mode === "melee"
        ? "Melee"
        : this.player.mode === "ranged"
          ? "Ranged"
          : "Auto combat";
    const auto = this.autoAttackEnabled ? "ON" : "OFF";
    const castPhase = this.spellCaster.getCastPhase();
    const castPct = Math.floor(this.spellCaster.getChannelProgress() * 100);
    this.spellBar.refreshCooldownOverlays();
    if (!this.nightEnded) {
      const dataStore = this.registry.get("dataStore") as DataStore;
      const header = this.isEndlessMode()
        ? this.endlessHudHeader(dataStore)
        : `Night ${this.save.night}`;
      const castLine = (() => {
        if (!castPhase) {
          return this.player.attackPhaseNow !== "idle"
            ? `ATK: ${this.player.attackPhaseNow}`
            : "Spells · tap enemy to focus · drag to move";
        }
        const verb = castPhase === "windup" ? "Casting" : "Channeling";
        return `${verb}… ${castPct}%`;
      })();
      this.hudText.setText(
        [
          `${header} · Wall ${Math.max(0, Math.floor(this.wallHp))}`,
          `HP ${Math.floor(this.player.damageable.hp)}/${this.player.damageable.maxHp}${this.playerInvulnMs > 0 ? " (i-frames)" : ""}`,
          `Enemies ${living}${focus} · ${mode} · Auto ${auto}`,
          castLine,
        ].join("\n"),
      );
    }

    if (this.isEndlessMode()) {
      const endlessEnd = evaluateEndlessEnd({
        nightEnded: this.nightEnded,
        wallHp: this.wallHp,
        playerHp: this.player.damageable.hp,
      });
      if (endlessEnd) {
        this.endEndlessRun(endlessEnd.reason);
      }
    } else {
      const nightEnd = evaluateNightEnd({
        nightEnded: this.nightEnded,
        wallHp: this.wallHp,
        playerHp: this.player.damageable.hp,
        spawnPlanComplete: this.spawnPlanComplete,
        livingEnemies: living,
      });
      if (nightEnd) {
        this.endNight(nightEnd.won);
      }
    }

    if (isE2EEnabled()) {
      publishE2E({
        scene: "Defense",
        ready: true,
        player: this.e2ePlayerPosition(),
        flags: {
          attackPhase: this.e2eAttackPhase(),
          projectileCount: this.e2eProjectileCount(),
          enemyCount: this.e2eEnemyCount(),
        },
      });
    }
  }

  private onSpellAutoCastToggle(slotIndex: number): void {
    const id = this.save.spellBar.slots[slotIndex] ?? "";
    if (!id) return;
    this.save.spellBar.autoCastSpellIds = toggleAutoCastSpellId(
      this.save.spellBar.autoCastSpellIds,
      id,
    );
    this.spellBar.refreshAutoCastBorders(
      this.save.spellBar.slots,
      this.save.spellBar.autoCastSpellIds,
    );
    persistSave(this.save);
  }

  private tryAutoCastSpells(stickX: number, stickY: number): void {
    const moving = isStickMoving(stickX, stickY);
    const pick = pickAutoCastSpell(
      this.save.spellBar.slots,
      this.save.spellBar.autoCastSpellIds,
      moving,
      (id) => this.spellCaster.getCooldownRemaining(id),
      this.spellCaster.isChanneling(),
    );
    if (!pick) return;
    const def = spellById(pick.spellId);
    if (!def) return;
    if (spellTargetMode(def) === "ground") {
      this.groundAim = this.autoCastGroundTarget(def);
    } else if (spellAutoCastNeedsEnemyTarget(def)) {
      const target = this.autoCastEnemyTarget(def);
      if (!target) return;
      this.targeting.setFocusEnemy(target.id);
      this.player.faceToward(target.x, target.y);
    }
    this.beginSpellCast(pick.spellId);
  }

  /** @internal Used by `defense/DefenseSceneE2E` until spell director lands */
  onSpellCastRequest(spellId: string): void {
    if (this.spellCaster.isChanneling()) return;
    const def = spellById(spellId);
    if (!def) return;
    if (
      def.requireEnemyTarget &&
      spellTargetMode(def) === "enemy" &&
      !this.targeting.focusEnemyId
    ) {
      return;
    }
    if (!this.player.canAttack()) {
      this.spellInputQueue.enqueue(spellId);
      return;
    }
    if (
      spellRequiresManualTarget(def) &&
      spellTargetMode(def) === "ground" &&
      !this.pendingGroundCast
    ) {
      this.pendingGroundCast = spellId;
      const aim = this.defaultGroundTarget(def);
      this.groundAim = aim;
      this.groundReticle.showAt(
        aim.x,
        aim.y,
        GroundTargetReticle.radiusForSpell(this, def.blastRadius),
        GroundTargetReticle.styleForSpellId(spellId),
      );
      return;
    }
    this.beginSpellCast(spellId);
  }

  private tryFlushQueuedSpellCast(stickX: number, stickY: number): void {
    if (!this.player.canAttack()) return;
    if (this.spellCaster.isChanneling()) return;
    const spellId = this.spellInputQueue.consumeIfReady(stickX, stickY, spellById);
    if (!spellId) return;
    const def = spellById(spellId);
    if (!def) return;
    if (
      def.requireEnemyTarget &&
      spellTargetMode(def) === "enemy" &&
      !this.targeting.focusEnemyId
    ) {
      return;
    }
    if (spellTargetMode(def) === "ground") {
      this.groundAim = this.defaultGroundTarget(def);
    }
    this.beginSpellCast(spellId);
  }

  private beginSpellCast(spellId: string): void {
    const def = spellById(spellId);
    if (!def || this.spellCaster.isChanneling()) return;
    if (spellTargetMode(def) === "ground") {
      this.spellChannelArea =
        this.groundAim ??
        this.defaultGroundTarget(def);
    } else if (def.mechanicType === "channeled_area") {
      const target = this.targeting.facingTarget("ranged", true);
      this.spellChannelArea = target
        ? { x: target.x, y: target.y }
        : { x: this.player.sprite.x, y: this.player.sprite.y };
    }
    const begun = this.spellCaster.tryBeginCast(spellId);
    if (begun === false) return;
    this.channelAreaStarted = false;
    if (begun === "windup" || begun === "channel") {
      this.player.sprite.setVelocity(0, 0);
      const target = this.targeting.facingTarget("ranged", true);
      if (target) this.player.faceToward(target.x, target.y);
      return;
    }
    if (typeof begun === "object") {
      this.resolveSpellEffect(begun);
    }
    this.pendingGroundCast = null;
    if (!spellNeedsGroundAoeTelegraph(def)) {
      this.groundAim = null;
      this.groundReticle.hide();
    }
  }

  private groundAimEnemies(): {
    id: string;
    x: number;
    y: number;
    radius: number;
    alive: boolean;
  }[] {
    return this.enemies.map((e) => ({
      id: e.id,
      x: e.sprite.x,
      y: e.sprite.y,
      radius: e.sprite.displayWidth * 0.25,
      alive: e.damageable.alive,
    }));
  }

  private autoCastGroundTarget(def: SpellDefinition): { x: number; y: number } {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const maxR = this.wu(def.groundTargetMaxRangeWu ?? 240);
    const strike = this.resolveStrikeMode(this.player.mode === "auto");
    return resolveAutoCastGroundAim(
      px,
      py,
      this.player.getFacingAngle(),
      this.targeting.focusEnemyId,
      this.groundAimEnemies(),
      strike,
      this.wu(PLAYER_TUNING.autoAttackMeleeRange),
      this.wu(PLAYER_TUNING.autoAttackRangedRange),
      maxR,
    );
  }

  private autoCastEnemyTarget(
    def: SpellDefinition,
  ): { id: string; x: number; y: number } | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const searchR = this.wu(
      def.groundTargetMaxRangeWu ?? PLAYER_TUNING.autoAttackRangedRange,
    );
    const strike = this.resolveStrikeMode(this.player.mode === "auto");
    return resolveAutoCastEnemyAim(
      px,
      py,
      this.targeting.focusEnemyId,
      this.groundAimEnemies(),
      strike,
      this.wu(PLAYER_TUNING.autoAttackMeleeRange),
      this.wu(PLAYER_TUNING.autoAttackRangedRange),
      searchR,
    );
  }

  private defaultGroundTarget(def: SpellDefinition): { x: number; y: number } {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const maxR = this.wu(def.groundTargetMaxRangeWu ?? 240);
    return resolveManualDefaultGroundAim(
      px,
      py,
      this.player.getFacingAngle(),
      this.targeting.focusEnemyId,
      this.groundAimEnemies(),
      maxR,
    );
  }

  private clearSpellChannelState(): void {
    this.spellChannelArea = null;
    this.channelAreaStarted = false;
    this.groundAim = null;
    this.groundReticle.hide();
  }

  private clearGroundCastTelegraphs(): void {
    destroySpellGroundAoeTelegraph(this.groundAoeTelegraph);
    this.groundAoeTelegraph = null;
    this.blizzardChannelFx?.destroy();
    this.blizzardChannelFx = null;
  }

  private clearLingerAoeTelegraph(): void {
    destroySpellGroundAoeTelegraph(this.lingerAoeTelegraph);
    this.lingerAoeTelegraph = null;
  }

  private syncGroundCastTelegraphs(
    def: SpellDefinition,
    phase: "windup" | "channeling",
    progress: number,
    deltaMs: number,
  ): void {
    if (!spellNeedsGroundAoeTelegraph(def)) return;
    const center =
      this.spellChannelArea ??
      this.groundAim ??
      this.defaultGroundTarget(def);
    const radiusWu = this.wu(def.blastRadius ?? 72);
    const reticleStyle = GroundTargetReticle.styleForSpellId(def.id);
    if (phase === "windup") {
      this.groundReticle.showAt(center.x, center.y, radiusWu, reticleStyle);
    } else {
      this.groundReticle.hide();
    }
    const telegraphMode = phase === "windup" ? "windup" : "channel";
    if (!this.groundAoeTelegraph) {
      this.groundAoeTelegraph = spawnSpellGroundAoeTelegraph(
        this,
        center.x,
        center.y,
        radiusWu,
        spellGroundAoePalette(def),
        spellCastMs(def),
        telegraphMode,
      );
    } else {
      this.groundAoeTelegraph.zoneX = center.x;
      this.groundAoeTelegraph.zoneY = center.y;
      this.groundAoeTelegraph.zoneRadius = radiusWu;
    }
    updateSpellGroundAoeTelegraph(
      this.groundAoeTelegraph,
      deltaMs,
      telegraphMode,
      progress,
    );
    if (def.id === "blizzard" && phase === "channeling") {
      if (!this.blizzardChannelFx) {
        this.blizzardChannelFx = new SpellBlizzardChannelFx(this);
        this.blizzardChannelFx.start(
          center.x,
          center.y,
          radiusWu,
          SpellBlizzardChannelFx.defaultTextureKey(),
        );
      }
    } else if (this.blizzardChannelFx) {
      this.blizzardChannelFx.stop();
    }
  }

  private pulseImpactAoeTelegraph(
    def: SpellDefinition,
    x: number,
    y: number,
  ): void {
    const radiusWu = this.wu(def.blastRadius ?? 72);
    const impact = spawnSpellGroundAoeTelegraph(
      this,
      x,
      y,
      radiusWu,
      spellGroundAoePalette(def),
      1,
      "impact",
    );
    updateSpellGroundAoeTelegraph(impact, 0, "impact", 1);
    this.time.delayedCall(360, () => destroySpellGroundAoeTelegraph(impact));
  }

  private startChanneledGroundZone(def: SpellDefinition): void {
    if (this.channelAreaStarted) return;
    const mult = this.spellDamageMult();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const center = this.spellChannelArea ?? { x: px, y: py };
    if (def.mechanicType === "channeled_area" || def.mechanicType === "channeled") {
      this.spellGroundZones.push(
        spawnGroundZone(this, def, center.x, center.y, mult, this.time.now, {
          durationMs: def.channelMs,
          tickDamageScale: def.mechanicType === "channeled" ? 0.35 : 0.4,
          includeBurst: Boolean(def.burstDamage),
        }),
      );
      this.channelAreaStarted = true;
      if (def.mechanicType === "channeled_area") {
        this.flashNova(center.x, center.y, this.wu(def.blastRadius ?? 78), {
          blastTextureKey: COMBAT_FX_TEXTURE.spellFireNova,
        });
      }
    }
  }

  private spawnPostChannelLinger(def: SpellDefinition): void {
    if (!def.lingerMs || def.lingerMs <= 0) return;
    const center = this.spellChannelArea ?? {
      x: this.player.sprite.x,
      y: this.player.sprite.y,
    };
    this.spellGroundZones.push(
      spawnGroundZone(
        this,
        def,
        center.x,
        center.y,
        this.spellDamageMult(),
        this.time.now,
        {
          durationMs: def.lingerMs,
          lingerDot: true,
          tickDamageScale: 0,
        },
      ),
    );
    this.clearLingerAoeTelegraph();
    const radiusWu = this.wu(def.blastRadius ?? 78);
    this.lingerAoeTelegraph = spawnSpellGroundAoeTelegraph(
      this,
      center.x,
      center.y,
      radiusWu,
      spellGroundAoePalette(def),
      1,
      "channel",
    );
    updateSpellGroundAoeTelegraph(this.lingerAoeTelegraph, 0, "channel", 1);
    this.flashNova(center.x, center.y, radiusWu, {
      blastTextureKey: COMBAT_FX_TEXTURE.spellFireNova,
    });
    const lingerMs = def.lingerMs ?? 0;
    if (lingerMs > 0) {
      this.time.delayedCall(lingerMs, () => this.clearLingerAoeTelegraph());
    }
  }

  private spellDamageMult(): number {
    const mult = playerDamageMult(this.save.buildings);
    return this.shadowformEndsAt > this.time.now ? mult * SHADOWFORM_DAMAGE_MULT : mult;
  }

  private resolveSpellEffect(def: SpellDefinition): void {
    const mult = this.spellDamageMult();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const angle = this.player.getFacingAngle();
    const targets = this.enemyTargets();
    switch (def.mechanicType) {
      case "blast": {
        const remote = def.id === "meteor" ? this.spellChannelArea : null;
        const bx = remote?.x ?? px;
        const by = remote?.y ?? py;
        applySpellBlastAt(this, bx, by, def, targets, mult, 140, this.enemySpellStatus);
        this.flashNova(bx, by, this.wu(def.blastRadius ?? 80), {
          blastTextureKey:
            def.id === "meteor"
              ? COMBAT_FX_TEXTURE.spellShockwave
              : def.blastTextureKey,
        });
        if (def.id === "frost_nova") this.applyFrostNovaRoot();
        break;
      }
      case "projectile":
      case "projectile_aoe": {
        const id = `spell_proj_${this.projectileSerial++}`;
        this.projectiles.push(
          spawnSpellProjectile(this, px, py, angle, def, mult, id),
        );
        break;
      }
      case "tracking_projectile": {
        const focus = this.targeting.focusEnemyId;
        const id = `spell_proj_${this.projectileSerial++}`;
        this.projectiles.push(
          spawnSpellProjectile(this, px, py, angle, def, mult, id, {
            behavior: "tracking",
            trackEnemyId: focus,
          }),
        );
        if (def.id === "chain_lightning") {
          applyChainLightning(
            this,
            px,
            py,
            def,
            targets,
            mult,
            focus,
          );
        }
        break;
      }
      case "swing":
      case "tracking_swing": {
        if (def.mechanicType === "tracking_swing") {
          const t = this.targeting.facingTarget("melee", true);
          if (t) this.player.faceToward(t.x, t.y);
        }
        applySpellSwing(
          this,
          px,
          py,
          this.player.getFacingAngle(),
          def,
          targets,
          mult,
          this.enemySpellStatus,
        );
        break;
      }
      case "cone":
        applySpellCone(this, px, py, angle, def, targets, mult, this.enemySpellStatus);
        break;
      case "channeled":
      case "channeled_area":
        break;
      case "instant_targeted": {
        const hitId = applyInstantTargeted(
          this,
          def,
          targets,
          this.targeting.focusEnemyId,
          px,
          py,
          mult,
          this.enemySpellStatus,
        );
        if (def.projectileTextureKey) {
          const t = hitId ? this.targeting.getEnemyById(hitId) : null;
          const tx = t?.sprite.x ?? px + Math.cos(angle) * 40;
          const ty = t?.sprite.y ?? py + Math.sin(angle) * 40;
          const aim = Math.atan2(ty - py, tx - px);
          const id = `spell_proj_${this.projectileSerial++}`;
          this.projectiles.push(
            spawnSpellProjectile(this, px, py, aim, def, mult, id),
          );
        }
        break;
      }
      case "heal":
        applyChanneledHeal(this.player.damageable, def);
        break;
      case "blink":
        this.castBlink(angle);
        break;
      case "buff":
        if (def.id === "shadowform") {
          this.shadowformEndsAt = this.time.now + SHADOWFORM_DURATION_MS;
        }
        break;
      case "ice_wall":
        this.spawnIceWall(angle);
        break;
      default:
        break;
    }
    this.enemies = this.enemies.filter((e) => e.damageable.alive);
  }

  private applyFrostNovaRoot(): void {
    const def = spellById("frost_nova");
    const rootMs = def?.onHit?.rootMs ?? FROST_ROOT_MS;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const r = this.wu(def?.blastRadius ?? 85);
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
      if (d <= r + this.wu(ENTITY_BODY_RADIUS.enemy)) {
        this.enemySpellStatus.applyRoot(e.id, rootMs);
      }
    }
  }

  private castBlink(facingRad: number): void {
    const halfW = defenseHalfWidth();
    const halfH = defenseHalfHeight();
    const dst = blinkDestination(
      this.player.sprite.x,
      this.player.sprite.y,
      facingRad,
      this.wu(BLINK_DISTANCE_WU),
      { minX: -halfW + 24, maxX: halfW - 24, minY: -halfH + 24, maxY: halfH - 24 },
    );
    this.player.sprite.setPosition(dst.x, dst.y);
  }

  private spawnIceWall(facingRad: number): void {
    const dist = this.wu(ICE_WALL_DISTANCE_WU);
    const cx = this.player.sprite.x + Math.cos(facingRad) * dist;
    const cy = this.player.sprite.y + Math.sin(facingRad) * dist;
    const perpX = -Math.sin(facingRad);
    const perpY = Math.cos(facingRad);
    const gap = this.wu(28);
    const key = COMBAT_FX_TEXTURE.spellIceBolt;
    for (let i = -1; i <= 1; i++) {
      const x = cx + perpX * gap * i;
      const y = cy + perpY * gap * i;
      const block = this.physics.add.staticImage(x, y, key);
      const size = this.wu(20);
      block.setDisplaySize(size, size);
      block.setDepth(DEFENSE_RENDER_DEPTH.obstacleBlock);
      block.refreshBody();
      this.obstacleGroup.add(block);
      this.iceWallExpires.push({
        sprite: block,
        expiresAt: this.time.now + ICE_WALL_DURATION_MS,
      });
    }
  }

  private tickIceWalls(): void {
    const now = this.time.now;
    this.iceWallExpires = this.iceWallExpires.filter((entry) => {
      if (entry.expiresAt > now) return true;
      this.obstacleGroup.remove(entry.sprite, true, true);
      return false;
    });
  }

  private flashNova(
    x: number,
    y: number,
    radius: number,
    def?: { blastTextureKey?: string },
  ): void {
    const key = def?.blastTextureKey;
    if (!key || !this.textures.exists(key)) {
      console.warn(
        `spell blast missing MobileRPG texture${key ? `: ${key}` : ""}`,
      );
      return;
    }
    const sprite = this.add
      .image(x, y, key)
      .setDepth(DEFENSE_RENDER_DEPTH.playerCombatFx)
      .setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    const size = radius * 2.2;
    sprite.setDisplaySize(size, size);
    this.tweens.add({
      targets: sprite,
      alpha: 0,
      scale: 1.25,
      duration: 320,
      ease: "Quad.easeOut",
      onComplete: () => sprite.destroy(),
    });
  }

  private manualAttack(): void {
    if (this.spellCaster.isChanneling()) return;
    const strike =
      this.player.mode === "auto"
        ? this.resolveStrikeMode(true)
        : this.player.mode === "ranged"
          ? "ranged"
          : "melee";
    const target = this.targeting.facingTarget(strike, true);
    if (target) this.player.faceToward(target.x, target.y);
    this.player.tryStartAttack(this.player.mode === "auto" ? strike : undefined);
  }

  /** Keep melee arc aimed at the auto target while the player can still move. */
  private shouldLockMeleeAimFacing(): boolean {
    if (this.player.attackPhaseNow === "idle") return false;
    if (this.player.strikeMode() !== "melee") return false;
    return this.autoAttackEnabled || this.player.mode === "auto";
  }

  private tryAutoAttack(): void {
    if (this.spellCaster.isChanneling()) return;
    const autoCombat = this.player.mode === "auto";
    if (!this.autoAttackEnabled && !autoCombat) return;
    if (!this.player.canAttack()) return;
    const strike = this.resolveStrikeMode(autoCombat);
    const target = this.targeting.facingTarget(strike, false);
    if (!target) return;
    this.player.faceToward(target.x, target.y);
    this.player.tryStartAttack(autoCombat ? strike : undefined);
  }

  private resolveStrikeMode(autoCombat: boolean): "melee" | "ranged" {
    if (!autoCombat) {
      return this.player.mode === "ranged" ? "ranged" : "melee";
    }
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    let bestMelee: number | null = null;
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
      if (d > this.wu(PLAYER_TUNING.autoAttackMeleeRange)) continue;
      if (bestMelee === null || d < bestMelee) bestMelee = d;
    }
    return bestMelee !== null ? "melee" : "ranged";
  }

  /** @internal Used by `defense/DefenseSceneE2E` until targeting module lands */
  onScreenTap(pointer: Phaser.Input.Pointer): void {
    const tapResult = this.stick.tryConsumeTap(pointer);
    if (this.targeting.isPointerOverUi(pointer)) return;
    if (this.pendingGroundCast && tapResult.kind !== "drag") {
      const screenX = tapResult.kind === "tap" ? tapResult.x : pointer.x;
      const screenY = tapResult.kind === "tap" ? tapResult.y : pointer.y;
      const world = cameraWorldPoint(this.cameras.main, screenX, screenY);
      const def = spellById(this.pendingGroundCast);
      if (def) {
        const px = this.player.sprite.x;
        const py = this.player.sprite.y;
        const maxR = this.wu(def.groundTargetMaxRangeWu ?? 240);
        this.groundAim = clampGroundTarget(px, py, world.x, world.y, maxR);
        const spellId = this.pendingGroundCast;
        this.pendingGroundCast = null;
        this.beginSpellCast(spellId);
      }
      return;
    }
    if (this.targeting.focusSelectLockMs > 0) return;
    if (tapResult.kind === "drag") return;

    const screenX = tapResult.kind === "tap" ? tapResult.x : pointer.x;
    const screenY = tapResult.kind === "tap" ? tapResult.y : pointer.y;

    const world = cameraWorldPoint(this.cameras.main, screenX, screenY);
    const pick = this.targeting.findEnemyNearWorldPoint(world.x, world.y);
    if (showTouchInput(this.registry)) {
      this.focusTapFlash = {
        screenX,
        screenY,
        worldX: world.x,
        worldY: world.y,
        picked: pick !== null,
        pickRadiusWorld: this.wu(PLAYER_TUNING.targetTapRadiusWorld),
        ageMs: 0,
      };
    }
    this.targeting.trySelectEnemyAt(world.x, world.y);
  }

  private openDebugMenu(): void {
    this.setHudChromeVisible(false);
    pauseForDebugMenu(this);
    this.scene.launch("DebugMenu");
  }

  private transitionToTown(): void {
    transitionDefenseToTown(this);
  }

  private nightEndContext() {
    return {
      scene: this,
      registry: this.registry,
      save: this.save,
      player: this.player,
      wallHp: this.wallHp,
      hudText: this.hudText,
      safe: this.safe,
      markNightEnded: () => {
        this.nightEnded = true;
      },
      setEndlessSelectionsNull: () => {
        this.endlessSelections = null;
      },
      hideLeaveEndlessBtn: () => {
        if (this.leaveEndlessBtn) {
          this.leaveEndlessBtn.container.setVisible(false);
          this.leaveEndlessBtn.container.disableInteractive();
        }
      },
      setReturnToTownBtn: (btn: TouchButtonHandle | null) => {
        this.returnToTownBtn = btn;
      },
      onReturnToTown: () => this.transitionToTown(),
    };
  }

  private syncMeleeSwipeFx(): void {
    const phase = this.player.attackPhaseNow;
    if (
      phase === "active" &&
      this.prevPlayerAttackPhase !== "active" &&
      this.player.strikeMode() === "melee"
    ) {
      showPlayerMeleeSwipe(
        this,
        this.player.sprite.x,
        this.player.sprite.y,
        this.player.getFacingAngle(),
        PLAYER_TUNING.meleeActiveMs,
      );
      playPlayerMeleeSlashSfx(this);
    }
    this.prevPlayerAttackPhase = phase;
  }

  private fireProjectile(damage: number): void {
    const angle = this.player.getFacingAngle();
    const id = `p_${this.projectileSerial++}`;
    const p = spawnPlayerProjectile(
      this,
      this.player.sprite.x,
      this.player.sprite.y,
      angle,
      PLAYER_TUNING.projectileSpeed,
      damage,
      this.wu(PLAYER_TUNING.rangedMaxRange),
      id,
    );
    this.projectiles.push(p);
  }

  private enemyTargets() {
    return this.enemies.map((e) => ({
      id: e.id,
      x: e.sprite.x,
      y: e.sprite.y,
      radius: this.wu(ENTITY_BODY_RADIUS.enemy),
      damageable: e.damageable,
      sprite: e.sprite,
    }));
  }

  private drawTouchDebug(delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      this.focusTapFlash = null;
      return;
    }
    if (this.focusTapFlash) {
      this.focusTapFlash = {
        ...this.focusTapFlash,
        ageMs: this.focusTapFlash.ageMs + delta,
      };
      if (this.focusTapFlash.ageMs >= 900) this.focusTapFlash = null;
    }
    this.touchDebug.draw({
      stick: this.stick,
      pointerUiBlocked: (p) => this.targeting.isPointerOverUi(p),
      focusFlash: this.focusTapFlash,
    });
  }

  private drawEnemyPaths(): void {
    if (!showEnemyPaths(this.registry)) {
      this.pathDebug.clear();
      return;
    }
    this.pathDebug.clear();
    this.pathDebug.drawObstacleZones(
      this.navGrid,
      scaledDefenseObstacles(this.registry),
    );
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const goal = this.enemyPathGoals.get(e.id);
      if (!goal) continue;
      this.pathDebug.drawEnemy(e, goal.targetKind, goal.x, goal.y);
    }
  }

  private drawDebugHitboxes(): void {
    if (!showHitboxes(this.registry)) {
      this.hitboxDebug.clear();
      return;
    }
    this.hitboxDebug.clear();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.hitboxDebug.drawCircle(px, py, this.wu(ENTITY_BODY_RADIUS.player));

    if (
      this.player.mode === "melee" &&
      this.player.attackPhaseNow === "active"
    ) {
      const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.meleeArcDeg / 2);
      this.hitboxDebug.drawMeleeArc(
        px,
        py,
        this.player.getFacingAngle(),
        this.wu(PLAYER_TUNING.meleeRange),
        arcHalf,
      );
    }

    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      this.hitboxDebug.drawCircle(
        e.sprite.x,
        e.sprite.y,
        this.wu(ENTITY_BODY_RADIUS.enemy),
      );
      if (e.combat.phase === "active") {
        const arcHalf = Phaser.Math.DegToRad(e.combatTuning.melee.arcDeg / 2);
        this.hitboxDebug.drawMeleeArc(
          e.sprite.x,
          e.sprite.y,
          e.combat.facing,
          e.combatTuning.melee.range,
          arcHalf,
        );
      }
    }

    for (const p of this.projectiles) {
      if (p.sprite.active) {
        this.hitboxDebug.drawCircle(p.sprite.x, p.sprite.y, 10);
      }
    }
  }

  /** @internal Used by `defense/DefenseSceneE2E` until HUD controller lands */
  refreshModeToggle!: (mode: AttackMode) => void;

  private endlessHudHeader(store: DataStore): string {
    const sels = this.endlessSelections ?? [];
    if (sels.length === 0) return "Endless";
    const first = store.enemies[sels[0]!.enemyId]?.displayName ?? sels[0]!.enemyId;
    if (sels.length === 1) return `Endless · ${first}`;
    return `Endless · ${first} +${sels.length - 1}`;
  }

  private livingCountByEndlessEnemyId(): Map<string, number> {
    const map = new Map<string, number>();
    for (const sel of this.endlessSelections ?? []) {
      map.set(sel.enemyId, countLivingWithDefId(this.enemies, sel.enemyId));
    }
    return map;
  }

  private ensureEndlessSpawnCap(): void {
    if (!this.endlessSelections?.length || this.nightEnded) return;
    const store = this.registry.get("dataStore") as DataStore;
    const living = this.livingCountByEndlessEnemyId();
    const plan = planEndlessSpawns(this.endlessSelections, living);
    for (const entry of plan) {
      if (entry.spawnCount <= 0) continue;
      const def = store.enemies[entry.enemyId];
      if (!def) continue;
      for (let i = 0; i < entry.spawnCount; i++) {
        const { x, y } = pickWaveSpawnPoint(isE2EEnabled());
        this.spawnEnemyAt(x, y, def, entry.enemyId);
      }
    }
  }

  private scheduleEndlessRespawn(): void {
    if (!this.isEndlessMode() || this.nightEnded) return;
    this.time.delayedCall(0, () => this.ensureEndlessSpawnCap());
  }

  private scheduleWave(
    store: DataStore,
    wave: import("../core/DataStore").WaveDef,
  ): void {
    scheduleDefenseWave(
      this,
      store,
      wave,
      {
        spawnEnemy: (x, y, def, defId) => this.spawnEnemyAt(x, y, def, defId),
        markSpawnPlanComplete: () => {
          this.spawnPlanComplete = true;
        },
      },
      isE2EEnabled(),
    );
  }

  private enemySpawnerHost(): DefenseEnemySpawnerHost {
    const store = this.registry.get("dataStore") as DataStore;
    return {
      scene: this,
      dataStore: store,
      enemies: this.enemies,
      enemyGroup: this.enemyGroup,
      hooks: {
        onRemovedFromPlay: () => this.scheduleEndlessRespawn(),
        onFocusEnemy: (id) => this.targeting.setFocusEnemy(id),
      },
    };
  }

  /** @internal Used by e2e and wave spawner until spawner API stabilizes */
  spawnEnemyAt(
    x: number,
    y: number,
    def?: EnemyDef,
    defId = "grunt",
    hpOverride?: number,
  ): void {
    spawnDefenseEnemyAt(this.enemySpawnerHost(), x, y, def, defId, hpOverride);
  }

  /** @internal Used by `defense/DefenseSceneE2E` until night-end module lands */
  endEndlessRun(reason: "quit" | "player" | "wall"): void {
    if (this.nightEnded) return;
    runDefenseEndlessNightEnd(this.nightEndContext(), reason);
  }

  /** @internal Used by `defense/DefenseSceneE2E` until night-end module lands */
  endNight(won: boolean): void {
    if (this.nightEnded) return;
    runDefenseCampaignNightEnd(this.nightEndContext(), {
      won,
      wallHp: this.wallHp,
      wallHpStart: this.wallHpStart,
      rewardGold: this.rewardGold,
      save: this.save,
    });
  }

  private e2eDelegate(): DefenseSceneE2eDelegate {
    return this as unknown as DefenseSceneE2eDelegate;
  }

  e2eIsReady(): boolean { return defenseSceneE2eIsReady(this.e2eDelegate()); }
  e2eBottomChromeTextureKey(): string | null { return defenseSceneE2eBottomChromeTextureKey(); }
  e2eSetStick(dx: number, dy: number): void { defenseSceneE2eSetStick(this.e2eDelegate(), dx, dy); }
  e2ePlayerPosition() { return defenseSceneE2ePlayerPosition(this.e2eDelegate()); }
  e2eAttackPhase(): string { return defenseSceneE2eAttackPhase(this.e2eDelegate()); }
  e2eProjectileCount(): number { return defenseSceneE2eProjectileCount(this.e2eDelegate()); }
  e2eEnemyCount(): number { return defenseSceneE2eEnemyCount(this.e2eDelegate()); }
  e2eWallHp(): number { return defenseSceneE2eWallHp(this.e2eDelegate()); }
  e2eTapMelee(): void { defenseSceneE2eTapMelee(this.e2eDelegate()); }
  e2eTapRanged(): void { defenseSceneE2eTapRanged(this.e2eDelegate()); }
  e2eCastSpellSlot(slot: number): Promise<void> { return defenseSceneE2eCastSpellSlot(this.e2eDelegate(), slot); }
  e2eSpawnEnemy(offX?: number, offY?: number): void { defenseSceneE2eSpawnEnemy(this.e2eDelegate(), offX, offY); }
  e2eDamagePlayer(amount: number): void { defenseSceneE2eDamagePlayer(this.e2eDelegate(), amount); }
  e2eIsEndlessMode(): boolean { return defenseSceneE2eIsEndlessMode(this.e2eDelegate()); }
  e2eEndlessEnemyId(): string | null { return defenseSceneE2eEndlessEnemyId(this.e2eDelegate()); }
  e2eEndlessEnemyIds(): string[] { return defenseSceneE2eEndlessEnemyIds(this.e2eDelegate()); }
  e2eKillAllEnemies(): void { defenseSceneE2eKillAllEnemies(this.e2eDelegate()); }
  e2eSetSpawnPlanComplete(): void { defenseSceneE2eSetSpawnPlanComplete(this.e2eDelegate()); }
  e2eForceWinNight(): void { defenseSceneE2eForceWinNight(this.e2eDelegate()); }
  e2eSetManualReturn(on: boolean): void { defenseSceneE2eSetManualReturn(this.e2eDelegate(), on); }
  e2eNightEnded(): boolean { return defenseSceneE2eNightEnded(this.e2eDelegate()); }
  e2eHasReturnButton(): boolean { return defenseSceneE2eHasReturnButton(this.e2eDelegate()); }
  e2eHasLeaveEndlessButton(): boolean { return defenseSceneE2eHasLeaveEndlessButton(this.e2eDelegate()); }
  e2eSimulateScreenTap(x: number, y: number): void { defenseSceneE2eSimulateScreenTap(this.e2eDelegate(), x, y); }
  e2eGetUiTapTargets() { return defenseSceneE2eGetUiTapTargets(this.e2eDelegate()); }
  e2eGetSpellSlotHitRects() { return defenseSceneE2eGetSpellSlotHitRects(this.e2eDelegate()); }
  e2eAutoAttackEnabled(): boolean { return defenseSceneE2eAutoAttackEnabled(this.e2eDelegate()); }
  e2eIsTouchButtonPressed(testId: string): boolean { return defenseSceneE2eIsTouchButtonPressed(this.e2eDelegate(), testId); }
  e2eSetPlayerPosition(x: number, y: number): void { defenseSceneE2eSetPlayerPosition(this.e2eDelegate(), x, y); }
  e2eGetDefenseCameraScroll() { return defenseSceneE2eGetDefenseCameraScroll(this.e2eDelegate()); }
  e2eSetShowEnemyPaths(on: boolean): void { defenseSceneE2eSetShowEnemyPaths(this.e2eDelegate(), on); }
  e2eGetObstacleAlignment() { return defenseSceneE2eGetObstacleAlignment(this.e2eDelegate()); }

}