import { playerTuning } from "../config/player";
import { maxNavObstacleClearancePx } from "../entities/entityPhysics";
import Phaser from "phaser";
import { splitHudHeader, type DefenseTopHud } from "../ui/hud/defenseTopHud";
import { DEFENSE_MAP, type AttackMode } from "../config";
import type { EnemyDef } from "../core/data/DataStore";
import { applySaveLoadout } from "../talents/talentRuntime";
import { applyWeaponHitEffects } from "../gear/gearProcs";
import { applyPixelRenderDebugSettings } from "../core/render/pixelRenderDebug";
import { worldUnit } from "../config/worldScale";
import { DefenseConsumables } from "./defense/DefenseConsumables";
import { buildNavGrid, type NavGrid } from "../pathfinding/grid";
import { showTouchInput } from "../debug/DebugState";
import {
  DEBUG_MENU_CLOSE,
  openDebugMenuFromHost,
  resumeFromDebugMenu,
} from "../debug/debugMenuLifecycle";
import {
  blocksBaseLayerInput,
  clearInputModalities,
  INPUT_MODALITY,
  INPUT_MODALITY_CHANGED,
  popInputModality,
} from "../input/inputModality";
import { configureSceneInput } from "../input/inputTuning";
import type {
  createTouchToggleButton,
  TouchButtonHandle,
} from "../ui/touch/touchButton";
import { TargetIndicator } from "../ui/hud/TargetIndicator";
import { GroundTargetReticle } from "../ui/hud/GroundTargetReticle";
import { cameraWorldPoint } from "../ui/layout/screenLayout";
import type { CombatHudChrome } from "../ui/hud/combatHudChrome";
import type {
  DefenseMinimap,
  defenseMinimapLayout,
} from "../ui/hud/defenseMinimap";
import { isE2EEnabled } from "../e2e/e2eMode";
import type { DefenseSceneE2eHost } from "./defense/DefenseSceneE2EHost";
import { createRegisteredDefenseSceneE2eHost } from "./defense/defenseSceneE2eHook";
import { DefenseRunState } from "./defense/DefenseRunState";
import {
  type DefenseRunModeContext,
  type DefenseRunModeStrategy,
  defenseRunModeStrategy,
} from "./defense/DefenseRunModes";
import { spawnDefenseEnemyAt } from "./defense/DefenseEnemySpawner";
import {
  checkDefenseRunEnd,
  runDefenseEndlessNightEnd,
  transitionDefenseToTown,
} from "./defense/DefenseNightEnd";
import type { CampaignNightLossReason } from "../systems/nightEndMessaging";
import { DefenseTargeting } from "./defense/DefenseTargeting";
import { createDefenseHudController } from "./defense/DefenseHudController";
import {
  bindPlayerObstacleCorrection,
  bootstrapDefenseWorld,
} from "./defense/DefenseWorldBootstrap";
import type { DamageNumberFx } from "./defense/DamageNumberFx";
import { syncDefenseEnemyNameplates } from "./defense/DefenseEnemyTick";
import { DefenseSpellDirector } from "./defense/DefenseSpellDirector";
import { DefensePlayerCombat } from "./defense/DefensePlayerCombat";
import {
  DefenseGroundAim,
  syncDefenseGroundAimModality,
} from "./defense/DefenseGroundAim";
import { ensureEndlessSpawnCap } from "./defense/DefenseEndlessSpawn";
import {
  ensureDefenseSaveSpellBar,
  resolveDefenseRunSetup,
} from "./defense/DefenseRunSetup";
import {
  destroyDefenseSceneObjects,
  syncDefenseBaseInput,
} from "./defense/DefenseSceneLifecycle";
import { getDataStore, getSave } from "../core/registryKeys";
import { DefenseDebugOverlays } from "./defense/DefenseDebugOverlays";
import { resetDefenseRun } from "./defense/DefenseRunReset";
import {
  type DefenseWaveProgress,
  startDefenseSpawnPlan,
} from "./defense/DefenseSpawnPlan";
import {
  type DefenseFrameHost,
  tickDefensePlayer,
  tickDefenseWorld,
} from "./defense/DefenseFrameTick";
import {
  defenseEnemyTarget,
  defenseEnemyTargets,
} from "./defense/DefenseEnemyTargets";
import {
  defenseEnemySpawnerHost,
  defenseNightEndContext,
  publishDefenseE2eState,
} from "./defense/DefenseSceneHosts";

