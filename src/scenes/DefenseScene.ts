import Phaser from "phaser";
import {
  ENEMY_TUNING,
  GAME,
  PLAYER_TUNING,
  type AttackMode,
  type NightResult,
  createDefaultSpellBarSlots,
  type SaveGame,
  type SpellDefinition,
} from "../config";
import { DataStore } from "../core/DataStore";
import {
  applyNightResult,
  persistSave,
  playerDamageMult,
} from "../core/GameState";
import { applyDamage } from "../combat/DamageSystem";
import { SpellCastController } from "../combat/SpellCastController";
import {
  applyChanneledHeal,
  applyNova,
  spawnChanneledFireball,
} from "../combat/SpellEffects";
import { showHitboxes } from "../debug/DebugState";
import { HitboxDebugDraw } from "../debug/HitboxDebugDraw";
import { chasePlayer, spawnEnemy, type EnemyInstance } from "../entities/Enemy";
import { updateEnemyCombat } from "../entities/EnemyCombat";
import {
  spawnPlayerProjectile,
  updateProjectile,
  type PlayerProjectile,
} from "../entities/Projectile";
import { Player } from "../entities/Player";
import { configureSceneInput } from "../input/inputTuning";
import { VirtualStick } from "../input/VirtualStick";
import {
  createTouchButton,
  createTouchCircleButton,
  createTouchToggleButton,
} from "../ui/touchButton";
import { CastBar } from "../ui/CastBar";
import { SpellBar } from "../ui/SpellBar";
import { TargetIndicator } from "../ui/TargetIndicator";
import {
  cameraWorldPoint,
  debugButtonPosition,
  hudBandHeight,
  hudTextPosition,
  readSafeInsets,
  type SafeInsets,
} from "../ui/screenLayout";
import type { TouchButtonHandle } from "../ui/touchButton";

export class DefenseScene extends Phaser.Scene {
  private save!: SaveGame;
  private player!: Player;
  private stick!: VirtualStick;
  private enemies: EnemyInstance[] = [];
  private projectiles: PlayerProjectile[] = [];
  private projectileSerial = 0;
  private hudText!: Phaser.GameObjects.Text;
  private attackButton!: Phaser.GameObjects.Container;
  private autoAttackEnabled = false;
  private autoToggle!: ReturnType<typeof createTouchToggleButton>;
  private modeToggle!: ReturnType<typeof createTouchToggleButton>;
  private uiBlockers: Phaser.GameObjects.GameObject[] = [];
  private wallHp = 0;
  private playerInvulnMs = 0;
  private hitboxDebug!: HitboxDebugDraw;
  private focusSelectLockMs = 0;
  private rewardGold = 40;
  private spawnPlanComplete = false;
  private nightEnded = false;
  private focusEnemyId: string | null = null;
  private targetIndicator!: TargetIndicator;
  private spellCaster = new SpellCastController();
  private spellBar!: SpellBar;
  private castBar!: CastBar;
  private debugBtn!: TouchButtonHandle;
  private safe!: SafeInsets;
  private onPointerUpBound = (p: Phaser.Input.Pointer) => this.onScreenTap(p);
  private onDebugMenuClose = (): void => this.setHudChromeVisible(true);

  constructor() {
    super({ key: "Defense" });
  }

