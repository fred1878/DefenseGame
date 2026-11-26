import Phaser from "phaser";
import { DEFENSE_MAP, PLAYER_TUNING, type AttackMode } from "../config";
import type { DefenseObstacleRect } from "../config/defense";
import { SHADOWFORM_MECHANICS } from "../config/shadowformMechanics";
import { resetShadowformRuntimeMults } from "../config/shadowformRuntime";
import type { SaveGame } from "../core/saveTypes";
import type { DataStore, EnemyDef } from "../core/DataStore";
import type { EndlessRunSelection } from "../core/defenseRunMode";
import { applySaveLoadout } from "../talents/talentRuntime";
import { applyWeaponHitEffects } from "../gear/gearProcs";
import { worldUnit } from "../core/worldPixelScale";
import {
  shadowformActive,
  shadowformMoveSpeedMultiplier,
} from "../combat/shadowform";
import { SpellInputQueue } from "../combat/spellInputQueue";
import { SpellCastController } from "../combat/SpellCastController";
import { EnemySpellStatusMap } from "../combat/enemySpellStatus";
import { DefenseConsumables } from "./defense/DefenseConsumables";
import type { SpellBlizzardChannelFx } from "../combat/SpellBlizzardChannelFx";
import type { SpellHealChannelFx } from "../combat/SpellHealChannelFx";
import type { SpellIceCastWindupFx } from "../combat/SpellIceCastWindupFx";
import { EnemyIceRootFxController } from "../combat/EnemyIceRootFx";
import { EnemyIceStunFxController } from "../combat/EnemyIceStunFx";
import type { SpellGroundAoeTelegraph } from "../combat/SpellGroundAoeTelegraph";
import type { SpellGroundZone } from "../combat/spellGroundZone";
import { buildNavGrid, type NavGrid } from "../pathfinding/grid";
import { showTouchInput } from "../debug/DebugState";
import {
  DEBUG_MENU_CLOSE,
  openDebugMenuFromHost,
  resumeFromDebugMenu,
} from "../debug/debugMenuLifecycle";
import { FpsDebugOverlay } from "../debug/FpsDebugOverlay";
import type { CombatRangeDebugDraw } from "../debug/CombatRangeDebugDraw";
import type { HitboxDebugDraw } from "../debug/HitboxDebugDraw";
import type { PathDebugDraw } from "../debug/PathDebugDraw";
import type {
  FocusTapFlash,
  TouchInputDebugDraw,
} from "../debug/TouchInputDebugDraw";
import {
  blocksBaseLayerInput,
  clearInputModalities,
  INPUT_MODALITY,
  INPUT_MODALITY_CHANGED,
  popInputModality,
} from "../input/inputModality";
import { configureSceneInput } from "../input/inputTuning";
import type { VirtualStick } from "../input/VirtualStick";
import {
  enemyCollisionBodyRadius,
  playerBodyRadiusPx,
} from "../entities/entityPhysics";
import type { EnemyInstance } from "../entities/Enemy";
import type { EnemyProjectile, PlayerProjectile } from "../entities/Projectile";
import type { Player } from "../entities/Player";
import type {
  createTouchToggleButton,
  TouchButtonHandle,
} from "../ui/touchButton";
import type { CastBar } from "../ui/CastBar";
import type { SpellBar } from "../ui/SpellBar";
import { TargetIndicator } from "../ui/TargetIndicator";
import { GroundTargetReticle } from "../ui/GroundTargetReticle";
import { cameraWorldPoint, type SafeInsets } from "../ui/screenLayout";
import type { CombatHudChrome } from "../ui/combatHudChrome";
import type {
  DefenseMinimap,
  defenseMinimapLayout,
} from "../ui/defenseMinimap";
import { e2eCampaignWavesFromQuery, isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import {
  createDefenseSceneE2eHost,
  type DefenseSceneE2eHost,
} from "./defense/DefenseSceneE2EHost";
import type { DefenseSceneE2eDelegate } from "./defense/DefenseSceneE2ETypes";
import {
  spawnDefenseEnemyAt,
  type DefenseEnemySpawnerHost,
} from "./defense/DefenseEnemySpawner";
import { scheduleDefenseWave } from "./defense/DefenseWaveSpawner";
import {
  checkDefenseRunEnd,
  runDefenseCampaignNightEnd,
  runDefenseEndlessNightEnd,
  runDefenseSimulatedNightEnd,
  transitionDefenseToTown,
} from "./defense/DefenseNightEnd";
import type { CampaignNightLossReason } from "./defense/nightEndMessaging";
import { DefenseTargeting } from "./defense/DefenseTargeting";
import {
  createDefenseHudController,
  formatDefenseHudText,
} from "./defense/DefenseHudController";
import {
  bindPlayerObstacleCorrection,
  bootstrapDefenseWorld,
} from "./defense/DefenseWorldBootstrap";
import type { DamageNumberFx } from "./defense/DamageNumberFx";
import { tickDefenseProjectiles } from "./defense/DefenseProjectileTick";
import {
  syncDefenseEnemyNameplates,
  tickDefenseEnemies,
} from "./defense/DefenseEnemyTick";
import {
  DefenseSpellDirector,
  type DefenseSpellDirectorHost,
} from "./defense/DefenseSpellDirector";
import { tickDefenseSpellWorld } from "./defense/DefenseSpellWorldTick";
import {
  createDefenseDebugDrawers,
  drawDefenseCombatDebug,
  drawDefenseEnemyPaths,
  drawDefenseTouchDebug,
} from "./defense/DefenseDebugDraw";
import {
  DefensePlayerCombat,
  type DefensePlayerCombatHost,
} from "./defense/DefensePlayerCombat";
import {
  DefenseGroundAim,
  syncDefenseGroundAimModality,
  type DefenseGroundAimHost,
} from "./defense/DefenseGroundAim";
import {
  endlessHudHeader,
  ensureEndlessSpawnCap,
} from "./defense/DefenseEndlessSpawn";
import {
  ensureDefenseSaveSpellBar,
  resolveDefenseRunSetup,
} from "./defense/DefenseRunSetup";
import {
  destroyDefenseSceneObjects,
  syncShadowformPlayerFx,
  syncDefenseBaseInput,
  syncShadowformRuntime,
} from "./defense/DefenseSceneLifecycle";

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
  private autoAttackEnabled = true;
  autoToggle!: ReturnType<typeof createTouchToggleButton>;
  modeToggle!: ReturnType<typeof createTouchToggleButton>;
  private uiBlockers: Phaser.GameObjects.GameObject[] = [];
  private wallHp = 0;
  private wallHpStart = 0;
  private navGrid!: NavGrid;
  private playerInvulnMs = 0;
  private hitboxDebug!: HitboxDebugDraw;
  private rangeDebug!: CombatRangeDebugDraw;
  private pathDebug!: PathDebugDraw;
  private touchDebug!: TouchInputDebugDraw;
  private fpsOverlay!: FpsDebugOverlay;
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
  private healChannelFx: SpellHealChannelFx | null = null;
  private iceCastWindupFx: SpellIceCastWindupFx | null = null;
  private readonly enemyIceRootFx = new EnemyIceRootFxController(this);
  private readonly enemyIceStunFx = new EnemyIceStunFxController(this);
  private channelAreaStarted = false;
  private shadowformEndsAt = 0;
  private iceWallExpires: Array<{
    sprite: Phaser.Physics.Arcade.Image;
    expiresAt: number;
  }> = [];
  private spellBar!: SpellBar;
  private castBar!: CastBar;
  debugBtn!: TouchButtonHandle;
  potionBtn?: TouchButtonHandle;
  bombBtn?: TouchButtonHandle;
  private safe!: SafeInsets;
  private onPointerUpBound = (p: Phaser.Input.Pointer) => this.onScreenTap(p);
  private onPointerDownBound = (p: Phaser.Input.Pointer) =>
    this.groundAimCtl.onPointerDown(p);
  private onPointerMoveBound = (p: Phaser.Input.Pointer) =>
    this.groundAimCtl.onPointerMove(p);
  private setHudChromeVisible = (visible: boolean): void => {
    this.hudSetChromeVisible?.(visible);
    if (visible) this.consumables?.refresh(true);
  };
  private consumables: DefenseConsumables | null = null;
  private hudSetChromeVisible: ((visible: boolean) => void) | null = null;
  private readonly onInputModalityChanged = (): void =>
    syncDefenseBaseInput(this, {
      attackButton: this.attackButton,
      modeToggle: this.modeToggle,
      autoToggle: this.autoToggle,
      leaveEndlessBtn: this.leaveEndlessBtn,
      returnToTownBtn: this.returnToTownBtn,
      debugBtn: this.debugBtn,
    });
  private onDebugMenuClose = (): void => {
    popInputModality(this, INPUT_MODALITY.debugMenu.id);
    this.setHudChromeVisible(true);
    resumeFromDebugMenu(this);
  };
  private onDefenseShutdown = (): void => {
    this.consumables?.destroy();
    this.consumables = null;
    this.events.off(INPUT_MODALITY_CHANGED, this.onInputModalityChanged);
    this.game.events.off(DEBUG_MENU_CLOSE, this.onDebugMenuClose);
    clearInputModalities(this);
    this.input?.off("pointerup", this.onPointerUpBound);
    this.input?.off("pointerdown", this.onPointerDownBound);
    this.input?.off("pointermove", this.onPointerMoveBound);
    destroyDefenseSceneObjects({
      scene: this,
      stick: this.stick,
      targetIndicator: this.targetIndicator,
      groundReticle: this.groundReticle,
      clearSpellTelegraphs: () => {
        this.spellDirector.clearGroundCastTelegraphs();
        this.spellDirector.clearLingerAoeTelegraph();
      },
      castBar: this.castBar,
      spellBar: this.spellBar,
      hitboxDebug: this.hitboxDebug,
      rangeDebug: this.rangeDebug,
      pathDebug: this.pathDebug,
      touchDebug: this.touchDebug,
      fpsOverlay: this.fpsOverlay,
      minimap: this.minimap,
      returnToTownBtn: this.returnToTownBtn,
      leaveEndlessBtn: this.leaveEndlessBtn,
      debugBtn: this.debugBtn,
      uiCamera: this.uiCamera,
      damageNumbers: this.damageNumbers,
      projectiles: this.projectiles,
      enemyProjectiles: this.enemyProjectiles,
      enemies: this.enemies,
    });
    this.returnToTownBtn = null;
    this.leaveEndlessBtn = null;
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
  };
  private readonly sceneHost = this.buildSceneHost();
  private readonly combat = new DefensePlayerCombat(this.sceneHost);
  private readonly groundAimCtl = new DefenseGroundAim(this.sceneHost);
  obstacleBlockers: DefenseObstacleRect[] = [];
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
  private damageNumbers!: DamageNumberFx;

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
    this.combat.resetForNewRun();
    this.autoAttackEnabled = true;
    this.playerInvulnMs = 0;
    this.spellCaster = new SpellCastController();
    this.spellInputQueue = new SpellInputQueue();
    this.enemySpellStatus = new EnemySpellStatusMap();
    this.enemyIceRootFx.reset();
    this.enemyIceStunFx.reset();
    this.iceCastWindupFx?.stop();
    this.iceCastWindupFx = null;
    this.spellChannelArea = null;
    this.spellGroundZones = [];
    this.pendingGroundCast = null;
    syncDefenseGroundAimModality(this, this.pendingGroundCast);
    this.groundAim = null;
    this.groundAimCtl.resetForNewRun();
    this.shadowformEndsAt = 0;
    resetShadowformRuntimeMults();
    syncShadowformPlayerFx(this.player, false);
    for (const wall of this.iceWallExpires) wall.sprite.destroy();
    this.iceWallExpires = [];
    this.endlessSelections = null;
    this.wavePlannerMode = false;
    this.leaveEndlessBtn = null;
    this.endlessInfiniteHp = false;
  }

  /** Lifesteal and gear on-hit procs for player auto-attacks. */
  private onWeaponHit(enemyId: string, damage: number): void {
    applyWeaponHitEffects({
      enemyId,
      damage,
      status: this.enemySpellStatus,
      player: this.player.damageable,
    });
  }

  isEndlessMode(): boolean {
    return (this.endlessSelections?.length ?? 0) > 0;
  }

  isWavePlannerMode(): boolean {
    return this.wavePlannerMode;
  }

  create(): void {
    configureSceneInput(this);
    this.save = { ...(this.registry.get("save") as SaveGame) };
    ensureDefenseSaveSpellBar(this.save);
    applySaveLoadout(this.save);
    this.resetDefenseRunState();
    this.wallHp = Math.max(0, this.save.townWallHp);
    this.wallHpStart = this.wallHp;
    const store = this.registry.get("dataStore") as DataStore;
    const setup = resolveDefenseRunSetup(this.registry, store, this.save.night);
    const { endless, wavePlanner, wave } = setup;
    this.endlessSelections = setup.endlessSelections;
    this.endlessInfiniteHp = setup.endlessInfiniteHp;
    this.wavePlannerMode = wavePlanner;
    if (setup.rewardGold !== undefined) this.rewardGold = setup.rewardGold;

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
    bindPlayerObstacleCorrection(
      this,
      () => this.player,
      () => this.obstacleBlockers,
    );
    this.navGrid = buildNavGrid(
      this.obstacleBlockers,
      worldUnit(DEFENSE_MAP.cellSize, this.registry),
      worldUnit(DEFENSE_MAP.pathClearancePx, this.registry),
      this.registry,
    );
    this.registerWorldDraw = world.registerWorldDraw;
    this.registerUiDraw = world.registerUiDraw;
    this.uiCamera = world.cameraRig.uiCamera;
    this.damageNumbers = world.damageNumbers;

    const hud = createDefenseHudController({
      scene: this,
      save: this.save,
      player: this.player,
      endless,
      wavePlanner,
      registerUiDraw: world.registerUiDraw,
      onManualAttack: () => this.combat.manualAttack(),
      onSpellCastRequest: (id) => this.onSpellCastRequest(id),
      onSpellAutoCastToggle: (slot) =>
        this.spellDirector.onSpellAutoCastToggle(slot),
      onGroundCastArm: (id, pointer) => this.onGroundCastArm(id, pointer),
      onGroundCastCancel: () => this.cancelPendingGroundCast(),
      onOpenDebugMenu: () => this.openDebugMenu(),
      onLeaveEndless: () => this.leaveTrainingRun(),
      onUsePotion: () => this.consumables?.use("heal"),
      onUseBomb: () => this.consumables?.use("bomb"),
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
    this.potionBtn = hud.potionBtn;
    this.bombBtn = hud.bombBtn;
    this.leaveEndlessBtn = hud.leaveEndlessBtn;
    this.minimap = hud.minimap;
    this.minimapLayout = hud.minimapLayout;
    this.stick = hud.stick;
    this.uiBlockers = hud.uiBlockers;
    this.hudSetChromeVisible = hud.setHudChromeVisible;
    this.consumables?.destroy();
    this.consumables = new DefenseConsumables({
      scene: this,
      save: this.save,
      player: this.player,
      potionBtn: hud.potionBtn,
      bombBtn: hud.bombBtn,
      enemyTargets: () => this.enemyTargets(),
      focusEnemyId: () => this.targeting?.focusEnemyId ?? null,
      enemySpellStatus: () => this.enemySpellStatus,
      wu: (n) => this.wu(n),
      flashNova: (x, y, r, def) => this.combat.flashNova(x, y, r, def),
      registerWorldDraw: (go) => this.registerWorldDraw(go),
      registerUiDraw: world.registerUiDraw,
      canAct: () => !this.nightEnded && this.scene.isActive(),
    });
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
    this.spellDirector = new DefenseSpellDirector(this.sceneHost);
    ({
      hitboxDebug: this.hitboxDebug,
      rangeDebug: this.rangeDebug,
      pathDebug: this.pathDebug,
      touchDebug: this.touchDebug,
    } = createDefenseDebugDrawers(
      this,
      this.registerWorldDraw,
      this.registerUiDraw,
    ));
    this.fpsOverlay = new FpsDebugOverlay(this, this.registerUiDraw);
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
    } else if (
      wave &&
      (!isE2EEnabled() || wavePlanner || e2eCampaignWavesFromQuery())
    ) {
      // E2E skips campaign waves (tests spawn their own enemies), but a wave
      // planner run is an explicit player-built plan, so it always runs, and
      // `campaignWaves=1` opts a validation run into the real night.
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
        isE2EEnabled() && !e2eCampaignWavesFromQuery(),
      );
    } else if (isE2EEnabled()) {
      this.spawnPlanComplete = false;
    } else {
      this.spawnPlanComplete = true;
    }

    if (isE2EEnabled()) {
      publishE2E({
        scene: "Defense",
        ready: true,
        player: this.e2e.playerPosition(),
      });
    }

    this.events.off("shutdown", this.onDefenseShutdown);
    this.events.once("shutdown", this.onDefenseShutdown);
  }

  override update(_time: number, delta: number): void {
    this.spellCaster.tickCooldowns(delta);
    syncShadowformRuntime(this.player, this.shadowformEndsAt, this.time.now);
    const dir = this.stick.getDirection();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const moveSpeed = shadowformMoveSpeedMultiplier(
      shadowformActive(this.shadowformEndsAt, this.time.now),
      SHADOWFORM_MECHANICS,
    );

    if (this.spellCaster.isChanneling()) {
      this.spellDirector.updateChanneling(delta, dir, () =>
        this.combat.shouldLockMeleeAimFacing(),
      );
    } else {
      const lockMeleeAim = this.combat.shouldLockMeleeAimFacing();
      this.player.setVelocityFromStick(
        dir.x,
        dir.y,
        this.wu(PLAYER_TUNING.moveSpeedWu) * moveSpeed,
        {
          lockMeleeAim,
        },
      );
      if (lockMeleeAim) {
        const target = this.targeting.facingTarget("melee", false);
        if (target) this.player.faceToward(target.x, target.y);
      }
      this.castBar.setVisible(false);
    }

    if (!this.spellCaster.isChanneling()) {
      this.combat.tryAutoAttack();
    }
    this.player.updateAttack(delta);
    if (!this.spellCaster.isChanneling()) {
      this.spellDirector.tryFlushQueuedSpellCast(dir.x, dir.y);
      this.spellDirector.tryAutoCastSpells(dir.x, dir.y);
    }
    this.combat.syncMeleeSwipeFx();

    this.player.damageEnemiesInArc(
      this.enemies.filter((e) => e.damageable.alive),
      PLAYER_TUNING.meleeDamage,
      this.wu(PLAYER_TUNING.meleeKnockbackWu),
      (enemy, damage) => this.onWeaponHit(enemy.id, damage),
    );

    if (this.player.consumeRangedShot()) {
      this.combat.fireProjectile(PLAYER_TUNING.rangedDamage);
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
        spellDamageMult: (def) => this.spellDirector.spellDamageMult(def),
        onWeaponHit: (enemyId, damage) => this.onWeaponHit(enemyId, damage),
        wu: (n) => this.wu(n),
        findEnemy: (id) => {
          const e = this.targeting.getEnemyById(id);
          return e ? this.enemyTarget(e) : undefined;
        },
        flashNova: (x, y, r, def) => this.combat.flashNova(x, y, r, def),
        endlessInfiniteHp: this.endlessInfiniteHp,
        enemySpellStatus: this.enemySpellStatus,
        findEnemyInstance: (id) => this.enemies.find((en) => en.id === id),
        registerWorldDraw: (go) => this.registerWorldDraw(go),
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
    this.targeting.focusSelectLockMs = Math.max(
      0,
      this.targeting.focusSelectLockMs - delta,
    );
    tickDefenseSpellWorld(this.sceneHost, this.spellDirector, delta);

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

    syncDefenseEnemyNameplates(this.enemies, this.registry);
    this.damageNumbers.update();

    this.drawDebugOverlays(delta);
    this.minimap.draw(
      this.minimapLayout,
      this.player.sprite.x,
      this.player.sprite.y,
      this.enemies,
    );

    this.enemies = this.enemies.filter((e) => e.damageable.alive);
    this.targeting.syncFocusTarget();

    const living = this.enemies.filter((e) => e.damageable.alive).length;
    this.spellBar.refreshCooldownOverlays();
    this.consumables?.refresh();
    if (!this.nightEnded) this.refreshHudText(living);

    checkDefenseRunEnd({
      endless: this.isEndlessMode(),
      nightEnded: this.nightEnded,
      wallHp: this.wallHp,
      playerHp: this.player.damageable.hp,
      infiniteHp: this.endlessInfiniteHp,
      spawnPlanComplete: this.spawnPlanComplete,
      livingEnemies: living,
      onEndlessEnd: (reason) => this.endEndlessRun(reason),
      onNightEnd: (won, lossReason) => this.endNight(won, lossReason),
    });

    if (isE2EEnabled()) {
      publishE2E({
        scene: "Defense",
        ready: true,
        player: this.e2e.playerPosition(),
        flags: {
          attackPhase: this.e2e.attackPhase(),
          projectileCount: this.e2e.projectileCount(),
          enemyCount: this.e2e.enemyCount(),
        },
      });
    }
  }

  private refreshHudText(living: number): void {
    const dataStore = this.registry.get("dataStore") as DataStore;
    const focusId = this.targeting.focusEnemyId;
    this.hudText.setText(
      formatDefenseHudText({
        header: this.isEndlessMode()
          ? endlessHudHeader(dataStore, this.endlessSelections)
          : this.isWavePlannerMode()
            ? "Wave planner"
            : `Night ${this.save.night}`,
        wallHp: this.wallHp,
        playerHp: this.player.damageable.hp,
        playerHpMax: this.player.damageable.maxHp,
        infiniteHp: this.endlessInfiniteHp,
        invulnerable: this.playerInvulnMs > 0,
        livingEnemies: living,
        hasFocus: Boolean(
          focusId && this.targeting.getEnemyById(focusId)?.damageable.alive,
        ),
        mode: this.player.mode,
        autoAttackEnabled: this.autoAttackEnabled,
        castPhase: this.spellCaster.getCastPhase(),
        castPct: Math.floor(this.spellCaster.getChannelProgress() * 100),
        attackPhase: this.player.attackPhaseNow,
      }),
    );
  }

  private drawDebugOverlays(delta: number): void {
    drawDefenseCombatDebug({
      registry: this.registry,
      rangeDebug: this.rangeDebug,
      hitboxDebug: this.hitboxDebug,
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      enemyProjectiles: this.enemyProjectiles,
      obstacleBlockers: this.obstacleBlockers,
      wu: (n) => this.wu(n),
    });
    drawDefenseEnemyPaths({
      registry: this.registry,
      pathDebug: this.pathDebug,
      navGrid: this.navGrid,
      obstacleBlockers: this.obstacleBlockers,
      enemies: this.enemies,
      enemyPathGoals: this.enemyPathGoals,
    });
    this.focusTapFlash = drawDefenseTouchDebug(
      {
        scene: this,
        registry: this.registry,
        touchDebug: this.touchDebug,
        stick: this.stick,
        focusTapFlash: this.focusTapFlash,
        pointerUiBlocked: (p) => this.targeting.isPointerOverUi(p),
      },
      delta,
    );
    this.fpsOverlay.tick(this.registry, delta, this.game);
  }

  private spellDirector!: DefenseSpellDirector;

  /** One live view of scene state shared by the spell director, player combat and ground aim. */
  private buildSceneHost(): DefenseSpellDirectorHost &
    DefensePlayerCombatHost &
    DefenseGroundAimHost {
    const scene = this;
    return {
      scene,
      get stick() {
        return scene.stick;
      },
      get safe() {
        return scene.safe;
      },
      get autoAttackEnabled() {
        return scene.autoAttackEnabled;
      },
      get save() {
        return scene.save;
      },
      get player() {
        return scene.player;
      },
      get enemies() {
        return scene.enemies;
      },
      get projectiles() {
        return scene.projectiles;
      },
      get targeting() {
        return scene.targeting;
      },
      get spellCaster() {
        return scene.spellCaster;
      },
      get spellInputQueue() {
        return scene.spellInputQueue;
      },
      get enemySpellStatus() {
        return scene.enemySpellStatus;
      },
      get spellBar() {
        return scene.spellBar;
      },
      get castBar() {
        return scene.castBar;
      },
      get groundReticle() {
        return scene.groundReticle;
      },
      get obstacleGroup() {
        return scene.obstacleGroup;
      },
      get obstacleBlockers() {
        return scene.obstacleBlockers;
      },
      get spellChannelArea() {
        return scene.spellChannelArea;
      },
      set spellChannelArea(v) {
        scene.spellChannelArea = v;
      },
      get spellGroundZones() {
        return scene.spellGroundZones;
      },
      set spellGroundZones(v) {
        scene.spellGroundZones = v;
      },
      get pendingGroundCast() {
        return scene.pendingGroundCast;
      },
      set pendingGroundCast(v) {
        scene.pendingGroundCast = v;
        syncDefenseGroundAimModality(scene, v);
      },
      get groundAim() {
        return scene.groundAim;
      },
      set groundAim(v) {
        scene.groundAim = v;
      },
      get groundAoeTelegraph() {
        return scene.groundAoeTelegraph;
      },
      set groundAoeTelegraph(v) {
        scene.groundAoeTelegraph = v;
      },
      get lingerAoeTelegraph() {
        return scene.lingerAoeTelegraph;
      },
      set lingerAoeTelegraph(v) {
        scene.lingerAoeTelegraph = v;
      },
      get blizzardChannelFx() {
        return scene.blizzardChannelFx;
      },
      set blizzardChannelFx(v) {
        scene.blizzardChannelFx = v;
      },
      get healChannelFx() {
        return scene.healChannelFx;
      },
      set healChannelFx(v) {
        scene.healChannelFx = v;
      },
      get iceCastWindupFx() {
        return scene.iceCastWindupFx;
      },
      set iceCastWindupFx(v) {
        scene.iceCastWindupFx = v;
      },
      get enemyIceRootFx() {
        return scene.enemyIceRootFx;
      },
      get enemyIceStunFx() {
        return scene.enemyIceStunFx;
      },
      get channelAreaStarted() {
        return scene.channelAreaStarted;
      },
      set channelAreaStarted(v) {
        scene.channelAreaStarted = v;
      },
      get shadowformEndsAt() {
        return scene.shadowformEndsAt;
      },
      set shadowformEndsAt(v) {
        scene.shadowformEndsAt = v;
      },
      get iceWallExpires() {
        return scene.iceWallExpires;
      },
      set iceWallExpires(v) {
        scene.iceWallExpires = v;
      },
      wu: (n) => scene.wu(n),
      enemyTargets: () => scene.enemyTargets(),
      resolveStrikeMode: (auto) => scene.combat.resolveStrikeMode(auto),
      flashNova: (x, y, r, def) => scene.combat.flashNova(x, y, r, def),
      nextProjectileId: () => `spell_proj_${scene.projectileSerial++}`,
      filterDeadEnemies: () => {
        scene.enemies = scene.enemies.filter((e) => e.damageable.alive);
      },
      timeNow: () => scene.time.now,
      delayedCall: (ms, fn) => scene.time.delayedCall(ms, fn),
      maskWorldObject: (go) => scene.registerWorldDraw(go),
      registerWorldDraw: (go) => scene.registerWorldDraw(go),
      nextPlayerProjectileId: () => `p_${scene.projectileSerial++}`,
      beginSpellCast: (spellId) => scene.beginSpellCast(spellId),
    };
  }

  onSpellCastRequest(spellId: string): void {
    // A short spell-bar tap arms on press; clear that arm before auto-casting.
    if (this.pendingGroundCast) this.cancelPendingGroundCast();
    const dir = this.stick.getDirection();
    this.spellDirector.onSpellCastRequest(spellId, dir.x, dir.y);
  }

  /** Press on a ground spell: arm the reticle and track this pointer. Does not cast. */
  onGroundCastArm(spellId: string, pointer: Phaser.Input.Pointer): void {
    this.spellDirector.armGroundCast(spellId);
    if (this.pendingGroundCast !== spellId) return;
    this.groundAimCtl.onPointerDown(pointer);
  }

  cancelPendingGroundCast(): void {
    if (!this.pendingGroundCast) return;
    this.pendingGroundCast = null;
    syncDefenseGroundAimModality(this, null);
    this.groundAim = null;
    this.groundAimCtl.clearGesture();
    this.groundReticle?.hide();
  }

  private beginSpellCast(
    spellId: string,
    stickX?: number,
    stickY?: number,
  ): void {
    const dir = this.stick.getDirection();
    this.spellDirector.beginSpellCast(
      spellId,
      "manual",
      stickX ?? dir.x,
      stickY ?? dir.y,
    );
  }

  onScreenTap(pointer: Phaser.Input.Pointer): void {
    if (blocksBaseLayerInput(this)) return;
    if (this.pendingGroundCast) {
      const aimGesture = this.groundAimCtl.isAimGesture(pointer);
      this.stick.tryConsumeTap(pointer);
      if (!aimGesture && this.targeting.isPointerOverUi(pointer)) return;
      if (!aimGesture) return;
      const action = this.groundAimCtl.resolveRelease(pointer);
      if (action === "confirm") this.groundAimCtl.confirm(pointer);
      else if (action === "cancel") this.cancelPendingGroundCast();
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
        pickRadiusWorld: this.wu(PLAYER_TUNING.targetTapRadiusWu),
        ageMs: 0,
      };
    }
    this.targeting.trySelectEnemyAt(world.x, world.y);
  }

  private openDebugMenu(): void {
    openDebugMenuFromHost(this, {
      beforeLaunch: () => this.setHudChromeVisible(false),
    });
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

  private enemyTarget(e: EnemyInstance) {
    return {
      id: e.id,
      x: e.sprite.x,
      y: e.sprite.y,
      radius: this.wu(enemyCollisionBodyRadius(e.defId)),
      damageable: e.damageable,
      sprite: e.sprite,
      enemy: e,
    };
  }

  private enemyTargets() {
    return this.enemies
      .filter((e) => e.damageable.alive)
      .map((e) => this.enemyTarget(e));
  }

  refreshModeToggle!: (mode: AttackMode) => void;

  private ensureEndlessSpawnCap(): void {
    ensureEndlessSpawnCap({
      selections: this.endlessSelections,
      nightEnded: this.nightEnded,
      store: this.registry.get("dataStore") as DataStore,
      enemies: this.enemies,
      e2e: isE2EEnabled(),
      registry: this.registry,
      spawnEnemyAt: (x, y, def, defId) => this.spawnEnemyAt(x, y, def, defId),
    });
  }

  private scheduleEndlessRespawn(): void {
    if (!this.isEndlessMode() || this.nightEnded) return;
    this.time.delayedCall(0, () => this.ensureEndlessSpawnCap());
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
      notifyDamaged: (enemy, amount, flavor) => {
        this.damageNumbers.floatFromSource(
          enemy.damageable.id,
          enemy.sprite,
          amount,
          { flavor },
        );
      },
    };
  }

  spawnEnemyAt(
    x: number,
    y: number,
    def?: EnemyDef,
    defId = "grunt",
    hpOverride?: number,
  ): void {
    spawnDefenseEnemyAt(this.enemySpawnerHost(), x, y, def, defId, hpOverride);
  }

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

  endNight(won: boolean, lossReason?: CampaignNightLossReason): void {
    if (this.nightEnded) return;
    if (this.isWavePlannerMode()) {
      runDefenseSimulatedNightEnd(this.nightEndContext(), { won });
      return;
    }
    runDefenseCampaignNightEnd(this.nightEndContext(), {
      won,
      ...(!won && lossReason !== undefined ? { lossReason } : {}),
      wallHp: this.wallHp,
      wallHpStart: this.wallHpStart,
      rewardGold: this.rewardGold,
      save: this.save,
    });
  }

  /**
   * E2E hooks (`installE2E*`): every `defenseSceneE2e*` helper bound to this
   * scene, e.g. `scene.e2e.enemyCount()`. See `DefenseSceneE2EHost.ts`.
   */
  readonly e2e: DefenseSceneE2eHost = createDefenseSceneE2eHost(
    this as unknown as DefenseSceneE2eDelegate,
  );
}