export class DefenseScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private topHud!: DefenseTopHud;
  private readonly waveProgress: DefenseWaveProgress = { spawned: 0, total: 0 };
  attackButton!: Phaser.GameObjects.Container;
  autoToggle!: ReturnType<typeof createTouchToggleButton>;
  modeToggle!: ReturnType<typeof createTouchToggleButton>;
  private uiBlockers: Phaser.GameObjects.GameObject[] = [];
  private navGrid!: NavGrid;
  private debugOverlays!: DefenseDebugOverlays;
  private targetIndicator!: TargetIndicator;
  debugBtn!: TouchButtonHandle;
  potionBtn?: TouchButtonHandle;
  bombBtn?: TouchButtonHandle;
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
      leaveEndlessBtn: this.run.leaveEndlessBtn,
      returnToTownBtn: this.run.returnToTownBtn,
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
      stick: this.run.stick,
      targetIndicator: this.targetIndicator,
      groundReticle: this.run.groundReticle,
      clearSpellTelegraphs: () => {
        this.spellDirector.clearGroundCastTelegraphs();
        this.spellDirector.clearLingerAoeTelegraph();
      },
      castBar: this.run.castBar,
      spellBar: this.run.spellBar,
      ...this.debugOverlays?.drawers,
      fpsOverlay: this.debugOverlays?.fpsOverlay,
      minimap: this.minimap,
      returnToTownBtn: this.run.returnToTownBtn,
      leaveEndlessBtn: this.run.leaveEndlessBtn,
      debugBtn: this.debugBtn,
      uiCamera: this.uiCamera,
      damageNumbers: this.damageNumbers,
      projectiles: this.run.projectiles,
      enemyProjectiles: this.run.enemyProjectiles,
      enemies: this.run.enemies,
    });
    this.run.returnToTownBtn = null;
    this.run.leaveEndlessBtn = null;
    this.run.projectiles = [];
    this.run.enemyProjectiles = [];
    this.run.enemies = [];
  };
  /** Per-run state + scene services, shared by reference with the defense helpers. */
  readonly run: DefenseRunState = new DefenseRunState(this, {
    wu: (n) => this.wu(n),
    enemyTargets: () => this.enemyTargets(),
    resolveStrikeMode: (auto) => this.combat.resolveStrikeMode(auto),
    flashNova: (x, y, r, def) => this.combat.flashNova(x, y, r, def),
    timeNow: () => this.time.now,
    delayedCall: (ms, fn) => this.time.delayedCall(ms, fn),
    registerWorldDraw: (go) => this.registerWorldDraw(go),
    beginSpellCast: (spellId) => this.beginSpellCast(spellId),
    onPendingGroundCastChanged: (v) => syncDefenseGroundAimModality(this, v),
  });
  private readonly combat = new DefensePlayerCombat(this.run);
  private readonly groundAimCtl = new DefenseGroundAim(this.run);
  /** Services for the per-frame player / world ticks (`DefenseFrameTick`). */
  private frameHost!: DefenseFrameHost;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  hudChrome!: CombatHudChrome;
  private minimap!: DefenseMinimap;
  minimapLayout!: ReturnType<typeof defenseMinimapLayout>;
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

  /** Lifesteal and gear on-hit procs for player auto-attacks. */
  private onWeaponHit(enemyId: string, damage: number): void {
    applyWeaponHitEffects({
      enemyId,
      damage,
      status: this.run.enemySpellStatus,
      player: this.run.player.damageable,
    });
  }

  isEndlessMode(): boolean {
    return (this.run.endlessSelections?.length ?? 0) > 0;
  }

  isWavePlannerMode(): boolean {
    return this.run.wavePlannerMode;
  }

  create(): void {
    configureSceneInput(this);
    applyPixelRenderDebugSettings(this.game);
    this.run.save = { ...getSave(this.registry) };
    ensureDefenseSaveSpellBar(this.run.save);
    applySaveLoadout(this.run.save);
    resetDefenseRun(this.run, {
      combat: this.combat,
      groundAim: this.groundAimCtl,
    });
    this.run.wallHp = Math.max(0, this.run.save.townWallHp);
    this.run.wallHpStart = this.run.wallHp;
    const store = getDataStore(this.registry);
    const setup = resolveDefenseRunSetup(
      this.registry,
      store,
      this.run.save.night,
    );
    const { endless, wavePlanner, wave } = setup;
    this.run.endlessSelections = setup.endlessSelections;
    this.run.endlessInfiniteHp = setup.endlessInfiniteHp;
    this.run.wavePlannerMode = wavePlanner;
    this.runMode = defenseRunModeStrategy(
      wavePlanner
        ? "wavePlanner"
        : (setup.endlessSelections?.length ?? 0) > 0
          ? "endless"
          : "campaign",
    );
    this.run.rewardGold = setup.rewardGold;

    const world = bootstrapDefenseWorld({
      scene: this,
      night: this.run.save.night,
      playerHpMax: this.run.save.player.hpMax,
      endless,
    });
    this.run.player = world.player;
    this.run.playerInvulnMs = world.playerInvulnMs;
    this.run.obstacleBlockers = world.obstacleBlockers;
    this.run.obstacleGroup = world.obstacleGroup;
    this.enemyGroup = world.enemyGroup;
    bindPlayerObstacleCorrection(
      this,
      () => this.run.player,
      () => this.run.obstacleBlockers,
    );
    this.navGrid = buildNavGrid(
      this.run.obstacleBlockers,
      worldUnit(DEFENSE_MAP.cellSize, this.registry),
      worldUnit(maxNavObstacleClearancePx(), this.registry),
      this.registry,
    );
    this.registerWorldDraw = world.registerWorldDraw;
    this.registerUiDraw = world.registerUiDraw;
    this.uiCamera = world.cameraRig.uiCamera;
    this.damageNumbers = world.damageNumbers;

    const hud = createDefenseHudController({
      scene: this,
      save: this.run.save,
      player: this.run.player,
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
      getAutoAttackEnabled: () => this.run.autoAttackEnabled,
      setAutoAttackEnabled: (on) => {
        this.run.autoAttackEnabled = on;
      },
    });
    this.run.safe = hud.safe;
    this.hudChrome = hud.hudChrome;
    this.attackButton = hud.attackButton;
    this.modeToggle = hud.modeToggle;
    this.autoToggle = hud.autoToggle;
    this.run.spellCaster = hud.spellCaster;
    this.run.castBar = hud.castBar;
    this.run.spellBar = hud.spellBar;
    this.hudText = hud.hudText;
    this.topHud = hud.topHud;
    this.debugBtn = hud.debugBtn;
    this.potionBtn = hud.potionBtn;
    this.bombBtn = hud.bombBtn;
    this.run.leaveEndlessBtn = hud.leaveEndlessBtn;
    this.minimap = hud.minimap;
    this.minimapLayout = hud.minimapLayout;
    this.run.stick = hud.stick;
    this.uiBlockers = hud.uiBlockers;
    this.hudSetChromeVisible = hud.setHudChromeVisible;
    this.consumables?.destroy();
    this.consumables = new DefenseConsumables({
      scene: this,
      save: this.run.save,
      player: this.run.player,
      potionBtn: hud.potionBtn,
      bombBtn: hud.bombBtn,
      enemyTargets: () => this.enemyTargets(),
      focusEnemyId: () => this.run.targeting?.focusEnemyId ?? null,
      enemySpellStatus: () => this.run.enemySpellStatus,
      wu: (n) => this.wu(n),
      flashNova: (x, y, r, def) => this.combat.flashNova(x, y, r, def),
      registerWorldDraw: (go) => this.registerWorldDraw(go),
      registerUiDraw: world.registerUiDraw,
      canAct: () => !this.run.nightEnded && this.scene.isActive(),
    });
    this.refreshModeToggle = hud.refreshModeToggle;

    this.targetIndicator = new TargetIndicator(this);
    this.registerWorldDraw(this.targetIndicator.worldRoot());
    this.run.targeting = new DefenseTargeting({
      scene: this,
      registry: this.registry,
      scale: this.scale,
      input: this.input,
      player: this.run.player,
      getEnemies: () => this.run.enemies,
      targetIndicator: this.targetIndicator,
      uiBlockers: this.uiBlockers,
      safe: this.run.safe,
      wu: (n) => this.wu(n),
    });
    this.run.groundReticle = new GroundTargetReticle(this);
    this.registerWorldDraw(this.run.groundReticle.worldGraphics());
    this.spellDirector = new DefenseSpellDirector(this.run);
    this.frameHost = {
      scene: this,
      run: this.run,
      combat: this.combat,
      spellDirector: this.spellDirector,
      navGrid: () => this.navGrid,
      wu: (n) => this.wu(n),
      onWeaponHit: (enemyId, damage) => this.onWeaponHit(enemyId, damage),
      enemyTarget: (e) => defenseEnemyTarget(e, (n) => this.wu(n)),
      enemyTargets: () => this.enemyTargets(),
      registerWorldDraw: (go) => this.registerWorldDraw(go),
    };
    this.debugOverlays = new DefenseDebugOverlays({
      scene: this,
      run: this.run,
      navGrid: () => this.navGrid,
      wu: (n) => this.wu(n),
      registerWorldDraw: this.registerWorldDraw,
      registerUiDraw: this.registerUiDraw,
    });
    for (const go of this.run.castBar.worldRoots()) {
      this.registerWorldDraw(go);
    }
    this.input.on("pointerup", this.onPointerUpBound);
    this.input.on("pointerdown", this.onPointerDownBound);
    this.input.on("pointermove", this.onPointerMoveBound);

    this.events.on(INPUT_MODALITY_CHANGED, this.onInputModalityChanged);
    this.game.events.on(DEBUG_MENU_CLOSE, this.onDebugMenuClose);

    startDefenseSpawnPlan({
      scene: this,
      store,
      wave,
      endless,
      wavePlanner,
      progress: this.waveProgress,
      setSpawnPlanComplete: (done) => {
        this.run.spawnPlanComplete = done;
      },
      spawnEnemyAt: (x, y, def, defId) => this.spawnEnemyAt(x, y, def, defId),
      ensureEndlessSpawnCap: () => this.ensureEndlessSpawnCap(),
    });

    if (isE2EEnabled()) publishDefenseE2eState(this.e2e, false);

    this.events.off("shutdown", this.onDefenseShutdown);
    this.events.once("shutdown", this.onDefenseShutdown);
  }

  override update(_time: number, delta: number): void {
    const { px, py } = tickDefensePlayer(this.frameHost, delta);
    tickDefenseWorld(this.frameHost, delta, px, py);

    syncDefenseEnemyNameplates(this.run.enemies, this.registry);
    this.damageNumbers.update();

    this.debugOverlays.draw(delta);
    this.minimap.draw(
      this.minimapLayout,
      this.run.player.sprite.x,
      this.run.player.sprite.y,
      this.run.enemies,
    );

    this.run.filterDeadEnemies();
    this.run.targeting.syncFocusTarget();

    const living = this.run.enemies.length;
    this.run.spellBar.refreshCooldownOverlays();
    this.consumables?.refresh();
    if (!this.run.nightEnded) this.refreshHudText(living);

    checkDefenseRunEnd({
      endless: this.isEndlessMode(),
      nightEnded: this.run.nightEnded,
      wallHp: this.run.wallHp,
      playerHp: this.run.player.damageable.hp,
      infiniteHp: this.run.endlessInfiniteHp,
      spawnPlanComplete: this.run.spawnPlanComplete,
      livingEnemies: living,
      onEndlessEnd: (reason) => this.endEndlessRun(reason),
      onNightEnd: (won, lossReason) => this.endNight(won, lossReason),
    });

    if (isE2EEnabled()) publishDefenseE2eState(this.e2e, true);
  }

  private refreshHudText(living: number): void {
    if (this.run.nightEnded) return;
    const dataStore = getDataStore(this.registry);
    const { title, subtitle } = splitHudHeader(
      this.runMode.hudHeader(this.runModeContext(dataStore)),
      this.runMode.hudSubtitle,
    );
    this.topHud.update({
      title,
      subtitle,
      livingEnemies: living,
      wallHp: this.run.wallHp,
      wallHpMax: Math.max(this.run.save.townWallHpMax, this.run.wallHp),
      playerHp: this.run.player.damageable.hp,
      playerHpMax: this.run.player.damageable.maxHp,
      heroTag: this.run.endlessInfiniteHp ? " ∞" : "",
      spawned: this.waveProgress.spawned,
      spawnTotal: this.waveProgress.total,
    });
  }

  private spellDirector!: DefenseSpellDirector;
  private runMode: DefenseRunModeStrategy = defenseRunModeStrategy("campaign");

  onSpellCastRequest(spellId: string): void {
    // A short spell-bar tap arms on press; clear that arm before auto-casting.
    if (this.run.pendingGroundCast) this.cancelPendingGroundCast();
    const dir = this.run.stick.getDirection();
    this.spellDirector.onSpellCastRequest(spellId, dir.x, dir.y);
  }

  /** Press on a ground spell: arm the reticle and track this pointer. Does not cast. */
  onGroundCastArm(spellId: string, pointer: Phaser.Input.Pointer): void {
    this.spellDirector.armGroundCast(spellId);
    if (this.run.pendingGroundCast !== spellId) return;
    this.groundAimCtl.onPointerDown(pointer);
  }

  cancelPendingGroundCast(): void {
    if (!this.run.pendingGroundCast) return;
    this.run.pendingGroundCast = null;
    this.run.groundAim = null;
    this.groundAimCtl.clearGesture();
    this.run.groundReticle?.hide();
  }

  private beginSpellCast(
    spellId: string,
    stickX?: number,
    stickY?: number,
  ): void {
    const dir = this.run.stick.getDirection();
    this.spellDirector.beginSpellCast(
      spellId,
      "manual",
      stickX ?? dir.x,
      stickY ?? dir.y,
    );
  }

  onScreenTap(pointer: Phaser.Input.Pointer): void {
    if (blocksBaseLayerInput(this)) return;
    if (this.run.pendingGroundCast) {
      const aimGesture = this.groundAimCtl.isAimGesture(pointer);
      this.run.stick.tryConsumeTap(pointer);
      if (!aimGesture && this.run.targeting.isPointerOverUi(pointer)) return;
      if (!aimGesture) return;
      const action = this.groundAimCtl.resolveRelease(pointer);
      if (action === "confirm") this.groundAimCtl.confirm(pointer);
      else if (action === "cancel") this.cancelPendingGroundCast();
      return;
    }
    const tapResult = this.run.stick.tryConsumeTap(pointer);
    if (this.run.targeting.isPointerOverUi(pointer)) return;
    if (this.run.targeting.focusSelectLockMs > 0) return;
    if (tapResult.kind === "drag") return;

    const screenX = tapResult.kind === "tap" ? tapResult.x : pointer.x;
    const screenY = tapResult.kind === "tap" ? tapResult.y : pointer.y;

    const world = cameraWorldPoint(this.cameras.main, screenX, screenY);
    const pick = this.run.targeting.findEnemyNearWorldPoint(world.x, world.y);
    if (showTouchInput(this.registry)) {
      this.run.focusTapFlash = {
        screenX,
        screenY,
        worldX: world.x,
        worldY: world.y,
        picked: pick !== null,
        pickRadiusWorld: this.wu(playerTuning().targetTapRadiusWu),
        ageMs: 0,
      };
    }
    this.run.targeting.trySelectEnemyAt(world.x, world.y);
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
    return defenseNightEndContext({
      scene: this,
      run: this.run,
      hudText: this.hudText,
      topHud: this.topHud,
      registerUiDraw: (go) => this.registerUiDraw(go),
      onReturnToTown: () => this.transitionToTown(),
    });
  }

  private enemyTargets() {
    return defenseEnemyTargets(this.run.enemies, (n) => this.wu(n));
  }

  refreshModeToggle!: (mode: AttackMode) => void;

  private ensureEndlessSpawnCap(): void {
    ensureEndlessSpawnCap({
      selections: this.run.endlessSelections,
      nightEnded: this.run.nightEnded,
      store: getDataStore(this.registry),
      enemies: this.run.enemies,
      e2e: isE2EEnabled(),
      registry: this.registry,
      spawnEnemyAt: (x, y, def, defId) => this.spawnEnemyAt(x, y, def, defId),
    });
  }

  private scheduleEndlessRespawn(): void {
    if (!this.isEndlessMode() || this.run.nightEnded) return;
    this.time.delayedCall(0, () => this.ensureEndlessSpawnCap());
  }

  private enemySpawnerHost() {
    return defenseEnemySpawnerHost({
      scene: this,
      store: getDataStore(this.registry),
      run: this.run,
      enemyGroup: this.enemyGroup,
      damageNumbers: this.damageNumbers,
      registerWorldDraw: (go) => this.registerWorldDraw(go),
      onRemovedFromPlay: () => this.scheduleEndlessRespawn(),
    });
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
    if (this.run.nightEnded) return;
    this.runMode.leave(this.runModeContext());
  }

  endEndlessRun(reason: "quit" | "player" | "wall"): void {
    if (this.run.nightEnded) return;
    runDefenseEndlessNightEnd(this.nightEndContext(), reason);
  }

  endNight(won: boolean, lossReason?: CampaignNightLossReason): void {
    if (this.run.nightEnded) return;
    this.runMode.endNight(this.runModeContext(), won, lossReason);
  }

  private runModeContext(
    store = getDataStore(this.registry),
  ): DefenseRunModeContext {
    return { run: this.run, store, nightEnd: () => this.nightEndContext() };
  }

  /**
   * E2E hooks (`installE2E*`): every `defenseSceneE2e*` helper bound to this
   * scene, e.g. `scene.e2e.enemyCount()`. See `DefenseSceneE2EHost.ts`.
   */
  get e2e(): DefenseSceneE2eHost | null {
    this.e2eHost ??= createRegisteredDefenseSceneE2eHost(this);
    return this.e2eHost;
  }

  private e2eHost: DefenseSceneE2eHost | null = null;
}