  create(): void {
    configureSceneInput(this);
    this.save = { ...(this.registry.get("save") as SaveGame) };
    if (!this.save.spellBar?.slots?.length) {
      this.save.spellBar = { slots: createDefaultSpellBarSlots() };
    }
    this.wallHp = Math.max(1, this.save.townWallHp);
    const store = this.registry.get("dataStore") as DataStore;
    const wave = store.getWaveForNight(this.save.night);
    if (wave) this.rewardGold = wave.rewardGold;

    const half = GAME.worldHalfSize;
    this.physics.world.setBounds(-half, -half, half * 2, half * 2);
    this.add.tileSprite(0, 0, half * 2, half * 2, "ground").setOrigin(0.5);

    this.add
      .rectangle(-half + 20, 0, 40, half * 2, 0x52525b)
      .setOrigin(0, 0.5);

    this.cameras.main.setBounds(-half, -half, half * 2, half * 2);
    this.cameras.main.setZoom(1);

    this.player = new Player(this, 0, 0, this.save.player.hpMax);
    this.player.damageable.hp = this.save.player.hpMax;
    this.player.damageable.alive = true;
    this.playerInvulnMs = PLAYER_TUNING.nightSpawnInvulnMs;
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.safe = readSafeInsets();
    const margin = 48;
    const btnY = this.scale.height - margin - this.safe.bottom - 44;
    const atkX = this.scale.width - margin - this.safe.right - 44;

    this.attackButton = createTouchCircleButton(
      this,
      atkX,
      btnY,
      "ATK",
      44,
      () => this.manualAttack(),
      200,
    );

    this.modeToggle = createTouchToggleButton(
      this,
      atkX - 100,
      btnY,
      "MEL",
      72,
      40,
      () => {
        const mode = this.player.toggleAttackMode();
        this.refreshModeToggle(mode);
      },
      200,
    );

    this.autoToggle = createTouchToggleButton(
      this,
      atkX,
      btnY - 96,
      "AUTO",
      72,
      40,
      () => {
        this.autoAttackEnabled = !this.autoAttackEnabled;
        this.refreshAutoToggle();
      },
      200,
    );

    this.spellCaster = new SpellCastController();
    this.castBar = new CastBar(this);
    this.spellBar = new SpellBar(
      this,
      this.save.spellBar.slots,
      this.spellCaster,
      { onCastRequest: (id) => this.onSpellCastRequest(id) },
    );

    this.uiBlockers = [
      this.attackButton,
      this.modeToggle.container,
      this.autoToggle.container,
      ...this.spellBar.getUiContainers(),
    ];

    const w = this.scale.width;
    const h = this.scale.height;
    const hudBand = hudBandHeight(this.safe.top);
    const spellRect = this.spellBar.getScreenRect();
    this.stick = new VirtualStick(this, {
      blockers: this.uiBlockers,
      excludeZones: [{ x: 0, y: 0, width: w, height: hudBand }],
      uiScreenRects: [
        { x: 0, y: 0, width: w, height: hudBand },
        {
          x: w - 230,
          y: h - 270 - this.safe.bottom,
          width: 230,
          height: 270 + this.safe.bottom,
        },
        spellRect,
      ],
      dragThresholdPx: 18,
    });

    this.targetIndicator = new TargetIndicator(this);
    this.hitboxDebug = new HitboxDebugDraw(this);
    this.input.on("pointerup", this.onPointerUpBound);

    const hudPos = hudTextPosition(this.safe);
    this.hudText = this.add
      .text(hudPos.x, hudPos.y, "", {
        fontSize: "16px",
        color: "#fafafa",
      })
      .setScrollFactor(0)
      .setDepth(200);

    const dbgPos = debugButtonPosition(this, this.safe);
    this.debugBtn = createTouchButton(
      this,
      dbgPos.x,
      dbgPos.y,
      "Debug",
      () => this.openDebugMenu(),
      {
        width: 88,
        height: 36,
        depth: 200,
        fontSize: "14px",
        fillColor: 0x3f3f46,
        strokeColor: 0xa1a1aa,
      },
    );
    this.uiBlockers.push(this.debugBtn.container);

    this.game.events.on("debug-menu-close", this.onDebugMenuClose);

    this.refreshModeToggle(this.player.mode);
    this.refreshAutoToggle();

    if (wave) {
      this.scheduleWave(store, wave);
    } else {
      this.spawnPlanComplete = true;
      this.spawnEnemyAt(120, -80);
    }

    this.events.on("shutdown", () => {
      this.game.events.off("debug-menu-close", this.onDebugMenuClose);
      this.input.off("pointerup", this.onPointerUpBound);
      this.stick.destroy(this);
      this.targetIndicator.destroy();
      this.castBar.destroy();
      this.spellBar.destroy();
      this.hitboxDebug.destroy();
      for (const p of this.projectiles) p.sprite.destroy();
      this.projectiles = [];
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
    }
    this.player.updateAttack(delta);

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
      radius: 14,
      damageable: this.player.damageable,
    };

    this.playerInvulnMs = Math.max(0, this.playerInvulnMs - delta);
    this.focusSelectLockMs = Math.max(0, this.focusSelectLockMs - delta);

    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      const hitPlayer = updateEnemyCombat(e, playerHurtbox, delta);
      if (hitPlayer && this.playerInvulnMs <= 0) {
        applyDamage(this.player.damageable, ENEMY_TUNING.attackDamage);
        if (this.player.damageable.hp <= 0) {
          this.player.damageable.alive = false;
        } else {
          this.player.damageable.alive = true;
        }
        this.playerInvulnMs = PLAYER_TUNING.playerHitInvulnMs;
      }
      chasePlayer(e, px, py, ENEMY_TUNING.gruntSpeed);
    }

    this.drawDebugHitboxes();

