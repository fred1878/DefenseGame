import Phaser from "phaser";
import {
  ENEMY_TUNING,
  GAME,
  PLAYER_TUNING,
  type AttackMode,
  type NightResult,
  type SaveGame,
} from "../config";
import { DataStore } from "../core/DataStore";
import {
  applyNightResult,
  persistSave,
  playerDamageMult,
} from "../core/GameState";
import { applyDamage } from "../combat/DamageSystem";
import { chasePlayer, spawnEnemy, type EnemyInstance } from "../entities/Enemy";
import {
  spawnPlayerProjectile,
  updateProjectile,
  type PlayerProjectile,
} from "../entities/Projectile";
import { Player } from "../entities/Player";
import { configureSceneInput } from "../input/inputTuning";
import { VirtualStick } from "../input/VirtualStick";
import {
  createTouchCircleButton,
  createTouchToggleButton,
} from "../ui/touchButton";
import { TargetIndicator } from "../ui/TargetIndicator";

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
  private touchCooldown = 0;
  private playerInvulnMs = 0;
  private focusSelectLockMs = 0;
  private rewardGold = 40;
  private spawnPlanComplete = false;
  private nightEnded = false;
  private focusEnemyId: string | null = null;
  private targetIndicator!: TargetIndicator;
  private onPointerUpBound = (p: Phaser.Input.Pointer) => this.onScreenTap(p);

  constructor() {
    super({ key: "Defense" });
  }

  create(): void {
    configureSceneInput(this);
    this.save = { ...(this.registry.get("save") as SaveGame) };
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

    const margin = 48;
    const btnY = this.scale.height - margin - 44;
    const atkX = this.scale.width - margin - 44;

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

    this.uiBlockers = [
      this.attackButton,
      this.modeToggle.container,
      this.autoToggle.container,
    ];

    this.stick = new VirtualStick(this, {
      blockers: this.uiBlockers,
      excludeZones: [{ x: 0, y: 0, width: GAME.width, height: 110 }],
      dragThresholdPx: 18,
    });

    this.targetIndicator = new TargetIndicator(this);
    this.input.on("pointerup", this.onPointerUpBound);

    this.hudText = this.add
      .text(12, 12, "", {
        fontSize: "16px",
        color: "#fafafa",
      })
      .setScrollFactor(0)
      .setDepth(200);

    this.refreshModeToggle(this.player.mode);
    this.refreshAutoToggle();

    if (wave) {
      this.scheduleWave(store, wave);
    } else {
      this.spawnPlanComplete = true;
      this.spawnEnemyAt(120, -80);
    }

    this.events.on("shutdown", () => {
      this.input.off("pointerup", this.onPointerUpBound);
      this.stick.destroy(this);
      this.targetIndicator.destroy();
      for (const p of this.projectiles) p.sprite.destroy();
      this.projectiles = [];
    });
  }

  update(_time: number, delta: number): void {
    const dir = this.stick.getDirection();
    this.player.setVelocityFromStick(dir.x, dir.y, this.save.player.moveSpeed);

    this.tryAutoAttack();
    this.player.updateAttack(delta);

    const mult = playerDamageMult(this.save.buildings);
    this.player.damageEnemiesInArc(this.enemyTargets(), PLAYER_TUNING.meleeDamage * mult);

    if (this.player.consumeRangedShot()) {
      this.fireProjectile(PLAYER_TUNING.rangedDamage * mult);
    }

    this.projectiles = this.projectiles.filter((p) =>
      updateProjectile(p, delta, this.enemyTargets()),
    );

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      chasePlayer(e, px, py, ENEMY_TUNING.gruntSpeed);
    }

    this.playerInvulnMs = Math.max(0, this.playerInvulnMs - delta);
    this.focusSelectLockMs = Math.max(0, this.focusSelectLockMs - delta);
    this.touchCooldown -= delta;
    if (this.touchCooldown <= 0 && this.playerInvulnMs <= 0) {
      for (const e of this.enemies) {
        if (!e.damageable.alive) continue;
        const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
        if (d < 28) {
          applyDamage(this.player.damageable, ENEMY_TUNING.touchDamage);
          if (this.player.damageable.hp <= 0) {
            this.player.damageable.alive = false;
          } else {
            this.player.damageable.alive = true;
          }
          this.touchCooldown = ENEMY_TUNING.touchCooldownMs;
          this.playerInvulnMs = PLAYER_TUNING.playerHitInvulnMs;
          break;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.damageable.alive);
    this.syncFocusTarget();

    const living = this.enemies.filter((e) => e.damageable.alive).length;
    const focus =
      this.focusEnemyId && this.getEnemyById(this.focusEnemyId)?.damageable.alive
        ? " (focus)"
        : "";
    const mode = this.player.mode === "melee" ? "Melee" : "Ranged";
    const auto = this.autoAttackEnabled ? "ON" : "OFF";
    this.hudText.setText(
      [
        `Night ${this.save.night} · Wall ${Math.max(0, Math.floor(this.wallHp))}`,
        `HP ${Math.floor(this.player.damageable.hp)}/${this.player.damageable.maxHp}${this.playerInvulnMs > 0 ? " (i-frames)" : ""}`,
        `Enemies ${living}${focus} · ${mode} · Auto ${auto}`,
        this.player.attackPhaseNow !== "idle"
          ? `ATK: ${this.player.attackPhaseNow}`
          : "Tap enemy to focus · drag to move",
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

  private manualAttack(): void {
    const target = this.facingTarget(this.player.mode, true);
    if (target) this.player.faceToward(target.x, target.y);
    this.player.tryStartAttack();
  }

  private tryAutoAttack(): void {
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

    const world = this.cameras.main.getWorldPoint(screenX, screenY);
    this.trySelectEnemyAt(world.x, world.y);
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
    if (
      pointer.y <= 110 &&
      pointer.x >= 0 &&
      pointer.x <= GAME.width
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
    }));
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