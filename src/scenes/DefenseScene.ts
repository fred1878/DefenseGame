import Phaser from "phaser";
import {
  DEFENSE_MAP,
  DEFENSE_RENDER_DEPTH,
  PLAYER_TUNING,
  type AttackMode,
} from "../config";
import {
  createDefaultSpellBarAutoCast,
  createDefaultSpellBarSlots,
  spellById,
} from "../content/spells";
import type { SaveGame } from "../core/saveTypes";
import { DataStore, type EnemyDef, type WaveDef } from "../core/DataStore";
import { playerDamageMult } from "../core/GameState";
import {
  type EndlessRunSelection,
  readDefenseRunMode,
  resolveEndlessRunSelections,
} from "../core/defenseRunMode";
import { applyDamage } from "../combat/DamageSystem";
import { showPlayerMeleeSwipe } from "../combat/MeleeSwipeFx";
import { SpellInputQueue } from "../combat/spellInputQueue";
import { SpellCastController } from "../combat/SpellCastController";
import { EnemySpellStatusMap } from "../combat/enemySpellStatus";
import {
  groundAimFromWorldPoint,
  pointerInDefensePlayArea,
} from "./defense/defenseGroundAimInput";
import { buildNavGrid, type NavGrid } from "../pathfinding/grid";
import { correctPlayerObstacleBlockerOverlap } from "../world/defenseObstacleBlocker";
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
import {
  blocksBaseLayerInput,
  clearInputModalities,
  INPUT_MODALITY,
  INPUT_MODALITY_CHANGED,
  isInputModalityActive,
  popInputModality,
  pushInputModality,
} from "../input/inputModality";
import { setContainerInputEnabled } from "../input/setContainerInputEnabled";
import { collectInteractiveScreenRects } from "../debug/collectInteractiveScreenRects";
import { HitboxDebugDraw } from "../debug/HitboxDebugDraw";
import {
  enemyShouldDrawMeleeArcOverlay,
  enemyUsesMeleePlayerActivationRange,
} from "../entities/EnemyCombat";
import { PathDebugDraw } from "../debug/PathDebugDraw";
import {
  TouchInputDebugDraw,
  type FocusTapFlash,
} from "../debug/TouchInputDebugDraw";
import {
  enemyCollisionBodyRadius,
  playerBodyRadiusPx,
} from "../entities/entityPhysics";
import {
  updateEnemySpriteFacing,
  type EnemyInstance,
} from "../entities/Enemy";
import { destroyArrowRainTelegraph } from "../combat/ArrowRainTelegraph";
import { SpellBlizzardChannelFx } from "../combat/SpellBlizzardChannelFx";
import {
  updateSpellGroundAoeTelegraph,
  type SpellGroundAoeTelegraph,
} from "../combat/SpellGroundAoeTelegraph";
import {
  projectileArcadeRadiusPx,
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
  tickSpellGroundZones,
  type SpellGroundZone,
} from "../combat/spellGroundZone";
import { pickWaveSpawnPoint } from "../world/defenseSpawns";
import {
  cameraWorldPoint,
  defensePlayAreaLayout,
  type SafeInsets,
} from "../ui/screenLayout";
import {
  destroyEnemyNameplate,
  updateEnemyNameplate,
} from "../ui/enemyNameplate";
import {
  worldDisplayPx,
  worldUnit,
} from "../core/worldPixelScale";
import type { TouchButtonHandle } from "../ui/touchButton";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { SPRITE_DISPLAY } from "../content/assets";
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
  defenseSceneE2eGetSpellSlotHitRects,
  defenseSceneE2eGetUiTapTargets,
  defenseSceneE2eHudLayoutProbe,
  defenseSceneE2eSampleHudBandPixelsAsync,
  defenseSceneE2eWorldPointToScreen,
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
  defenseSceneE2eObstacleBlockerAabb,
  defenseSceneE2eObstacleArcadeBodyAabb,
  defenseSceneE2ePlayerBodyRadius,
  defenseSceneE2eMaxPlayerObstacleOverlapPx,
  defenseSceneE2eCenterCameraOn,
  defenseSceneE2eObstacleBumpProbe,
  defenseSceneE2eFlushTangentPosition,
  defenseSceneE2eResolvePlayerObstacleOverlap,
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
  runDefenseSimulatedNightEnd,
  transitionDefenseToTown,
} from "./defense/DefenseNightEnd";
import { DefenseTargeting } from "./defense/DefenseTargeting";
import { createDefenseHudController } from "./defense/DefenseHudController";
import { bootstrapDefenseWorld } from "./defense/DefenseWorldBootstrap";
import { tickDefenseProjectiles } from "./defense/DefenseProjectileTick";
import { tickDefenseEnemies } from "./defense/DefenseEnemyTick";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./defense/DefenseSpellDirector";

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
  private groundAimPointerId: number | null = null;
  private groundAimFromUiBand = false;
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
  private onPointerDownBound = (p: Phaser.Input.Pointer) =>
    this.onGroundAimPointerDown(p);
  private onPointerMoveBound = (p: Phaser.Input.Pointer) =>
    this.onGroundAimPointerMove(p);
  private setHudChromeVisible = (visible: boolean): void => {
    this.hudSetChromeVisible?.(visible);
  };
  private hudSetChromeVisible: ((visible: boolean) => void) | null = null;
  private readonly onInputModalityChanged = (): void =>
    this.syncDefenseBaseInput();
  private onDebugMenuClose = (): void => {
    popInputModality(this, INPUT_MODALITY.debugMenu.id);
    this.setHudChromeVisible(true);
    resumeFromDebugMenu(this);
  };
  private onDefenseShutdown = (): void => {
    this.events.off(INPUT_MODALITY_CHANGED, this.onInputModalityChanged);
    this.game.events.off(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
    clearInputModalities(this);
    this.input?.off("pointerup", this.onPointerUpBound);
    this.input?.off("pointerdown", this.onPointerDownBound);
    this.input?.off("pointermove", this.onPointerMoveBound);
    this.stick?.destroy(this);
    this.targetIndicator?.destroy();
    this.groundReticle?.destroy();
    this.clearGroundCastTelegraphs();
    this.clearLingerAoeTelegraph();
    this.castBar?.destroy();
    this.spellBar?.destroy();
    this.hitboxDebug?.destroy();
    this.pathDebug?.destroy();
    this.touchDebug?.destroy();
    this.minimap?.destroy();
    this.returnToTownBtn?.container.destroy();
    this.returnToTownBtn = null;
    this.leaveEndlessBtn?.container.destroy();
    this.leaveEndlessBtn = null;
    this.debugBtn?.container.destroy();
    this.uiCamera?.destroy();
    for (const p of this.projectiles) p.sprite.destroy();
    this.projectiles = [];
    for (const p of this.enemyProjectiles) p.sprite.destroy();
    this.enemyProjectiles = [];
    for (const e of this.enemies) {
      destroyArrowRainTelegraph(e.arrowRain?.telegraph);
      destroyArrowRainTelegraph(e.lobber?.telegraph);
      e.sprite.destroy();
      destroyEnemyNameplate(e.nameplate);
    }
    this.enemies = [];
  };
  private prevPlayerAttackPhase: AttackPhase = "idle";
  obstacleBlockers: import("../config/defense").DefenseObstacleRect[] = [];
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  hudChrome!: CombatHudChrome;
  private minimap!: DefenseMinimap;
  private minimapLayout!: ReturnType<typeof defenseMinimapLayout>;
  private endlessSelections: EndlessRunSelection[] | null = null;
  private wavePlannerMode = false;
  private leaveEndlessBtn: TouchButtonHandle | null = null;
  private endlessInfiniteHp = false;
  private registerWorldDraw!: (go: Phaser.GameObjects.GameObject) => void;
  private registerUiDraw!: (go: Phaser.GameObjects.GameObject) => void;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

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
    this.syncDefenseGroundAimModality();
    this.groundAim = null;
    this.groundAimPointerId = null;
    this.groundAimFromUiBand = false;
    this.shadowformEndsAt = 0;
    for (const wall of this.iceWallExpires) wall.sprite.destroy();
    this.iceWallExpires = [];
    this.endlessSelections = null;
    this.wavePlannerMode = false;
    this.leaveEndlessBtn = null;
    this.endlessInfiniteHp = false;
  }

  /** @internal Used by `defense/DefenseSceneE2E` until night/spawn modules land */
  isEndlessMode(): boolean {
    return (this.endlessSelections?.length ?? 0) > 0;
  }

  isWavePlannerMode(): boolean {
    return this.wavePlannerMode;
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
    const store = this.registry.get("dataStore") as DataStore;
    const runMode = readDefenseRunMode(this.registry);
    const endless = runMode.kind === "endless";
    const wavePlanner = runMode.kind === "wavePlanner";
    let plannerWave: WaveDef | undefined;
    if (endless) {
      this.endlessSelections = resolveEndlessRunSelections(runMode.selections);
      this.rewardGold = 0;
      if (runMode.infiniteHp === true) {
        this.endlessInfiniteHp = true;
      }
    } else if (wavePlanner) {
      this.wavePlannerMode = true;
      this.rewardGold = 0;
      plannerWave = { rewardGold: 0, groups: runMode.groups };
    }
    const wave = endless
      ? undefined
      : wavePlanner
        ? plannerWave
        : store.getWaveForNight(this.save.night);
    if (wave && !wavePlanner) this.rewardGold = wave.rewardGold;

    const world = bootstrapDefenseWorld({
      scene: this,
      night: this.save.night,
      playerHpMax: this.save.player.hpMax,
      endless,
    });
    this.player = world.player;
    this.playerInvulnMs = world.playerInvulnMs;
    this.obstacleBlockers = world.obstacleBlockers;
    this.obstacleGroup = world.obstacleGroup;
    this.enemyGroup = world.enemyGroup;
    const onObstacleWorldStep = (): void => {
      correctPlayerObstacleBlockerOverlap(
        this.player.sprite,
        this.obstacleBlockers,
      );
    };
    this.physics.world.on(
      Phaser.Physics.Arcade.Events.WORLD_STEP,
      onObstacleWorldStep,
    );
    this.events.once("shutdown", () => {
      this.physics.world?.off(
        Phaser.Physics.Arcade.Events.WORLD_STEP,
        onObstacleWorldStep,
      );
    });
    this.navGrid = buildNavGrid(
      this.obstacleBlockers,
      worldUnit(DEFENSE_MAP.cellSize, this.registry),
      worldUnit(DEFENSE_MAP.pathClearancePx, this.registry),
    );
    this.registerWorldDraw = world.registerWorldDraw;
    this.registerUiDraw = world.registerUiDraw;
    this.uiCamera = world.cameraRig.uiCamera;

    const hud = createDefenseHudController({
      scene: this,
      save: this.save,
      player: this.player,
      endless,
      wavePlanner,
      registerUiDraw: world.registerUiDraw,
      onManualAttack: () => this.manualAttack(),
      onSpellCastRequest: (id) => this.onSpellCastRequest(id),
      onSpellAutoCastToggle: (slot) => this.onSpellAutoCastToggle(slot),
      onGroundCastArm: (id, pointer) => this.onGroundCastArm(id, pointer),
      onGroundCastCancel: () => this.cancelPendingGroundCast(),
      onOpenDebugMenu: () => this.openDebugMenu(),
      onLeaveEndless: () => this.leaveTrainingRun(),
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
    this.registerWorldDraw(this.targetIndicator.worldRoot());
    this.targeting = new DefenseTargeting({
      scene: this,
      registry: this.registry,
      scale: this.scale,
      input: this.input,
      player: this.player,
      getEnemies: () => this.enemies,
      targetIndicator: this.targetIndicator,
      uiBlockers: this.uiBlockers,
      safe: this.safe,
      wu: (n) => this.wu(n),
    });
    this.groundReticle = new GroundTargetReticle(this);
    this.registerWorldDraw(this.groundReticle.worldGraphics());
    this.spellDirector = new DefenseSpellDirector(this.buildSpellHost());
    this.hitboxDebug = new HitboxDebugDraw(this);
    this.pathDebug = new PathDebugDraw(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.registerWorldDraw(this.hitboxDebug.graphics());
    this.registerWorldDraw(this.pathDebug.graphics());
    this.registerWorldDraw(this.touchDebug.worldGraphics());
    this.registerUiDraw(this.touchDebug.uiGraphics());
    for (const go of this.castBar.worldRoots()) {
      this.registerWorldDraw(go);
    }
    this.input.on("pointerup", this.onPointerUpBound);
    this.input.on("pointerdown", this.onPointerDownBound);
    this.input.on("pointermove", this.onPointerMoveBound);

    this.events.on(INPUT_MODALITY_CHANGED, this.onInputModalityChanged);
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

    this.events.off("shutdown", this.onDefenseShutdown);
    this.events.once("shutdown", this.onDefenseShutdown);
  }

  update(_time: number, delta: number): void {
    this.spellCaster.tickCooldowns(delta);
    const dir = this.stick.getDirection();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    if (this.spellCaster.isChanneling()) {
      this.spellDirector.updateChanneling(delta, dir, () => this.shouldLockMeleeAimFacing());
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
    }
    this.player.updateAttack(delta);
    if (!this.spellCaster.isChanneling()) {
      this.tryFlushQueuedSpellCast(dir.x, dir.y);
      this.tryAutoCastSpells(dir.x, dir.y);
    }
    this.syncMeleeSwipeFx();

    const mult = playerDamageMult(this.save.buildings);
    this.player.damageEnemiesInArc(
      this.enemies.filter((e) => e.damageable.alive),
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
            radius: this.wu(enemyCollisionBodyRadius(e.defId)),
            damageable: e.damageable,
            sprite: e.sprite,
            enemy: e,
          };
        },
        flashNova: (x, y, r, def) => this.flashNova(x, y, r, def),
        endlessInfiniteHp: this.endlessInfiniteHp,
        enemySpellStatus: this.enemySpellStatus,
        findEnemyInstance: (id) => this.enemies.find((en) => en.id === id),
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
      radius: this.wu(playerBodyRadiusPx()),
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
    const hasActiveLingerGroundZone = this.spellGroundZones.some(
      (z) => (z.lingerDotDps ?? 0) > 0,
    );
    if (this.lingerAoeTelegraph && !hasActiveLingerGroundZone) {
      this.clearLingerAoeTelegraph();
    } else if (this.lingerAoeTelegraph) {
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
        maskWorldObject: (go) => this.registerWorldDraw(go),
        endlessInfiniteHp: this.endlessInfiniteHp,
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
        : this.isWavePlannerMode()
          ? "Wave planner"
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
          `HP ${Math.floor(this.player.damageable.hp)}/${this.player.damageable.maxHp}${this.endlessInfiniteHp ? " · ∞" : ""}${this.playerInvulnMs > 0 ? " (i-frames)" : ""}`,
          `Enemies ${living}${focus} · ${mode} · Auto ${auto}`,
          castLine,
        ].join("\n"),
      );
    }

    if (this.isEndlessMode()) {
      const endlessEnd = evaluateEndlessEnd({
        nightEnded: this.nightEnded,
        playerHp: this.player.damageable.hp,
        infiniteHp: this.endlessInfiniteHp,
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

  private spellDirector!: DefenseSpellDirector;

  private buildSpellHost(): DefenseSpellDirectorHost {
    const scene = this;
    return {
      scene,
      get save() { return scene.save; },
      get player() { return scene.player; },
      get enemies() { return scene.enemies; },
      get projectiles() { return scene.projectiles; },
      get targeting() { return scene.targeting; },
      get spellCaster() { return scene.spellCaster; },
      get spellInputQueue() { return scene.spellInputQueue; },
      get enemySpellStatus() { return scene.enemySpellStatus; },
      get spellBar() { return scene.spellBar; },
      get castBar() { return scene.castBar; },
      get groundReticle() { return scene.groundReticle; },
      get obstacleGroup() { return scene.obstacleGroup; },
      get obstacleBlockers() { return scene.obstacleBlockers; },
      get spellChannelArea() { return scene.spellChannelArea; },
      set spellChannelArea(v) { scene.spellChannelArea = v; },
      get spellGroundZones() { return scene.spellGroundZones; },
      set spellGroundZones(v) { scene.spellGroundZones = v; },
      get pendingGroundCast() { return scene.pendingGroundCast; },
      set pendingGroundCast(v) {
        scene.pendingGroundCast = v;
        scene.syncDefenseGroundAimModality();
      },
      get groundAim() { return scene.groundAim; },
      set groundAim(v) { scene.groundAim = v; },
      get groundAoeTelegraph() { return scene.groundAoeTelegraph; },
      set groundAoeTelegraph(v) { scene.groundAoeTelegraph = v; },
      get lingerAoeTelegraph() { return scene.lingerAoeTelegraph; },
      set lingerAoeTelegraph(v) { scene.lingerAoeTelegraph = v; },
      get blizzardChannelFx() { return scene.blizzardChannelFx; },
      set blizzardChannelFx(v) { scene.blizzardChannelFx = v; },
      get channelAreaStarted() { return scene.channelAreaStarted; },
      set channelAreaStarted(v) { scene.channelAreaStarted = v; },
      get shadowformEndsAt() { return scene.shadowformEndsAt; },
      set shadowformEndsAt(v) { scene.shadowformEndsAt = v; },
      get iceWallExpires() { return scene.iceWallExpires; },
      set iceWallExpires(v) { scene.iceWallExpires = v; },
      wu: (n) => scene.wu(n),
      enemyTargets: () => scene.enemyTargets(),
      resolveStrikeMode: (auto) => scene.resolveStrikeMode(auto),
      flashNova: (x, y, r, def) => scene.flashNova(x, y, r, def),
      nextProjectileId: () => `spell_proj_${scene.projectileSerial++}`,
      filterDeadEnemies: () => {
        scene.enemies = scene.enemies.filter((e) => e.damageable.alive);
      },
      timeNow: () => scene.time.now,
      delayedCall: (ms, fn) => scene.time.delayedCall(ms, fn),
      maskWorldObject: (go) => scene.registerWorldDraw(go),
    };
  }

  private onSpellAutoCastToggle(slotIndex: number): void {
    this.spellDirector.onSpellAutoCastToggle(slotIndex);
  }

  private tryAutoCastSpells(stickX: number, stickY: number): void {
    this.spellDirector.tryAutoCastSpells(stickX, stickY);
  }

  /** @internal Used by `defense/DefenseSceneE2E` until spell director lands */
  onSpellCastRequest(spellId: string): void {
    this.spellDirector.onSpellCastRequest(spellId);
  }

  /** Spell-bar press on a manual ground spell: arm reticle and track this pointer. */
  onGroundCastArm(spellId: string, pointer: Phaser.Input.Pointer): void {
    this.onSpellCastRequest(spellId);
    if (this.pendingGroundCast !== spellId) return;
    this.onGroundAimPointerDown(pointer);
  }

  cancelPendingGroundCast(): void {
    if (!this.pendingGroundCast) return;
    this.pendingGroundCast = null;
    this.syncDefenseGroundAimModality();
    this.groundAim = null;
    this.clearGroundAimGesture();
    this.groundReticle?.hide();
  }

  private tryFlushQueuedSpellCast(stickX: number, stickY: number): void {
    this.spellDirector.tryFlushQueuedSpellCast(stickX, stickY);
  }

  private beginSpellCast(spellId: string): void {
    this.spellDirector.beginSpellCast(spellId);
  }

  private clearGroundCastTelegraphs(): void {
    this.spellDirector.clearGroundCastTelegraphs();
  }

  private clearLingerAoeTelegraph(): void {
    this.spellDirector.clearLingerAoeTelegraph();
  }

  private spellDamageMult(): number {
    return this.spellDirector.spellDamageMult();
  }

  private tickIceWalls(): void {
    this.spellDirector.tickIceWalls();
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
    this.registerWorldDraw(sprite);
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

  private clearGroundAimGesture(): void {
    this.groundAimPointerId = null;
    this.groundAimFromUiBand = false;
    this.stick?.setExternalBlock(null);
  }

  private syncGroundAimStickBlock(): void {
    if (!this.stick) return;
    if (this.pendingGroundCast && this.groundAimFromUiBand) {
      this.stick.setExternalBlock(() => this.pendingGroundCast !== null);
    } else {
      this.stick.setExternalBlock(null);
    }
  }

  private onGroundAimPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.pendingGroundCast) return;
    this.groundAimPointerId = pointer.id;
    const play = defensePlayAreaLayout(this, this.safe);
    this.groundAimFromUiBand = !pointerInDefensePlayArea(
      pointer.x,
      pointer.y,
      play,
    );
    this.syncGroundAimStickBlock();
    this.updateGroundAimFromPointer(pointer);
  }

  private onGroundAimPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.pendingGroundCast || !pointer.isDown) return;
    if (
      this.groundAimPointerId !== null &&
      pointer.id !== this.groundAimPointerId
    ) {
      return;
    }
    this.updateGroundAimFromPointer(pointer);
  }

  private updateGroundAimFromPointer(pointer: Phaser.Input.Pointer): void {
    const def = spellById(this.pendingGroundCast ?? "");
    if (!def) return;
    const world = cameraWorldPoint(this.cameras.main, pointer.x, pointer.y);
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const maxR = this.wu(def.groundTargetMaxRangeWu ?? 240);
    const aim = groundAimFromWorldPoint(px, py, world.x, world.y, maxR);
    this.groundAim = aim;
    this.groundReticle.updatePosition(aim.x, aim.y);
  }

  private confirmPendingGroundCast(pointer: Phaser.Input.Pointer): boolean {
    if (!this.pendingGroundCast) return false;
    const spellId = this.pendingGroundCast;
    this.updateGroundAimFromPointer(pointer);
    this.pendingGroundCast = null;
    this.syncDefenseGroundAimModality();
    this.clearGroundAimGesture();
    this.beginSpellCast(spellId);
    return true;
  }

  /** @internal Used by `defense/DefenseSceneE2E` until targeting module lands */
  onScreenTap(pointer: Phaser.Input.Pointer): void {
    if (blocksBaseLayerInput(this)) return;
    if (this.pendingGroundCast) {
      const aimGesture =
        this.groundAimPointerId !== null &&
        pointer.id === this.groundAimPointerId;
      this.stick.tryConsumeTap(pointer);
      if (!aimGesture && this.targeting.isPointerOverUi(pointer)) return;
      if (!aimGesture) return;
      this.confirmPendingGroundCast(pointer);
      return;
    }
    const tapResult = this.stick.tryConsumeTap(pointer);
    if (this.targeting.isPointerOverUi(pointer)) return;
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
    pushInputModality(this, INPUT_MODALITY.debugMenu);
    this.setHudChromeVisible(false);
    pauseForDebugMenu(this);
    this.scene.launch("DebugMenu");
  }

  private syncDefenseGroundAimModality(): void {
    const active = isInputModalityActive(
      this,
      INPUT_MODALITY.defenseGroundAim.id,
    );
    if (this.pendingGroundCast && !active) {
      pushInputModality(this, INPUT_MODALITY.defenseGroundAim);
    } else if (!this.pendingGroundCast && active) {
      popInputModality(this, INPUT_MODALITY.defenseGroundAim.id);
    }
  }

  /** Disable combat chrome while a modal owns input; trim HUD during ground-aim. */
  private syncDefenseBaseInput(): void {
    const modal = blocksBaseLayerInput(this);
    const groundAim = isInputModalityActive(
      this,
      INPUT_MODALITY.defenseGroundAim.id,
    );
    const combatChrome = !modal && !groundAim;
    setContainerInputEnabled(this.attackButton, combatChrome);
    setContainerInputEnabled(this.modeToggle.container, combatChrome);
    setContainerInputEnabled(this.autoToggle.container, combatChrome);
    if (this.leaveEndlessBtn) {
      setContainerInputEnabled(this.leaveEndlessBtn.container, !modal);
    }
    if (this.returnToTownBtn) {
      setContainerInputEnabled(this.returnToTownBtn.container, !modal);
    }
    if (this.debugBtn) {
      setContainerInputEnabled(this.debugBtn.container, !modal);
    }
  }

  /** @internal E2E / tests — same path as the Return to town HUD button. */
  e2eReturnToTown(): void {
    this.transitionToTown();
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
      registerUiDraw: (go: Phaser.GameObjects.GameObject) =>
        this.registerUiDraw(go),
      setReturnToTownBtn: (btn: TouchButtonHandle | null) => {
        if (this.returnToTownBtn && this.returnToTownBtn !== btn) {
          this.returnToTownBtn.container.destroy();
        }
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
        this.player.meleeHitboxFacingRad(),
        PLAYER_TUNING.meleeActiveMs,
        this.registerWorldDraw,
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
    this.registerWorldDraw(p.sprite);
    this.projectiles.push(p);
  }

  private enemyTargets() {
    return this.enemies
      .filter((e) => e.damageable.alive)
      .map((e) => ({
        id: e.id,
        x: e.sprite.x,
        y: e.sprite.y,
        radius: this.wu(enemyCollisionBodyRadius(e.defId)),
        damageable: e.damageable,
        sprite: e.sprite,
        enemy: e,
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
    const skipDebug = [
      this.touchDebug.uiGraphics(),
      this.touchDebug.worldGraphics(),
    ];
    this.touchDebug.draw({
      stick: this.stick,
      excludeZones: this.stick.getDebugLayout().excludeZones,
      uiScreenRects: collectInteractiveScreenRects(this, { skip: skipDebug }),
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
    this.pathDebug.drawObstacleZones(this.navGrid, this.obstacleBlockers);
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
    const pBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const px = pBody.center.x;
    const py = pBody.center.y;
    const playerR = pBody.halfWidth;
    this.hitboxDebug.drawMeleeActivationRange(
      px,
      py,
      this.wu(PLAYER_TUNING.autoAttackMeleeRange),
    );
    this.hitboxDebug.drawMeleeMaxRange(
      px,
      py,
      this.wu(PLAYER_TUNING.meleeStrikeRange),
    );
    this.hitboxDebug.drawCircle(px, py, playerR);

    if (
      this.player.strikeMode() === "melee" &&
      this.player.attackPhaseNow === "active"
    ) {
      const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.meleeArcDeg / 2);
      this.hitboxDebug.drawMeleeArc(
        px,
        py,
        this.player.meleeHitboxFacingRad(),
        this.wu(PLAYER_TUNING.meleeStrikeRange),
        arcHalf,
      );
    }

    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      if (enemyUsesMeleePlayerActivationRange(e.behavior)) {
        const { melee } = e.combatTuning;
        this.hitboxDebug.drawMeleeActivationRange(
          e.sprite.x,
          e.sprite.y,
          melee.triggerRange,
        );
        this.hitboxDebug.drawMeleeMaxRange(
          e.sprite.x,
          e.sprite.y,
          melee.range,
        );
      }
      this.hitboxDebug.drawCircle(
        e.sprite.x,
        e.sprite.y,
        this.wu(enemyCollisionBodyRadius(e.defId)),
      );
      if (enemyShouldDrawMeleeArcOverlay(e)) {
        const arcHalf = Phaser.Math.DegToRad(e.combatTuning.melee.arcDeg / 2);
        this.hitboxDebug.drawMeleeArc(
          e.sprite.x,
          e.sprite.y,
          e.combat.facing,
          e.combatTuning.melee.range,
          arcHalf,
        );
      }
      if (e.behavior === "charger") {
        const extra = e.behaviorExtra;
        const touchR =
          this.wu(enemyCollisionBodyRadius(e.defId)) +
          this.wu(playerBodyRadiusPx());
        if (extra.chargeActiveMs > 0) {
          this.hitboxDebug.drawChargeTouchRadius(
            e.sprite.x,
            e.sprite.y,
            touchR,
          );
          this.hitboxDebug.drawChargeDashLine(
            e.sprite.x,
            e.sprite.y,
            extra.chargeAimX,
            extra.chargeAimY,
          );
        } else if (extra.chargeWindupMs > 0) {
          this.hitboxDebug.drawChargeDashLine(
            e.sprite.x,
            e.sprite.y,
            extra.chargeAimX,
            extra.chargeAimY,
          );
        }
      }
    }

    const projBodyR = projectileArcadeRadiusPx(this.registry);

    for (const p of this.enemyProjectiles) {
      if (!p.sprite.active) continue;
      this.hitboxDebug.drawProjectileBody(
        p.sprite.x,
        p.sprite.y,
        projBodyR,
      );
      if (
        p.spellBehavior === "aoe_on_hit" &&
        p.blastRadiusWu !== undefined &&
        p.lobAimX !== undefined &&
        p.lobAimY !== undefined
      ) {
        this.hitboxDebug.drawProjectileBlastRadius(
          p.lobAimX,
          p.lobAimY,
          this.wu(p.blastRadiusWu),
        );
      }
    }

    for (const p of this.projectiles) {
      if (p.sprite.active) {
        this.hitboxDebug.drawProjectileBody(
          p.sprite.x,
          p.sprite.y,
          projBodyR,
        );
      }
    }

    for (const obs of this.obstacleBlockers) {
      this.hitboxDebug.drawObstacleRect(obs.x, obs.y, obs.w, obs.h);
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
      maskWorldObject: (go) => this.registerWorldDraw(go),
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
  leaveTrainingRun(): void {
    if (this.nightEnded) return;
    if (this.isWavePlannerMode()) {
      runDefenseSimulatedNightEnd(this.nightEndContext(), {
        won: false,
        quit: true,
      });
      return;
    }
    this.endEndlessRun("quit");
  }

  endEndlessRun(reason: "quit" | "player" | "wall"): void {
    if (this.nightEnded) return;
    runDefenseEndlessNightEnd(this.nightEndContext(), reason);
  }

  /** @internal Used by `defense/DefenseSceneE2E` until night-end module lands */
  endNight(won: boolean): void {
    if (this.nightEnded) return;
    if (this.isWavePlannerMode()) {
      runDefenseSimulatedNightEnd(this.nightEndContext(), { won });
      return;
    }
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
  e2eObstacleBlockerAabb(index: number) { return defenseSceneE2eObstacleBlockerAabb(this.e2eDelegate(), index); }
  e2eObstacleArcadeBodyAabb(index: number) { return defenseSceneE2eObstacleArcadeBodyAabb(this.e2eDelegate(), index); }
  e2ePlayerBodyRadius() { return defenseSceneE2ePlayerBodyRadius(this.e2eDelegate()); }
  e2eMaxPlayerObstacleOverlapPx(obstacleIndex?: number) { return defenseSceneE2eMaxPlayerObstacleOverlapPx(this.e2eDelegate(), obstacleIndex); }
  e2eCenterCameraOn(x: number, y: number): void { defenseSceneE2eCenterCameraOn(this.e2eDelegate(), x, y); }
  e2eObstacleBumpProbe(index: number, approach: import("./defense/DefenseSceneE2E").DefenseObstacleBumpCardinal) {
    return defenseSceneE2eObstacleBumpProbe(this.e2eDelegate(), index, approach);
  }
  e2eFlushTangentPosition(
    index: number,
    approach: import("./defense/DefenseSceneE2E").DefenseObstacleBumpCardinal,
    beyondPx: number,
  ) {
    return defenseSceneE2eFlushTangentPosition(this.e2eDelegate(), index, approach, beyondPx);
  }
  e2eResolvePlayerObstacleOverlap(): void {
    defenseSceneE2eResolvePlayerObstacleOverlap(this.e2eDelegate());
  }
  e2eGetDefenseCameraScroll() { return defenseSceneE2eGetDefenseCameraScroll(this.e2eDelegate()); }
  e2eSetShowEnemyPaths(on: boolean): void { defenseSceneE2eSetShowEnemyPaths(this.e2eDelegate(), on); }
  e2eWorldPointToScreen(worldX: number, worldY: number) {
    return defenseSceneE2eWorldPointToScreen(this.e2eDelegate(), worldX, worldY);
  }
  e2eHudLayoutProbe() {
    return defenseSceneE2eHudLayoutProbe(this.e2eDelegate());
  }
  e2eSampleHudBandPixelsAsync() {
    return defenseSceneE2eSampleHudBandPixelsAsync(this.e2eDelegate());
  }
  e2eIsEndlessInfiniteHp(): boolean {
    return this.endlessInfiniteHp;
  }
  e2ePlayerHp(): number {
    return Math.floor(this.player.damageable.hp);
  }

  /** Playwright: targeting must see respawned endless enemies after dead culls. */
  e2eCanFocusFirstLivingEnemy(): boolean {
    const e = this.enemies.find((entry) => entry.damageable.alive);
    if (!e) return false;
    const pick = this.targeting.findEnemyNearWorldPoint(e.sprite.x, e.sprite.y);
    return pick?.id === e.id;
  }

  e2eDamageFirstLivingEnemy(amount: number): void {
    const e = this.enemies.find((entry) => entry.damageable.alive);
    if (!e) return;
    applyDamage(e.damageable, amount);
  }

}