    this.enemies = this.enemies.filter((e) => e.damageable.alive);
    this.syncFocusTarget();

    const living = this.enemies.filter((e) => e.damageable.alive).length;
    const focus =
      this.focusEnemyId && this.getEnemyById(this.focusEnemyId)?.damageable.alive
        ? " (focus)"
        : "";
    const mode = this.player.mode === "melee" ? "Melee" : "Ranged";
    const auto = this.autoAttackEnabled ? "ON" : "OFF";
    const casting = this.spellCaster.isChanneling();
    this.spellBar.refreshCooldownOverlays();
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

    if (this.player.damageable.hp <= 0) {
      this.endNight(false);
      return;
    }
    if (this.spawnPlanComplete && living === 0) {
      this.endNight(true);
    }
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
    const target = this.facingTarget(this.player.mode, true);
    if (target) this.player.faceToward(target.x, target.y);
    this.player.tryStartAttack();
  }

  private tryAutoAttack(): void {
    if (this.spellCaster.isChanneling()) return;
    if (!this.autoAttackEnabled || !this.player.canAttack()) return;
    const mode = this.player.mode;
    const target = this.facingTarget(mode, false);
    if (!target) return;
    this.player.faceToward(target.x, target.y);
    this.player.tryStartAttack();
  }

  private onScreenTap(pointer: Phaser.Input.Pointer): void {
    if (this.isPointerOverUi(pointer)) return;
    if (this.focusSelectLockMs > 0) return;

    const tapResult = this.stick.tryConsumeTap(pointer);
    if (tapResult.kind === "drag") return;

    const screenX = tapResult.kind === "tap" ? tapResult.x : pointer.x;
    const screenY = tapResult.kind === "tap" ? tapResult.y : pointer.y;

    const world = cameraWorldPoint(this.cameras.main, screenX, screenY);
    this.trySelectEnemyAt(world.x, world.y);
  }

  private openDebugMenu(): void {
    this.setHudChromeVisible(false);
    this.scene.launch("DebugMenu");
  }

  private setHudChromeVisible(visible: boolean): void {
    this.hudText.setVisible(visible);
    this.debugBtn.container.setVisible(visible);
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
    if (id) this.focusSelectLockMs = 220;
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
    mode: AttackMode,
    manual: boolean,
  ): { x: number; y: number } | null {
    const focused = this.focusedEnemyPosition(mode, manual);
    if (focused) return focused;
    return this.nearestEnemyForMode(mode);
  }

  private focusedEnemyPosition(
    mode: AttackMode,
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

  private nearestEnemyForMode(mode: AttackMode): { x: number; y: number } | null {
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
      radius: 12,
      damageable: e.damageable,
      sprite: e.sprite,
    }));
  }

  private drawDebugHitboxes(): void {
    if (!showHitboxes(this.registry)) {
      this.hitboxDebug.clear();
      return;
    }
    this.hitboxDebug.clear();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.hitboxDebug.drawCircle(px, py, 14);

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
      this.hitboxDebug.drawCircle(e.sprite.x, e.sprite.y, 12);
      if (e.combat.phase === "active") {
        const arcHalf = Phaser.Math.DegToRad(ENEMY_TUNING.attackArcDeg / 2);
        this.hitboxDebug.drawMeleeArc(
          e.sprite.x,
          e.sprite.y,
          e.combat.facing,
          ENEMY_TUNING.attackRange,
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
    this.modeToggle.setLabel(mode === "melee" ? "MEL" : "RNG");
    this.modeToggle.setOn(mode === "ranged");
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
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = Phaser.Math.Between(180, 260);
          this.spawnEnemyAt(
            Math.cos(angle) * dist,
            Math.sin(angle) * dist,
            enemyDef.hp,
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

  private spawnEnemyAt(x: number, y: number, hp?: number): void {
    const resolvedHp = hp ?? ENEMY_TUNING.gruntHp;
    const id = `e_${this.enemies.length}_${Date.now()}`;
    const enemy = spawnEnemy(
      this,
      id,
      x,
      y,
      resolvedHp,
      () => {
        enemy.sprite.destroy();
      },
      () => this.setFocusEnemy(id),
    );
    this.enemies.push(enemy);
  }

  private endNight(won: boolean): void {
    if (this.nightEnded) return;
    this.nightEnded = true;
    this.scene.pause();
    const wallDamage = won ? 2 : 12;
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
    if (won) next.townWallHp = Math.max(0, this.wallHp - wallDamage);
    persistSave(next);
    this.registry.set("save", next);
    this.scene.stop();
    this.scene.start("Town");
  }
}