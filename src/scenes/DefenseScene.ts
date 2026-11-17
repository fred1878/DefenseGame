import Phaser from "phaser";
import {
  DEFENSE_MAP,
  DEFENSE_OBSTACLE_PLACEMENTS,
  DEFENSE_RENDER_DEPTH,
  defenseHalfHeight,
  defenseHalfWidth,
  defenseObstacleSpriteAnchor,
  PLAYER_AGGRO_RADIUS,
  PLAYER_TUNING,
  DEFENSE_SPELL_BAR,
  type AttackMode,
} from "../config";
import { toggleAutoCastSpellId } from "../content/spellBarAutoCast";
import {
  createDefaultSpellBarAutoCast,
  createDefaultSpellBarSlots,
  spellById,
  type SpellDefinition,
} from "../content/spells";
import type { NightResult, SaveGame } from "../core/saveTypes";
import { DataStore, type EnemyDef } from "../core/DataStore";
import {
  applyEndlessRunExit,
  applyNightResult,
  persistSave,
  playerDamageMult,
} from "../core/GameState";
import {
  clearDefenseRunMode,
  type EndlessRunSelection,
  readDefenseRunMode,
  resolveEndlessRunSelections,
} from "../core/defenseRunMode";
import { applyDamage } from "../combat/DamageSystem";
import { flashSpriteTint } from "../combat/HitFlash";
import {
  showGruntMeleeSwipe,
  showPlayerMeleeSwipe,
} from "../combat/MeleeSwipeFx";
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
import {
  pickEnemyCombatTarget,
  updateEnemyBrain,
  wallCombatPoint,
} from "../ai/EnemyBrain";
import { DEFAULT_ENEMY_BASE } from "../core/enemyTuning";
import { buildNavGrid, type NavGrid } from "../pathfinding/grid";
import {
  setShowEnemyPaths,
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
  spawnEnemy,
  updateEnemySpriteFacing,
  type EnemyInstance,
} from "../entities/Enemy";
import { updateEnemyCombat } from "../entities/EnemyCombat";
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
  updateArrowRainCombat,
  updateJavelineerCombat,
  updateLobberCombat,
  updateRangedHybridCombat,
  updateStationaryRangedCombat,
} from "../entities/EnemyRangedCombat";
import {
  spawnEnemyLobProjectile,
  spawnEnemyProjectile,
  spawnPlayerProjectile,
  updateEnemyProjectile,
  updateSpellProjectile,
  type EnemyProjectile,
  type PlayerProjectile,
} from "../entities/Projectile";
import { Player, type AttackPhase } from "../entities/Player";
import {
  configureSceneInput,
  FOCUS_SELECT_LOCK_MS,
} from "../input/inputTuning";
import { VirtualStick } from "../input/VirtualStick";
import {
  createTouchButton,
  createTouchCircleButton,
  createTouchToggleButton,
  interactiveObjectScreenRect,
  isTouchButtonVisuallyPressed,
} from "../ui/touchButton";
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
import { buildGroundDecorLayer } from "../world/buildGroundDecorLayer";
import { buildGroundLayer } from "../world/buildGroundLayer";
import { configureDefenseFollowCamera } from "../world/defenseCamera";
import { configureDefenseObstacleSprite } from "../world/defenseObstacleSprite";
import {
  defensePlayerStart,
  pickWaveSpawnPoint,
} from "../world/defenseSpawns";
import {
  cameraWorldPoint,
  buildCombatStickUiMask,
  combatChromeLayout,
  bottomHudStripLayout,
  debugButtonPosition,
  defensePlayAreaLayout,
  hudBandHeight,
  hudTextPosition,
  nightReturnButtonPosition,
  readSafeInsets,
  type SafeInsets,
} from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import { uiTextStyle } from "../ui/uiTextStyle";
import { updateEnemyNameplate } from "../ui/enemyNameplate";
import {
  scaledDefenseObstacles,
  worldDisplayPx,
  worldUnit,
} from "../core/worldPixelScale";
import type { TouchButtonHandle } from "../ui/touchButton";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { COMBAT_FX_TEXTURE, SPRITE_DISPLAY, UI_TEXTURE } from "../content/assets";
import { createCombatHudChrome, type CombatHudChrome } from "../ui/combatHudChrome";
import {
  DefenseMinimap,
  defenseMinimapLayout,
  defenseMinimapScreenRect,
} from "../ui/defenseMinimap";

export class DefenseScene extends Phaser.Scene {
  private save!: SaveGame;
  private player!: Player;
  private stick!: VirtualStick;
  private enemies: EnemyInstance[] = [];
  private projectiles: PlayerProjectile[] = [];
  private enemyProjectiles: EnemyProjectile[] = [];
  private projectileSerial = 0;
  private hudText!: Phaser.GameObjects.Text;
  private attackButton!: Phaser.GameObjects.Container;
  private autoAttackEnabled = false;
  private autoToggle!: ReturnType<typeof createTouchToggleButton>;
  private modeToggle!: ReturnType<typeof createTouchToggleButton>;
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
  private focusSelectLockMs = 0;
  private rewardGold = 40;
  private spawnPlanComplete = false;
  private nightEnded = false;
  private returnToTownBtn: TouchButtonHandle | null = null;
  private focusEnemyId: string | null = null;
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
  private debugBtn!: TouchButtonHandle;
  private safe!: SafeInsets;
  private onPointerUpBound = (p: Phaser.Input.Pointer) => this.onScreenTap(p);
  private onDebugMenuClose = (): void => {
    this.setHudChromeVisible(true);
    resumeFromDebugMenu(this);
  };
  private prevPlayerAttackPhase: AttackPhase = "idle";
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private hudChrome!: CombatHudChrome;
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
    this.focusEnemyId = null;
    this.focusSelectLockMs = 0;
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

