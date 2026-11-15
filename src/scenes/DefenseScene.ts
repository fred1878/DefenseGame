import Phaser from "phaser";
import {
  DEFENSE_MAP,
  DEFENSE_OBSTACLES,
  ENEMY_TUNING,
  GAME,
  PLAYER_TUNING,
  type AttackMode,
  type NightResult,
  createDefaultSpellBarAutoCast,
  createDefaultSpellBarSlots,
  type SaveGame,
  type SpellDefinition,
} from "../config";
import { DataStore, type EnemyDef } from "../core/DataStore";
import {
  applyNightResult,
  persistSave,
  playerDamageMult,
} from "../core/GameState";
import { applyDamage } from "../combat/DamageSystem";
import { flashSpriteTint } from "../combat/HitFlash";
import {
  showGruntMeleeSwipe,
  showPlayerMeleeSwipe,
} from "../combat/MeleeSwipeFx";
import { pickAutoCastSpell } from "../combat/spellAutoCast";
import { SpellCastController } from "../combat/SpellCastController";
import {
  applyChanneledHeal,
  applyNova,
  spawnChanneledFireball,
} from "../combat/SpellEffects";
import {
  pickEnemyCombatTarget,
  updateEnemyBrain,
  wallTargetPoint,
} from "../ai/EnemyBrain";
import { JAVELINEER_TUNING, meleeCombatTuningForDef } from "../config/enemy";
import { buildNavGrid, type NavGrid } from "../pathfinding/grid";
import { showEnemyPaths, showHitboxes, showTouchInput } from "../debug/DebugState";
import { HitboxDebugDraw } from "../debug/HitboxDebugDraw";
import { PathDebugDraw } from "../debug/PathDebugDraw";
import {
  TouchInputDebugDraw,
  type FocusTapFlash,
} from "../debug/TouchInputDebugDraw";
import { ENTITY_BODY_RADIUS } from "../entities/entityPhysics";
import { spawnEnemy, type EnemyInstance } from "../entities/Enemy";
import { updateEnemyCombat } from "../entities/EnemyCombat";
import { destroyArrowRainTelegraph } from "../combat/ArrowRainTelegraph";
import { updateArrowRainCombat, updateJavelineerCombat } from "../entities/EnemyRangedCombat";
import {
  spawnEnemyProjectile,
  spawnPlayerProjectile,
  updateEnemyProjectile,
  updateProjectile,
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
import { evaluateNightEnd } from "./defenseNightLogic";
import { CastBar } from "../ui/CastBar";
import { SpellBar } from "../ui/SpellBar";
import { TargetIndicator } from "../ui/TargetIndicator";
import { buildGroundLayer } from "../world/buildGroundLayer";
import { configureDefenseObstacleSprite } from "../world/defenseObstacleSprite";
import {
  cameraWorldPoint,
  buildCombatStickUiMask,
  combatChromeLayout,
  bottomHudStripLayout,
  debugButtonPosition,
  hudBandHeight,
  hudTextPosition,
  nightReturnButtonPosition,
  readSafeInsets,
  type SafeInsets,
} from "../ui/screenLayout";
import { scaleUiX, scaleUiY } from "../core/displayScale";
import type { TouchButtonHandle } from "../ui/touchButton";
import { isE2EEnabled } from "../e2e/e2eMode";
import { publishE2E } from "../e2e/e2eGlobal";
import { SPELL_BAR, spellById } from "../config/spells";
import { UI_TEXTURE } from "../config/assets";
import { createCombatHudChrome, type CombatHudChrome } from "../ui/combatHudChrome";

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
  private spellBar!: SpellBar;
  private castBar!: CastBar;
  private debugBtn!: TouchButtonHandle;
  private safe!: SafeInsets;
  private onPointerUpBound = (p: Phaser.Input.Pointer) => this.onScreenTap(p);
  private onDebugMenuClose = (): void => this.setHudChromeVisible(true);
  private prevPlayerAttackPhase: AttackPhase = "idle";
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private hudChrome!: CombatHudChrome;

  constructor() {
    super({ key: "Defense" });
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
  }

  create(): void {
    configureSceneInput(this);
    this.save = { ...(this.registry.get("save") as SaveGame) };
    if (!this.save.spellBar?.slots?.length) {
      this.save.spellBar = {
        slots: createDefaultSpellBarSlots(),
        autoCast: createDefaultSpellBarAutoCast(),
      };
    }
    if (!this.save.spellBar.autoCast?.length) {
      this.save.spellBar.autoCast = createDefaultSpellBarAutoCast();
    }
    this.resetDefenseRunState();
    this.wallHp = Math.max(0, this.save.townWallHp);
    this.wallHpStart = this.wallHp;
    this.navGrid = buildNavGrid(DEFENSE_OBSTACLES, DEFENSE_MAP.cellSize);
    const store = this.registry.get("dataStore") as DataStore;
    const wave = store.getWaveForNight(this.save.night);
    if (wave) this.rewardGold = wave.rewardGold;

    const half = GAME.worldHalfSize;
    this.physics.world.setBounds(-half, -half, half * 2, half * 2);
    buildGroundLayer(this, half, this.save.night);

    this.add
      .rectangle(0, -half + 20, half * 2, 40, 0x52525b)
      .setOrigin(0.5, 0);

    this.obstacleGroup = this.physics.add.staticGroup();
    for (const obs of DEFENSE_OBSTACLES) {
      const rock = this.physics.add.staticImage(obs.x, obs.y, obs.textureKey);
      configureDefenseObstacleSprite(rock, obs.textureKey, obs.w, obs.h);
      rock.setDepth(2);
      this.obstacleGroup.add(rock);
    }

    this.cameras.main.setBounds(-half, -half, half * 2, half * 2);
    this.cameras.main.setZoom(1);

    this.player = new Player(this, 0, 0, this.save.player.hpMax);
    this.player.damageable.hp = this.save.player.hpMax;
    this.player.damageable.alive = true;
    this.playerInvulnMs = PLAYER_TUNING.nightSpawnInvulnMs;
    this.physics.add.collider(this.player.sprite, this.obstacleGroup);
    this.enemyGroup = this.physics.add.group();
    this.physics.add.collider(this.player.sprite, this.enemyGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.collider(this.enemyGroup, this.obstacleGroup);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.safe = readSafeInsets();
    const chrome = combatChromeLayout(this, this.safe);
    this.hudChrome = createCombatHudChrome(this);

    const bottomStrip = bottomHudStripLayout(this, this.safe);
    if (isE2EEnabled() && typeof window !== "undefined") {
      (window as typeof window & { __HUD_DEBUG__?: Record<string, unknown> }).__HUD_DEBUG__ =
        {
          bottomChromeTextureKey: null,
          stripCenterY: bottomStrip.stripCenterY,
          stripH: bottomStrip.stripH,
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
      { frameTextureKey: UI_TEXTURE.modeRect },
    );

    this.autoToggle = createTouchToggleButton(
      this,
      chrome.autoX,
      chrome.autoY,
      "AUTO",
      chrome.toggleW,
      chrome.toggleH,
      () => {
        this.autoAttackEnabled = !this.autoAttackEnabled;
        this.refreshAutoToggle();
      },
      210,
      { frameTextureKey: UI_TEXTURE.autoRect },
    );

    this.spellCaster = new SpellCastController();
    this.castBar = new CastBar(this);
    this.spellBar = new SpellBar(
      this,
      this.save.spellBar.slots,
      this.save.spellBar.autoCast,
      this.spellCaster,
      {
        onCastRequest: (id) => this.onSpellCastRequest(id),
        onAutoCastToggle: (slot) => this.onSpellAutoCastToggle(slot),
      },
    );
    this.spellBar.refreshAutoCastBorders(this.save.spellBar.autoCast);

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
    this.hitboxDebug = new HitboxDebugDraw(this);
    this.pathDebug = new PathDebugDraw(this);
    this.touchDebug = new TouchInputDebugDraw(this);
    this.input.on("pointerup", this.onPointerUpBound);

    const hudPos = hudTextPosition(this.safe);
    this.hudText = this.add
      .text(hudPos.x, hudPos.y, "", {
        fontSize: `${scaleUiX(16)}px`,
        color: "#fafafa",
        resolution: (this.registry.get("renderResolution") as number | undefined) ?? 1,
      })
      .setScrollFactor(0)
      .setDepth(200);

    const dbgPos = debugButtonPosition(this, this.safe);
    const strip = bottomHudStripLayout(this, this.safe);
    const spellClearY =
      strip.stripCenterY +
      SPELL_BAR.slotSizePx / 2 +
      scaleUiY(14) +
      scaleUiX(36) / 2;
    dbgPos.y = Math.max(dbgPos.y, spellClearY);
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

    const w = this.scale.width;
    const spellRect = this.spellBar.getScreenRect();
    const uiMask = buildCombatStickUiMask(
      this,
      chrome,
      spellRect,
      this.debugBtn.container,
    );
    this.stick = new VirtualStick(this, {
      blockers: this.uiBlockers,
      excludeZones: [{ x: 0, y: 0, width: w, height: chrome.hudBand }],
      uiScreenRects: uiMask,
      dragThresholdPx: chrome.stickDragThreshold,
      radius: chrome.stickRadius,
    });

    this.game.events.on("debug-menu-close", this.onDebugMenuClose);

    this.refreshModeToggle(this.player.mode);
    this.refreshAutoToggle();

    if (wave && !isE2EEnabled()) {
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
      this.game.events.off("debug-menu-close", this.onDebugMenuClose);
      this.input.off("pointerup", this.onPointerUpBound);
      this.stick.destroy(this);
      this.targetIndicator.destroy();
      this.castBar.destroy();
      this.spellBar.destroy();
      this.hitboxDebug.destroy();
      this.pathDebug.destroy();
      this.touchDebug.destroy();
      for (const p of this.projectiles) p.sprite.destroy();
      this.projectiles = [];
      for (const p of this.enemyProjectiles) p.sprite.destroy();
      this.enemyProjectiles = [];
      for (const e of this.enemies) {
        destroyArrowRainTelegraph(e.arrowRain?.telegraph);
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
      if (channel.type === "channeling") {
        this.castBar.setVisible(true);
        this.castBar.setWorldPosition(px, py);
        this.castBar.setProgress(channel.progress);
      } else if (channel.type === "interrupted") {
        this.castBar.setVisible(false);
      } else if (channel.type === "completed") {
        this.castBar.setVisible(false);
        this.resolveSpellEffect(channel.def);
      }
    } else {
      this.player.setVelocityFromStick(dir.x, dir.y, this.save.player.moveSpeed);
      this.castBar.setVisible(false);
    }

    if (!this.spellCaster.isChanneling()) {
      this.tryAutoAttack();
      this.tryAutoCastSpells(dir.x, dir.y);
    }
    this.player.updateAttack(delta);
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

    this.projectiles = this.projectiles.filter((p) =>
      updateProjectile(
        p,
        delta,
        this.enemyTargets(),
        PLAYER_TUNING.rangedKnockback,
      ),
    );

    const playerHurtbox = {
      x: px,
      y: py,
      radius: ENTITY_BODY_RADIUS.player,
      damageable: this.player.damageable,
    };

    this.enemyProjectiles = this.enemyProjectiles.filter((p) =>
      updateEnemyProjectile(
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
      ),
    );

    this.playerInvulnMs = Math.max(0, this.playerInvulnMs - delta);
    this.focusSelectLockMs = Math.max(0, this.focusSelectLockMs - delta);

    this.enemyPathGoals.clear();
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const brain = updateEnemyBrain(e, e.nav, this.navGrid, px, py, delta);
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
              ...wallTargetPoint(e.sprite.x, e.sprite.y),
            };

      let playerHitDamage = 0;
      const meleeTuning = meleeCombatTuningForDef(e.defId);
      const onWallHit = () => {
        this.wallHp = Math.max(
          0,
          this.wallHp - meleeTuning.wallAttackDamage,
        );
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
              JAVELINEER_TUNING.projectileSpeed,
              req.damage,
              JAVELINEER_TUNING.projectileMaxTravel,
              id,
            ),
          );
        }
        if (jav.meleeHit) playerHitDamage += e.damage;
      } else {
        const hitPlayer = updateEnemyCombat(
          e,
          attackTarget,
          delta,
          onWallHit,
          meleeTuning,
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
            meleeTuning.attackActiveMs,
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

    this.drawDebugHitboxes();
    this.drawEnemyPaths();
    this.drawTouchDebug(delta);

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
    const casting = this.spellCaster.isChanneling();
    this.spellBar.refreshCooldownOverlays();
    if (!this.nightEnded) {
      this.hudText.setText(
        [
          `Night ${this.save.night} · Wall ${Math.max(0, Math.floor(this.wallHp))}`,
          `HP ${Math.floor(this.player.damageable.hp)}/${this.player.damageable.maxHp}${this.playerInvulnMs > 0 ? " (i-frames)" : ""}`,
          `Enemies ${living}${focus} · ${mode} · Auto ${auto}`,
          casting
            ? `Channeling… ${Math.floor(this.spellCaster.getChannelProgress() * 100)}%`
            : this.player.attackPhaseNow !== "idle"
              ? `ATK: ${this.player.attackPhaseNow}`
              : "Spells · tap enemy to focus · drag to move",
        ].join("\n"),
      );
    }

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
    const next = [...this.save.spellBar.autoCast];
    while (next.length < this.save.spellBar.slots.length) next.push(false);
    next[slotIndex] = !next[slotIndex];
    this.save.spellBar.autoCast = next;
    this.spellBar.refreshAutoCastBorders(next);
    persistSave(this.save);
  }

  private tryAutoCastSpells(stickX: number, stickY: number): void {
    const moving = Math.hypot(stickX, stickY) > 0.12;
    const pick = pickAutoCastSpell(
      this.save.spellBar.slots,
      this.save.spellBar.autoCast,
      moving,
      (id) => this.spellCaster.getCooldownRemaining(id),
      this.spellCaster.isChanneling(),
    );
    if (!pick) return;
    this.onSpellCastRequest(pick.spellId);
  }

  private onSpellCastRequest(spellId: string): void {
    if (this.spellCaster.isChanneling()) return;
    const begun = this.spellCaster.tryBeginCast(spellId);
    if (begun === false) return;
    if (begun === "channel") {
      this.player.sprite.setVelocity(0, 0);
      const target = this.facingTarget("ranged", true);
      if (target) this.player.faceToward(target.x, target.y);
      return;
    }
    this.resolveSpellEffect(begun);
  }

  private resolveSpellEffect(def: SpellDefinition): void {
    const mult = playerDamageMult(this.save.buildings);
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    switch (def.id) {
      case "nova":
        applyNova(px, py, def, this.enemyTargets(), mult);
        this.flashNova(px, py, def.novaRadius ?? 80);
        break;
      case "fireball": {
        const angle = this.player.getFacingAngle();
        const id = `spell_fb_${this.projectileSerial++}`;
        this.projectiles.push(
          spawnChanneledFireball(this, px, py, angle, def, mult, id),
        );
        break;
      }
      case "heal":
        applyChanneledHeal(this.player.damageable, def);
        break;
    }
    this.enemies = this.enemies.filter((e) => e.damageable.alive);
  }

  private flashNova(x: number, y: number, radius: number): void {
    const ring = this.add
      .circle(x, y, radius, 0xfef08a, 0.35)
      .setDepth(7);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.15,
      duration: 280,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
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
      if (d > PLAYER_TUNING.autoAttackMeleeRange) continue;
      if (bestMelee === null || d < bestMelee) bestMelee = d;
    }
    return bestMelee !== null ? "melee" : "ranged";
  }

  private onScreenTap(pointer: Phaser.Input.Pointer): void {
    const tapResult = this.stick.tryConsumeTap(pointer);
    if (this.isPointerOverUi(pointer)) return;
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
        pickRadiusWorld: PLAYER_TUNING.targetTapRadiusWorld,
        ageMs: 0,
      };
    }
    this.trySelectEnemyAt(world.x, world.y);
  }

  private openDebugMenu(): void {
    this.setHudChromeVisible(false);
    this.scene.launch("DebugMenu");
  }

  private setHudChromeVisible(visible: boolean): void {
    this.hudText.setVisible(visible);
    this.debugBtn.container.setVisible(visible);
    this.hudChrome?.setVisible(visible);
  }

  private transitionToTown(): void {
    if (this.scene.get("DebugMenu")?.scene.isActive()) {
      this.scene.stop("DebugMenu");
    }
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
    const r = PLAYER_TUNING.targetTapRadiusWorld;
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
        ? PLAYER_TUNING.autoAttackMeleeRange
        : PLAYER_TUNING.autoAttackRangedRange;
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
        ? PLAYER_TUNING.autoAttackMeleeRange
        : PLAYER_TUNING.autoAttackRangedRange;
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
      PLAYER_TUNING.rangedMaxRange,
      id,
    );
    this.projectiles.push(p);
  }

  private enemyTargets() {
    return this.enemies.map((e) => ({
      id: e.id,
      x: e.sprite.x,
      y: e.sprite.y,
      radius: ENTITY_BODY_RADIUS.enemy,
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
    this.pathDebug.drawObstacleZones(this.navGrid, DEFENSE_OBSTACLES);
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
    this.hitboxDebug.drawCircle(px, py, ENTITY_BODY_RADIUS.player);

    if (
      this.player.mode === "melee" &&
      this.player.attackPhaseNow === "active"
    ) {
      const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.meleeArcDeg / 2);
      this.hitboxDebug.drawMeleeArc(
        px,
        py,
        this.player.getFacingAngle(),
        PLAYER_TUNING.meleeRange,
        arcHalf,
      );
    }

    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      this.hitboxDebug.drawCircle(
        e.sprite.x,
        e.sprite.y,
        ENTITY_BODY_RADIUS.enemy,
      );
      if (e.combat.phase === "active") {
        const meleeTuning = meleeCombatTuningForDef(e.defId);
        const arcHalf = Phaser.Math.DegToRad(meleeTuning.attackArcDeg / 2);
        this.hitboxDebug.drawMeleeArc(
          e.sprite.x,
          e.sprite.y,
          e.combat.facing,
          meleeTuning.attackRange,
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
    this.autoToggle.setLabel(this.autoAttackEnabled ? "AUTO" : "AUTO");
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
          const angle = isE2EEnabled()
            ? 0
            : Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = isE2EEnabled() ? 200 : Phaser.Math.Between(180, 260);
          this.spawnEnemyAt(
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            enemyDef,
            group.enemyId,
          );
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
        hp: ENEMY_TUNING.gruntHp,
        speed: ENEMY_TUNING.gruntSpeed,
        damage: ENEMY_TUNING.attackDamage,
        behavior: "meleeChaser",
        textureKey: "enemy_grunt",
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
        enemy.sprite.destroy();
      },
      () => this.setFocusEnemy(id),
    );
    enemy.damageable.onDamaged = (_amount, flavor = "default") => {
      flashSpriteTint(this, enemy.sprite, flavor);
    };
    this.enemyGroup.add(enemy.sprite);
    this.enemies.push(enemy);
  }

  private endNight(won: boolean): void {
    if (this.nightEnded) return;
    this.nightEnded = true;

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
    if (this.enemies.length === 0) this.spawnEnemyAt(48, 0, undefined, "grunt", 1);
    this.player.faceToward(this.player.sprite.x + 48, this.player.sprite.y);
    this.player.tryStartAttack();
  }

  e2eTapRanged(): void {
    this.player.setAttackMode("ranged");
    this.refreshModeToggle("ranged");
    if (this.enemies.length === 0) this.spawnEnemyAt(80, 0, undefined, "grunt", 1);
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

  e2eSpawnEnemy(x: number, y: number): void {
    this.spawnEnemyAt(x, y, undefined, "grunt", 5);
  }

  e2eDamagePlayer(amount: number): void {
    applyDamage(this.player.damageable, amount);
    if (this.player.damageable.hp <= 0) {
      this.player.damageable.alive = false;
      this.endNight(false);
    }
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
    return out;
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
    return false;
  }
}