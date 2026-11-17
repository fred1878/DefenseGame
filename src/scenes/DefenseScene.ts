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
import { DataStore, type EnemyDef } from "../core/DataStore";
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
import { clampGroundTarget } from "../combat/spellMechanics";
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
    this.spellDirector = new DefenseSpellDirector(this.buildSpellHost());
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
      get spellChannelArea() { return scene.spellChannelArea; },
      set spellChannelArea(v) { scene.spellChannelArea = v; },
      get spellGroundZones() { return scene.spellGroundZones; },
      set spellGroundZones(v) { scene.spellGroundZones = v; },
      get pendingGroundCast() { return scene.pendingGroundCast; },
      set pendingGroundCast(v) { scene.pendingGroundCast = v; },
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