  private isEndlessMode(): boolean {
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

    const halfW = defenseHalfWidth();
    const halfH = defenseHalfHeight();
    this.physics.world.setBounds(-halfW, -halfH, halfW * 2, halfH * 2);
    buildGroundLayer(this, halfW, halfH);
    buildGroundDecorLayer(this, halfW, halfH, this.save.night);

    if (!endless) {
      this.add
        .rectangle(0, -halfH + 20, halfW * 2, worldUnit(40, this.registry), 0x52525b)
        .setOrigin(0.5, 0);
    }

    this.obstacleGroup = this.physics.add.staticGroup();
    const scaledObstacles = scaledDefenseObstacles(this.registry);
    for (let i = 0; i < DEFENSE_OBSTACLE_PLACEMENTS.length; i++) {
      const placement = DEFENSE_OBSTACLE_PLACEMENTS[i]!;
      const obs = scaledObstacles[i]!;
      const anchor = defenseObstacleSpriteAnchor(placement);
      const rock = this.physics.add.staticImage(
        anchor.x,
        anchor.y,
        placement.textureKey,
      );
      configureDefenseObstacleSprite(rock, placement.textureKey, obs.w, obs.h);
      rock.setDepth(DEFENSE_RENDER_DEPTH.obstacleRock);
      this.obstacleGroup.add(rock);
    }

    this.cameras.main.setBounds(-halfW, -halfH, halfW * 2, halfH * 2);

    this.safe = readSafeInsets();
    const playArea = defensePlayAreaLayout(this, this.safe);

    const start = defensePlayerStart();
    this.player = new Player(this, start.x, start.y, this.save.player.hpMax);
    this.player.damageable.hp = this.save.player.hpMax;
    this.player.damageable.alive = true;
    this.playerInvulnMs = PLAYER_TUNING.nightSpawnInvulnMs;
    this.physics.add.collider(this.player.sprite, this.obstacleGroup);
    this.enemyGroup = this.physics.add.group();
    this.physics.add.collider(this.player.sprite, this.enemyGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.enemyGroup, this.obstacleGroup);
    configureDefenseFollowCamera(this.cameras.main, this.player.sprite, playArea);

    const chrome = combatChromeLayout(this, this.safe);
    this.hudChrome = createCombatHudChrome(this, this.safe);

    const bottomStrip = bottomHudStripLayout(this, this.safe);
    if (isE2EEnabled() && typeof window !== "undefined") {
      (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> }).__HUD_DEBUG__ =
        {
          bottomChromeTextureKey: null,
          stripCenterY: bottomStrip.stripCenterY,
          stripH: bottomStrip.stripH,
          playAreaY: playArea.y,
          playAreaBottom: playArea.y + playArea.height,
          playAreaHeight: playArea.height,
        };
    }

    this.attackButton = createTouchCircleButton(
      this,
      chrome.atkX,
      chrome.btnY,
      "ATK",
      chrome.atkRadius,
      () => this.manualAttack(),
      210,
      UI_TEXTURE.atkCircle,
    );

    this.modeToggle = createTouchToggleButton(
      this,
      chrome.modeX,
      chrome.modeY,
      "MEL",
      chrome.toggleW,
      chrome.toggleH,
      () => {
        const mode = this.player.cycleAttackMode();
        this.refreshModeToggle(mode);
      },
      210,
      {
        frameTextureKey: UI_TEXTURE.modeRect,
        onBgTint: 0xe8d4a8,
        offBgTint: 0xffffff,
        onTextColor: "#fde68a",
        offTextColor: "#e8dcc8",
      },
    );

    this.autoToggle = createTouchToggleButton(
      this,
      chrome.autoX,
      chrome.autoY,
      "AUTO\nOFF",
      chrome.toggleW,
      chrome.toggleH,
      () => {
        this.autoAttackEnabled = !this.autoAttackEnabled;
        this.refreshAutoToggle();
      },
      210,
      {
        frameTextureKey: UI_TEXTURE.autoRect,
        onBgTint: 0xa8d8a0,
        offBgTint: 0xffffff,
        onTextColor: "#bef264",
        offTextColor: "#a8a29e",
      },
    );

    this.spellCaster = new SpellCastController();
    this.castBar = new CastBar(this);
    this.spellBar = new SpellBar(
      this,
      this.save.spellBar.slots,
      this.save.spellBar.autoCastSpellIds,
      this.spellCaster,
      {
        onCastRequest: (id) => this.onSpellCastRequest(id),
        onAutoCastToggle: (slot) => this.onSpellAutoCastToggle(slot),
      },
    );
    this.spellBar.refreshAutoCastBorders(
      this.save.spellBar.slots,
      this.save.spellBar.autoCastSpellIds,
    );

