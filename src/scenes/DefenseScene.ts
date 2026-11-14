import Phaser from "phaser";
import { ENEMY_TUNING, GAME, PLAYER_TUNING, type NightResult, type SaveGame } from "../config";
import { DataStore } from "../core/DataStore";
import {
  applyNightResult,
  persistSave,
  playerDamageMult,
} from "../core/GameState";
import { applyDamage } from "../combat/DamageSystem";
import { chasePlayer, spawnEnemy, type EnemyInstance } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { configureSceneInput } from "../input/inputTuning";
import { VirtualStick } from "../input/VirtualStick";
import { createTouchCircleButton } from "../ui/touchButton";

export class DefenseScene extends Phaser.Scene {
  private save!: SaveGame;
  private player!: Player;
  private stick!: VirtualStick;
  private enemies: EnemyInstance[] = [];
  private hudText!: Phaser.GameObjects.Text;
  private attackButton!: Phaser.GameObjects.Container;
  private wallHp = 0;
  private touchCooldown = 0;
  private rewardGold = 40;
  private spawnPlanComplete = false;
  private nightEnded = false;

  constructor() {
    super({ key: "Defense" });
  }

  create(): void {
    configureSceneInput(this);
    this.save = { ...(this.registry.get("save") as SaveGame) };
    this.wallHp = this.save.townWallHp;
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

    this.player = new Player(
      this,
      0,
      0,
      this.save.player.hpMax,
    );
    this.player.damageable.hp = this.save.player.hp;
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    const margin = 48;
    this.attackButton = createTouchCircleButton(
      this,
      this.scale.width - margin - 44,
      this.scale.height - margin - 44,
      "ATK",
      44,
      () => this.player.tryStartAttack(),
      200,
    );

    this.stick = new VirtualStick(this, {
      blockers: [this.attackButton],
      excludeZones: [{ x: 0, y: 0, width: GAME.width, height: 96 }],
    });

    this.hudText = this.add
      .text(12, 12, "", {
        fontSize: "16px",
        color: "#fafafa",
      })
      .setScrollFactor(0)
      .setDepth(200);

    if (wave) {
      this.scheduleWave(store, wave);
    } else {
      this.spawnPlanComplete = true;
      this.spawnEnemyAt(120, -80);
    }

    this.events.on("shutdown", () => {
      this.stick.destroy(this);
    });
  }

  update(_time: number, delta: number): void {
    const dir = this.stick.getDirection();
    this.player.setVelocityFromStick(
      dir.x,
      dir.y,
      this.save.player.moveSpeed,
    );
    this.player.updateAttack(delta);
    const damage = PLAYER_TUNING.attackDamage * playerDamageMult(this.save.buildings);
    this.player.damageEnemiesInArc(
      this.enemies.map((e) => ({
        id: e.id,
        x: e.sprite.x,
        y: e.sprite.y,
        radius: 12,
        damageable: e.damageable,
      })),
      damage,
    );

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const e of this.enemies) {
      if (!e.damageable.alive) continue;
      chasePlayer(e, px, py, ENEMY_TUNING.gruntSpeed);
    }

    this.touchCooldown -= delta;
    if (this.touchCooldown <= 0) {
      for (const e of this.enemies) {
        if (!e.damageable.alive) continue;
        const d = Phaser.Math.Distance.Between(px, py, e.sprite.x, e.sprite.y);
        if (d < 28) {
          applyDamage(this.player.damageable, ENEMY_TUNING.touchDamage);
          this.touchCooldown = ENEMY_TUNING.touchCooldownMs;
          break;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.damageable.alive);
    if (this.player.sprite.body) {
      const scale = this.player.attackPhaseNow === "active" ? 0.35 : 1;
      if (scale !== 1) {
        const body = this.player.sprite.body;
        body.velocity.x *= scale;
        body.velocity.y *= scale;
      }
    }

    const living = this.enemies.filter((e) => e.damageable.alive).length;
    this.hudText.setText(
      [
        `Night ${this.save.night} · Wall ${Math.max(0, Math.floor(this.wallHp))}`,
        `HP ${Math.floor(this.player.damageable.hp)}/${this.player.damageable.maxHp}`,
        `Enemies ${living}`,
        this.player.attackPhaseNow !== "idle" ? `ATK: ${this.player.attackPhaseNow}` : "Drag to move · ATK to swing",
      ].join("\n"),
    );

    if (!this.player.damageable.alive || this.wallHp <= 0) {
      this.endNight(false);
      return;
    }
    if (this.spawnPlanComplete && living === 0) {
      this.endNight(true);
    }
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
    const enemy = spawnEnemy(this, id, x, y, resolvedHp, () => {
      enemy.sprite.destroy();
    });
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
    this.save.player.hp = this.player.damageable.hp;
    next.player.hp = this.player.damageable.hp;
    if (won) next.townWallHp = Math.max(0, this.wallHp - wallDamage);
    persistSave(next);
    this.registry.set("save", next);
    this.scene.stop();
    this.scene.start("Town");
  }
}