    if (isE2EEnabled() && typeof window !== "undefined") {
      const dbg = (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> })
        .__HUD_DEBUG__;
      const spell0 = this.spellBar.e2eSlotTapCenters()[0];
      if (dbg) {
        dbg.spellSlot0CanvasY = spell0?.y ?? null;
      }
    }

    this.uiBlockers = [
      this.attackButton,
      this.modeToggle.container,
      this.autoToggle.container,
      ...this.spellBar.getUiContainers(),
    ];

    this.targetIndicator = new TargetIndicator(this);
    this.groundReticle = new GroundTargetReticle(this);
    this.minimap = new DefenseMinimap(this);
    this.minimapLayout = defenseMinimapLayout(this, this.safe);
    if (isE2EEnabled() && typeof window !== "undefined") {
      const dbg = (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> })
        .__HUD_DEBUG__;
      if (dbg) {
        dbg.minimap = this.minimapLayout;
      }
    }
    this.hitboxDebug = new HitboxDebugDraw(this);
    this.pathDebug = new PathDebugDraw(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.input.on("pointerup", this.onPointerUpBound);

    const hudPos = hudTextPosition(this.safe);
    this.hudText = this.add
      .text(
        hudPos.x,
        hudPos.y,
        "",
        uiTextStyle(this, {
          fontSize: `${scaleUiX(16)}px`,
          color: "#fafafa",
        }),
      )
      .setScrollFactor(0)
      .setDepth(200);

    const dbgPos = debugButtonPosition(this, this.safe);
    const strip = bottomHudStripLayout(this, this.safe);
    const spellClearY =
      strip.stripCenterY +
      DEFENSE_SPELL_BAR.slotSizePx / 2 +
      scaleUiY(14) +
      scaleUiX(36) / 2;
    dbgPos.y = Math.max(dbgPos.y, spellClearY) + scaleUiY(8);
    this.debugBtn = createTouchButton(
      this,
      dbgPos.x,
      dbgPos.y,
      "Debug",
      () => this.openDebugMenu(),
      {
        width: scaleUiX(88),
        height: scaleUiX(36),
        depth: 200,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x3f3f46,
        strokeColor: 0xa1a1aa,
      },
    );
    this.uiBlockers.push(this.debugBtn.container);

    if (endless) {
      const leaveBtn = nightReturnButtonPosition(this, this.safe);
      this.leaveEndlessBtn = createTouchButton(
        this,
        leaveBtn.x,
        leaveBtn.y,
        "Return to town",
        () => this.endEndlessRun("quit"),
        {
          width: leaveBtn.width,
          height: leaveBtn.height,
          depth: 210,
          fontSize: `${scaleUiX(14)}px`,
          fillColor: 0x52525b,
          strokeColor: 0xa1a1aa,
        },
      );
      this.leaveEndlessBtn.container.setData(
        "testid",
        "defense-leave-endless",
      );
      this.uiBlockers.push(this.leaveEndlessBtn.container);
    }

    const w = this.scale.width;
    const spellRect = this.spellBar.getScreenRect();
    const uiMask = buildCombatStickUiMask(
      this,
      chrome,
      spellRect,
      this.debugBtn.container,
    );
    const minimapRect = defenseMinimapScreenRect(this, this.safe);
    this.stick = new VirtualStick(this, {
      blockers: this.uiBlockers,
      excludeZones: [{ x: 0, y: 0, width: w, height: chrome.hudBand }],
      uiScreenRects: [...uiMask, minimapRect],
      dragThresholdPx: chrome.stickDragThreshold,
      radius: chrome.stickRadius,
    });

    this.game.events.on(DEBUG_MENU_CLOSE, this.onDebugMenuClose);

    this.refreshModeToggle(this.player.mode);
    this.refreshAutoToggle();

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
          const target = this.facingTarget("melee", false);
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
        const target = this.facingTarget("melee", false);
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

    const spellProjCtx = {
      deltaMs: delta,
      enemies: this.enemyTargets(),
      knockback: PLAYER_TUNING.rangedKnockback,
      findEnemy: (id: string) => {
        const e = this.getEnemyById(id);
        if (!e) return undefined;
        return {
          id: e.id,
          x: e.sprite.x,
          y: e.sprite.y,
          damageable: e.damageable,
          sprite: e.sprite,
        };
      },
    };
    this.projectiles = this.projectiles.filter((p) => {
      const result = updateSpellProjectile(p, spellProjCtx);
      if (result.detonation) {
        const def = spellById(p.spellId ?? "arc_bomb");
        if (def) {
          applySpellBlastAt(
            this,
            result.detonation.x,
            result.detonation.y,
            def,
            this.enemyTargets(),
            this.spellDamageMult(),
          );
          this.flashNova(
            result.detonation.x,
            result.detonation.y,
            result.detonation.radiusWu,
            { blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave },
          );
        }
      }
      return result.alive;
    });

    const playerHurtbox = {
      x: px,
      y: py,
      radius: this.wu(ENTITY_BODY_RADIUS.player),
      damageable: this.player.damageable,
    };

    this.enemyProjectiles = this.enemyProjectiles.filter((p) => {
      const alive = updateEnemyProjectile(
        p,
        delta,
        {
          x: px,
          y: py,
          radius: playerHurtbox.radius,
          damageable: this.player.damageable,
          sprite: this.player.sprite,
        },
        PLAYER_TUNING.rangedKnockback * 0.65,
      );
      const det = p.pendingDetonation;
      if (!alive && det) {
        const blastR = this.wu(det.radiusWu);
        const inBlast =
          Phaser.Math.Distance.Between(px, py, det.x, det.y) <=
          blastR + playerHurtbox.radius;
        if (
          inBlast &&
          this.playerInvulnMs <= 0 &&
          !this.registry.get("e2eGodMode") &&
          this.player.damageable.alive
        ) {
          const scale =
            (p as EnemyProjectile & { lobDamageScale?: number }).lobDamageScale ??
            1;
          applyDamage(this.player.damageable, det.damage * scale);
          this.playerInvulnMs = PLAYER_TUNING.playerHitInvulnMs;
        }
        this.flashNova(det.x, det.y, blastR, {
          blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
        });
      }
      return alive;
    });

    this.playerInvulnMs = Math.max(0, this.playerInvulnMs - delta);
    this.focusSelectLockMs = Math.max(0, this.focusSelectLockMs - delta);
    this.enemySpellStatus.tick(delta, (enemyId, amount, flavor) => {
      const e = this.getEnemyById(enemyId);
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

    this.enemyPathGoals.clear();
    const liveEnemies = this.enemies.filter((e) => e.damageable.alive);
    for (const e of liveEnemies) {
      if (this.enemySpellStatus.isRooted(e.id)) {
        e.sprite.setVelocity(0, 0);
        continue;
      }
      const peerAgents = liveEnemies
        .filter((o) => o.id !== e.id)
        .map((o) => ({ x: o.sprite.x, y: o.sprite.y }));
      const peerAllies = liveEnemies
        .filter((o) => o.id !== e.id)
        .map((o) => ({
          id: o.id,
          behavior: o.behavior,
          x: o.sprite.x,
          y: o.sprite.y,
        }));
      const objective = this.isEndlessMode() ? "huntPlayer" : "defendWall";
      const brain = updateEnemyBrain(
        e,
        e.nav,
        this.navGrid,
        px,
        py,
        delta,
        peerAgents,
        peerAllies,
        objective,
      );
      this.enemyPathGoals.set(e.id, {
        targetKind: brain.targetKind,
        x: brain.targetX,
        y: brain.targetY,
      });

      const combatTargetKind = pickEnemyCombatTarget(
        this.navGrid,
        e.sprite.x,
        e.sprite.y,
        px,
        py,
        worldUnit(PLAYER_AGGRO_RADIUS, this.registry),
        this.isEndlessMode() ? "huntPlayer" : "defendWall",
      );
      const attackTarget =
        combatTargetKind === "player"
          ? {
              kind: "player" as const,
              x: px,
              y: py,
              radius: playerHurtbox.radius,
              damageable: this.player.damageable,
            }
          : {
              kind: "wall" as const,
              ...wallCombatPoint(e.sprite.x),
            };

      let playerHitDamage = 0;
      const onWallHit = () => {
        if (this.isEndlessMode()) return;
        const wallDamage = e.combatTuning.wall.damage;
        this.wallHp = Math.max(0, this.wallHp - wallDamage);
      };

      if (e.behavior === "arrowRainArcher" && e.arrowRain) {
        const rain = updateArrowRainCombat(
          e,
          attackTarget,
          e.arrowRain,
          delta,
          onWallHit,
        );
        if (rain.hitPlayer) playerHitDamage += rain.damage;
      } else if (e.behavior === "javelineer" && e.javelineer) {
        const jav = updateJavelineerCombat(
          e,
          attackTarget,
          e.javelineer,
          delta,
          onWallHit,
        );
        if (jav.spawnJavelin) {
          const req = jav.spawnJavelin;
          const id = `ej_${this.projectileSerial++}`;
          this.enemyProjectiles.push(
            spawnEnemyProjectile(
              this,
              req.fromX,
              req.fromY,
              req.toX,
              req.toY,
              e.combatTuning.javelineer!.projectileSpeed,
              req.damage,
              e.combatTuning.javelineer!.projectileMaxTravel,
              id,
            ),
          );
        }
        if (jav.meleeHit) playerHitDamage += e.damage;
      } else if (e.behavior === "stationaryRanged" && e.stationaryRanged) {
        const bolt = updateStationaryRangedCombat(
          e,
          attackTarget,
          e.stationaryRanged,
          delta,
          onWallHit,
        );
        if (bolt.spawnBolt) {
          const req = bolt.spawnBolt;
          const tune = e.combatTuning.stationaryRanged!;
          const id = `es_${this.projectileSerial++}`;
          this.enemyProjectiles.push(
            spawnEnemyProjectile(
              this,
              req.fromX,
              req.fromY,
              req.toX,
              req.toY,
              tune.projectileSpeed,
              req.damage,
              tune.projectileMaxTravel,
              id,
            ),
          );
        }
      } else if (e.behavior === "rangedHybrid" && e.rangedHybrid) {
        const hybrid = updateRangedHybridCombat(
          e,
          attackTarget,
          e.rangedHybrid,
          delta,
          onWallHit,
        );
        if (hybrid.spawnBolt) {
          const req = hybrid.spawnBolt;
          const tune = e.combatTuning.stationaryRanged!;
          const id = `eh_${this.projectileSerial++}`;
          this.enemyProjectiles.push(
            spawnEnemyProjectile(
              this,
              req.fromX,
              req.fromY,
              req.toX,
              req.toY,
              tune.projectileSpeed,
              req.damage,
              tune.projectileMaxTravel,
              id,
            ),
          );
        }
        if (hybrid.meleeHit) playerHitDamage += e.damage;
        if (
          e.rangedHybrid.mode === "melee" &&
          e.combat.phase === "active" &&
          !e.combat.slashFxShown
        ) {
          e.combat.slashFxShown = true;
          showGruntMeleeSwipe(
            this,
            e.sprite.x,
            e.sprite.y,
            e.combat.facing,
            e.combatTuning.melee.activeMs,
          );
        }
      } else if (e.behavior === "lobber" && e.lobber) {
        const lob = updateLobberCombat(
          e,
          attackTarget,
          e.lobber,
          delta,
          onWallHit,
        );
        if (lob.spawnLob) {
          const req = lob.spawnLob;
          const tune = e.combatTuning.lobber!;
          const id = `el_${this.projectileSerial++}`;
          const proj = spawnEnemyLobProjectile(
            this,
            req.fromX,
            req.fromY,
            req.toX,
            req.toY,
            tune.projectileSpeed,
            req.damage,
            tune.blastRadius,
            id,
          );
          (proj as EnemyProjectile & { lobDamageScale?: number }).lobDamageScale =
            req.blastDamageScale;
          this.enemyProjectiles.push(proj);
        }
      } else {
        const hitPlayer = updateEnemyCombat(
          e,
          attackTarget,
          delta,
          onWallHit,
        );
        if (
          e.combat.phase === "active" &&
          !e.combat.slashFxShown
        ) {
          e.combat.slashFxShown = true;
          showGruntMeleeSwipe(
            this,
            e.sprite.x,
            e.sprite.y,
            e.combat.facing,
            e.combatTuning.melee.activeMs,
          );
        }
        if (hitPlayer) playerHitDamage += e.damage;
      }

      if (
        playerHitDamage > 0 &&
        this.playerInvulnMs <= 0 &&
        !this.registry.get("e2eGodMode")
      ) {
        applyDamage(this.player.damageable, playerHitDamage);
        if (this.player.damageable.hp <= 0) {
          this.player.damageable.alive = false;
        } else {
          this.player.damageable.alive = true;
        }
        this.playerInvulnMs = PLAYER_TUNING.playerHitInvulnMs;
      }
    }

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
    this.syncFocusTarget();

    const living = this.enemies.filter((e) => e.damageable.alive).length;
    const focus =
      this.focusEnemyId && this.getEnemyById(this.focusEnemyId)?.damageable.alive
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
      const wallLine = this.isEndlessMode()
        ? header
        : `${header} · Wall ${Math.max(0, Math.floor(this.wallHp))}`;
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
          wallLine,
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
      this.setFocusEnemy(target.id);
      this.player.faceToward(target.x, target.y);
    }
    this.beginSpellCast(pick.spellId);
  }

  private onSpellCastRequest(spellId: string): void {
    if (this.spellCaster.isChanneling()) return;
    const def = spellById(spellId);
    if (!def) return;
    if (
      def.requireEnemyTarget &&
      spellTargetMode(def) === "enemy" &&
      !this.focusEnemyId
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
      !this.focusEnemyId
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
      const target = this.facingTarget("ranged", true);
      this.spellChannelArea = target
        ? { x: target.x, y: target.y }
        : { x: this.player.sprite.x, y: this.player.sprite.y };
    }
    const begun = this.spellCaster.tryBeginCast(spellId);
    if (begun === false) return;
    this.channelAreaStarted = false;
    if (begun === "windup" || begun === "channel") {
      this.player.sprite.setVelocity(0, 0);
      const target = this.facingTarget("ranged", true);
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
      this.focusEnemyId,
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
      this.focusEnemyId,
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
      this.focusEnemyId,
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
        const focus = this.focusEnemyId;
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
          const t = this.facingTarget("melee", true);
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
          this.focusEnemyId,
          px,
          py,
          mult,
          this.enemySpellStatus,
        );
        if (def.projectileTextureKey) {
          const t = hitId ? this.getEnemyById(hitId) : null;
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
    const target = this.facingTarget(strike, true);
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
    const target = this.facingTarget(strike, false);
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

  private onScreenTap(pointer: Phaser.Input.Pointer): void {
    const tapResult = this.stick.tryConsumeTap(pointer);
    if (this.isPointerOverUi(pointer)) return;
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
    if (this.focusSelectLockMs > 0) return;
    if (tapResult.kind === "drag") return;

    const screenX = tapResult.kind === "tap" ? tapResult.x : pointer.x;
    const screenY = tapResult.kind === "tap" ? tapResult.y : pointer.y;

    const world = cameraWorldPoint(this.cameras.main, screenX, screenY);
    const pick = this.findEnemyNearWorldPoint(world.x, world.y);
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
    this.trySelectEnemyAt(world.x, world.y);
  }

  private openDebugMenu(): void {
    this.setHudChromeVisible(false);
    pauseForDebugMenu(this);
    this.scene.launch("DebugMenu");
  }

  private setHudChromeVisible(visible: boolean): void {
    this.hudText.setVisible(visible);
    this.debugBtn.container.setVisible(visible);
    this.hudChrome?.setVisible(visible);
    this.minimap?.setVisible(visible);
  }

  private transitionToTown(): void {
    if (this.scene.get("DebugMenu")?.scene.isActive()) {
      this.scene.stop("DebugMenu");
    }
    clearDefenseRunMode(this.registry);
    this.scene.stop();
    this.scene.start("Town");
  }

  private trySelectEnemyAt(worldX: number, worldY: number): void {
    const pick = this.findEnemyNearWorldPoint(worldX, worldY);
    if (pick) {
      this.setFocusEnemy(pick.id);
      return;
    }
    this.setFocusEnemy(null);
  }

  private findEnemyNearWorldPoint(worldX: number, worldY: number): EnemyInstance | null {
    const r = this.wu(PLAYER_TUNING.targetTapRadiusWorld);
    let best: { e: EnemyInstance; d: number } | null = null;
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, e.sprite.x, e.sprite.y);
      if (d > r) continue;
      if (!best || d < best.d) best = { e, d };
    }
    return best?.e ?? null;
  }

  private setFocusEnemy(id: string | null): void {
    if (id) this.focusSelectLockMs = FOCUS_SELECT_LOCK_MS;
    this.focusEnemyId = id;
    if (!id) {
      this.targetIndicator.detach();
      return;
    }
    const enemy = this.getEnemyById(id);
    if (!enemy || !enemy.damageable.alive) {
      this.focusEnemyId = null;
      this.targetIndicator.detach();
      return;
    }
    this.targetIndicator.attachTo(enemy.sprite);
    this.targetIndicator.updateWorldPosition();
  }

  private syncFocusTarget(): void {
    if (!this.focusEnemyId) return;
    const enemy = this.getEnemyById(this.focusEnemyId);
    if (!enemy || !enemy.damageable.alive) {
      this.setFocusEnemy(null);
      return;
    }
    this.targetIndicator.updateWorldPosition();
  }

  private getEnemyById(id: string): EnemyInstance | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  /** Selected enemy if alive; else nearest in range. Manual allows focus out of range for facing. */
  private facingTarget(
    mode: AttackMode | "melee" | "ranged",
    manual: boolean,
  ): { x: number; y: number } | null {
    const strike: "melee" | "ranged" =
      mode === "auto" ? "ranged" : mode;
    const focused = this.focusedEnemyPosition(strike, manual);
    if (focused) return focused;
    return this.nearestEnemyForMode(strike);
  }

  private focusedEnemyPosition(
    mode: "melee" | "ranged",
    manual: boolean,
  ): { x: number; y: number } | null {
    if (!this.focusEnemyId) return null;
    const e = this.getEnemyById(this.focusEnemyId);
    if (!e || !e.damageable.alive) return null;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
    const maxR =
      mode === "melee"
        ? this.wu(PLAYER_TUNING.autoAttackMeleeRange)
        : this.wu(PLAYER_TUNING.autoAttackRangedRange);
    if (!manual && d > maxR) return null;
    return { x: e.sprite.x, y: e.sprite.y };
  }

  private isPointerOverUi(pointer: Phaser.Input.Pointer): boolean {
    const hudBand = hudBandHeight(this.safe.top);
    if (
      pointer.y <= hudBand &&
      pointer.x >= 0 &&
      pointer.x <= this.scale.width
    ) {
      return true;
    }
    const hits = this.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.uiBlockers.some((b) => this.isSameOrChild(hit, b))) return true;
    }
    return false;
  }

  private isSameOrChild(
    hit: Phaser.GameObjects.GameObject,
    blocker: Phaser.GameObjects.GameObject,
  ): boolean {
    if (hit === blocker) return true;
    if (blocker instanceof Phaser.GameObjects.Container) {
      if (blocker.list.includes(hit)) return true;
    }
    let node: Phaser.GameObjects.GameObject | null = hit;
    while (node) {
      if (node === blocker) return true;
      const parent: Phaser.GameObjects.Container | null =
        (node as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container })
          .parentContainer ?? null;
      node = parent;
    }
    return false;
  }

  private nearestEnemyForMode(mode: "melee" | "ranged"): { x: number; y: number } | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const maxR =
      mode === "melee"
        ? this.wu(PLAYER_TUNING.autoAttackMeleeRange)
        : this.wu(PLAYER_TUNING.autoAttackRangedRange);
    let best: { x: number; y: number; d: number } | null = null;
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
      if (d > maxR) continue;
      if (!best || d < best.d) {
        best = { x: e.sprite.x, y: e.sprite.y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
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
      pointerUiBlocked: (p) => this.isPointerOverUi(p),
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

  private refreshModeToggle(mode: AttackMode): void {
    const label =
      mode === "melee" ? "MEL" : mode === "ranged" ? "RNG" : "A.COM";
    this.modeToggle.setLabel(label);
    this.modeToggle.setOn(mode === "ranged" || mode === "auto");
  }

  private refreshAutoToggle(): void {
    this.autoToggle.setOn(this.autoAttackEnabled);
    this.autoToggle.setLabel(
      this.autoAttackEnabled ? "AUTO\nON" : "AUTO\nOFF",
    );
  }

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
    let maxAt = 0;
    let total = 0;
    for (const group of wave.groups) {
      const enemyDef = store.enemies[group.enemyId];
      if (!enemyDef) continue;
      for (let i = 0; i < group.count; i++) {
        total += 1;
        const at = group.atMs + i * group.intervalMs;
        maxAt = Math.max(maxAt, at);
        this.time.delayedCall(at, () => {
          const { x, y } = pickWaveSpawnPoint(isE2EEnabled());
          this.spawnEnemyAt(x, y, enemyDef, group.enemyId);
        });
      }
    }
    if (total === 0) {
      this.spawnPlanComplete = true;
      return;
    }
    this.time.delayedCall(maxAt + 50, () => {
      this.spawnPlanComplete = true;
    });
  }

  private defaultEnemyDef(): EnemyDef {
    const store = this.registry.get("dataStore") as DataStore;
    return (
      store.enemies.grunt ?? {
        hp: DEFAULT_ENEMY_BASE.hp,
        speed: DEFAULT_ENEMY_BASE.speed,
        damage: DEFAULT_ENEMY_BASE.damage,
        behavior: "meleeChaser",
        textureKey: "enemy_grunt",
        displayName: "Grunt",
      }
    );
  }

  private spawnEnemyAt(
    x: number,
    y: number,
    def?: EnemyDef,
    defId = "grunt",
    hpOverride?: number,
  ): void {
    const base = def ?? this.defaultEnemyDef();
    const spawnDef =
      hpOverride !== undefined ? { ...base, hp: hpOverride } : base;
    const id = `e_${this.enemies.length}_${Date.now()}`;
    const enemy = spawnEnemy(
      this,
      id,
      x,
      y,
      spawnDef,
      defId,
      () => {
        destroyArrowRainTelegraph(enemy.arrowRain?.telegraph);
        destroyArrowRainTelegraph(enemy.lobber?.telegraph);
        enemy.sprite.destroy();
        this.scheduleEndlessRespawn();
      },
      () => this.setFocusEnemy(id),
    );
    enemy.damageable.onDamaged = (_amount, flavor = "default") => {
      flashSpriteTint(this, enemy.sprite, flavor);
    };
    this.enemyGroup.add(enemy.sprite);
    this.enemies.push(enemy);
  }

  private endEndlessRun(reason: "quit" | "player"): void {
    if (this.nightEnded) return;
    this.nightEnded = true;
    if (this.leaveEndlessBtn) {
      this.leaveEndlessBtn.container.setVisible(false);
      this.leaveEndlessBtn.container.disableInteractive();
    }

    const survivedHp = Math.max(0, Math.floor(this.player.damageable.hp));
    const finalWallHp = Math.max(0, this.wallHp);
    const next = applyEndlessRunExit(this.save, finalWallHp, survivedHp);
    this.save.player.hp = next.player.hp;
    persistSave(next);
    this.registry.set("save", next);
    clearDefenseRunMode(this.registry);
    this.endlessSelections = null;

    if (isE2EEnabled() && !this.registry.get("e2eManualReturn")) {
      this.transitionToTown();
      publishE2E({ scene: "Town", ready: true, player: null });
      return;
    }

    const headline =
      reason === "quit" ? "Training ended" : "You fell — training over";
    this.hudText.setText(
      [
        headline,
        "No gold earned · night unchanged",
        `Wall ${next.townWallHp} HP · HP ${next.player.hp}/${next.player.hpMax}`,
      ].join("\n"),
    );
    this.hudText.setColor(reason === "quit" ? "#a1a1aa" : "#fca5a5");

    const btn = nightReturnButtonPosition(this, this.safe);
    this.returnToTownBtn = createTouchButton(
      this,
      btn.x,
      btn.y,
      "Return to town",
      () => this.transitionToTown(),
      {
        width: btn.width,
        height: btn.height,
        depth: 260,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x15803d,
        strokeColor: 0x4ade80,
      },
    );
  }

  private endNight(won: boolean): void {
    if (this.nightEnded) return;
    this.nightEnded = true;
    clearDefenseRunMode(this.registry);

    const endPenalty = won ? 2 : 0;
    const finalWallHp = Math.max(0, this.wallHp - endPenalty);
    const wallDamage = this.wallHpStart - finalWallHp;
    const baseGold = this.rewardGold;
    const result: NightResult = {
      won,
      goldEarned: won ? baseGold : Math.floor(baseGold * 0.25),
      wallDamage,
      night: this.save.night,
    };
    const next = applyNightResult(this.save, result);
    const survivedHp = Math.max(0, Math.floor(this.player.damageable.hp));
    this.save.player.hp = survivedHp;
    next.player.hp = Math.min(next.player.hpMax, Math.max(1, survivedHp));
    next.townWallHp = finalWallHp;
    persistSave(next);
    this.registry.set("save", next);

    if (isE2EEnabled() && !this.registry.get("e2eManualReturn")) {
      this.transitionToTown();
      publishE2E({ scene: "Town", ready: true, player: null });
      return;
    }

    const headline = won ? "Night defended!" : "You fell — night lost";
    this.hudText.setText(
      [
        headline,
        `Night ${result.night} · +${result.goldEarned} gold`,
        `Wall damage ${result.wallDamage} · Wall ${next.townWallHp} HP`,
        won ? "Dawn breaks over the settlement." : "Scouts recover what they can.",
      ].join("\n"),
    );
    this.hudText.setColor(won ? "#fbbf24" : "#fca5a5");

    const btn = nightReturnButtonPosition(this, this.safe);
    this.returnToTownBtn = createTouchButton(
      this,
      btn.x,
      btn.y,
      "Return to town",
      () => this.transitionToTown(),
      {
        width: btn.width,
        height: btn.height,
        depth: 260,
        fontSize: `${scaleUiX(14)}px`,
        fillColor: 0x15803d,
        strokeColor: 0x4ade80,
      },
    );
    this.returnToTownBtn.container.setData("testid", "defense-return-to-town");
    if (isE2EEnabled()) {
      publishE2E({
        flags: { nightEnded: true, hasReturnButton: true },
      });
    }
  }

  e2eIsReady(): boolean {
    return Boolean(this.player?.sprite);
  }

  e2eBottomChromeTextureKey(): string | null {
    return null;
  }

  e2eSetStick(dx: number, dy: number): void {
    this.stick.setE2eOverride(dx, dy);
  }

  e2ePlayerPosition(): { x: number; y: number } {
    return { x: this.player.sprite.x, y: this.player.sprite.y };
  }

  e2eAttackPhase(): string {
    return this.player.attackPhaseNow;
  }

  e2eProjectileCount(): number {
    return this.projectiles.filter((p) => p.sprite.active).length;
  }

  e2eEnemyCount(): number {
    return this.enemies.filter((e) => e.damageable.alive).length;
  }

  e2eWallHp(): number {
    return Math.max(0, Math.floor(this.wallHp));
  }

  e2eTapMelee(): void {
    this.player.setAttackMode("melee");
    this.refreshModeToggle("melee");
    if (this.enemies.length === 0) {
      this.spawnEnemyAt(
        this.player.sprite.x + 48,
        this.player.sprite.y,
        undefined,
        "grunt",
        1,
      );
    }
    this.player.faceToward(this.player.sprite.x + 48, this.player.sprite.y);
    this.player.tryStartAttack();
  }

  e2eTapRanged(): void {
    this.player.setAttackMode("ranged");
    this.refreshModeToggle("ranged");
    if (this.enemies.length === 0) {
      this.spawnEnemyAt(
        this.player.sprite.x + 80,
        this.player.sprite.y,
        undefined,
        "grunt",
        1,
      );
    }
    const e = this.enemies[0];
    if (e) this.player.faceToward(e.sprite.x, e.sprite.y);
    this.player.tryStartAttack();
  }

  e2eCastSpellSlot(slot: number): Promise<void> {
    const id = this.save.spellBar.slots[slot];
    if (!id) return Promise.resolve();
    this.onSpellCastRequest(id);
    const def = spellById(id);
    if (!def || def.channelMs <= 0) return Promise.resolve();
    const waitMs = def.channelMs + 120;
    return new Promise((resolve) => {
      this.time.delayedCall(waitMs, () => resolve());
    });
  }

  e2eSpawnEnemy(offX = 48, offY = 0): void {
    this.spawnEnemyAt(
      this.player.sprite.x + offX,
      this.player.sprite.y + offY,
      undefined,
      "grunt",
      5,
    );
  }

  e2eDamagePlayer(amount: number): void {
    applyDamage(this.player.damageable, amount);
    if (this.player.damageable.hp <= 0) {
      this.player.damageable.alive = false;
      if (this.isEndlessMode()) {
        this.endEndlessRun("player");
      } else {
        this.endNight(false);
      }
    }
  }

  e2eIsEndlessMode(): boolean {
    return this.isEndlessMode();
  }

  e2eEndlessEnemyId(): string | null {
    return this.endlessSelections?.[0]?.enemyId ?? null;
  }

  e2eEndlessEnemyIds(): string[] {
    return (this.endlessSelections ?? []).map((s) => s.enemyId);
  }

  e2eKillAllEnemies(): void {
    for (const e of this.enemies) {
      e.damageable.alive = false;
      e.sprite.destroy();
    }
    this.enemies = [];
  }

  e2eSetSpawnPlanComplete(): void {
    this.spawnPlanComplete = true;
  }

  e2eForceWinNight(): void {
    this.e2eKillAllEnemies();
    this.spawnPlanComplete = true;
    const living = this.enemies.filter((e) => e.damageable.alive).length;
    if (living === 0 && !this.nightEnded) {
      this.endNight(true);
    }
  }

  e2eSetManualReturn(on: boolean): void {
    this.registry.set("e2eManualReturn", on);
  }

  e2eNightEnded(): boolean {
    return this.nightEnded;
  }

  e2eHasReturnButton(): boolean {
    return this.returnToTownBtn !== null;
  }

  e2eHasLeaveEndlessButton(): boolean {
    return (
      this.leaveEndlessBtn !== null &&
      this.leaveEndlessBtn.container.visible &&
      !this.nightEnded
    );
  }

  /** Inject a screen-space tap through the scene input manager (e2e / DOM mirrors). */
  e2eSimulateScreenTap(x: number, y: number): void {
    const pointer = this.input.pointer1;
    pointer.x = x;
    pointer.y = y;
    pointer.downTime = performance.now();
    pointer.isDown = true;
    this.input.emit("pointerdown", pointer, []);
    pointer.isDown = false;
    pointer.upTime = performance.now();
    this.input.emit("pointerup", pointer, []);
    this.onScreenTap(pointer);
  }

  /** Canvas-space tap centers for Playwright pointer tests (matches pointer.x/y). */
  e2eGetUiTapTargets(): Record<string, { x: number; y: number }> {
    const centerOf = (
      obj: Phaser.GameObjects.GameObject,
    ): { x: number; y: number } | null => {
      const r = interactiveObjectScreenRect(obj);
      if (!r) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const out: Record<string, { x: number; y: number }> = {};
    const atk = centerOf(this.attackButton);
    if (atk) out["combat-atk"] = atk;
    const mode = centerOf(this.modeToggle.container);
    if (mode) out["combat-mode"] = mode;
    const auto = centerOf(this.autoToggle.container);
    if (auto) out["combat-auto"] = auto;
    for (const slot of this.spellBar.e2eSlotTapCenters()) {
      out[`spell-slot-${slot.index}`] = { x: slot.x, y: slot.y };
    }
    const dbg = centerOf(this.debugBtn.container);
    if (dbg) out["defense-debug"] = dbg;
    if (this.returnToTownBtn) {
      const ret = centerOf(this.returnToTownBtn.container);
      if (ret) out["defense-return-to-town"] = ret;
    }
    if (this.leaveEndlessBtn?.container.visible) {
      const leave = centerOf(this.leaveEndlessBtn.container);
      if (leave) out["defense-leave-endless"] = leave;
    }
    return out;
  }

  e2eGetSpellSlotHitRects(): ReturnType<SpellBar["e2eSlotHitRects"]> {
    return this.spellBar.e2eSlotHitRects();
  }

  e2eAutoAttackEnabled(): boolean {
    return this.autoAttackEnabled;
  }

  e2eIsTouchButtonPressed(testId: string): boolean {
    const map: Record<string, Phaser.GameObjects.Container | undefined> = {
      "combat-atk": this.attackButton,
      "combat-mode": this.modeToggle.container,
      "combat-auto": this.autoToggle.container,
    };
    const direct = map[testId];
    if (direct) return isTouchButtonVisuallyPressed(direct);
    if (testId === "defense-return-to-town" && this.returnToTownBtn) {
      return isTouchButtonVisuallyPressed(this.returnToTownBtn.container);
    }
    if (testId === "defense-leave-endless" && this.leaveEndlessBtn) {
      return isTouchButtonVisuallyPressed(this.leaveEndlessBtn.container);
    }
    return false;
  }

  e2eSetPlayerPosition(x: number, y: number): void {
    this.player.sprite.setPosition(x, y);
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.reset(x, y);
    // E2E teleports skip follow lerp — tests assert scroll vs position, not easing.
    this.cameras.main.centerOn(x, y);
  }

  e2eGetDefenseCameraScroll(): { x: number; y: number } {
    return {
      x: this.cameras.main.scrollX,
      y: this.cameras.main.scrollY,
    };
  }

  e2eSetShowEnemyPaths(on: boolean): void {
    setShowEnemyPaths(this.registry, on);
  }

  e2eGetObstacleAlignment(): Array<{
    textureKey: string;
    configX: number;
    configY: number;
    configW: number;
    configH: number;
    anchorX: number;
    anchorY: number;
    spriteX: number;
    spriteY: number;
    displayW: number;
    displayH: number;
    bodyW: number;
    bodyH: number;
    bodyCenterX: number;
    bodyCenterY: number;
  }> {
    const children = this.obstacleGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    const scaled = scaledDefenseObstacles(this.registry);
    return DEFENSE_OBSTACLE_PLACEMENTS.map((placement, i) => {
      const cfg = scaled[i]!;
      const anchor = defenseObstacleSpriteAnchor(placement);
      const img = children[i]!;
      const body = img.body as Phaser.Physics.Arcade.StaticBody;
      return {
        textureKey: placement.textureKey,
        configX: cfg.x,
        configY: cfg.y,
        configW: cfg.w,
        configH: cfg.h,
        anchorX: anchor.x,
        anchorY: anchor.y,
        spriteX: img.x,
        spriteY: img.y,
        displayW: img.displayWidth,
        displayH: img.displayHeight,
        bodyW: body.width,
        bodyH: body.height,
        bodyCenterX: body.center.x,
        bodyCenterY: body.center.y,
      };
    });
  }
}