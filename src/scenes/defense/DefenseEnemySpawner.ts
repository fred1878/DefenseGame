import type Phaser from "phaser";
import { flashSpriteTint } from "../../combat/HitFlash";
import { destroyArrowRainTelegraph } from "../../combat/ArrowRainTelegraph";
import type { DataStore, EnemyDef } from "../../core/DataStore";
import { spawnEnemy, type EnemyInstance } from "../../entities/Enemy";

export type DefenseEnemySpawnerHooks = {
  onRemovedFromPlay: () => void;
  onFocusEnemy: (id: string) => void;
};

export type DefenseEnemySpawnerHost = {
  scene: Phaser.Scene;
  dataStore: DataStore;
  enemies: EnemyInstance[];
  enemyGroup: Phaser.Physics.Arcade.Group;
  hooks: DefenseEnemySpawnerHooks;
  maskWorldObject?: (go: Phaser.GameObjects.GameObject) => void;
};

export function defaultDefenseEnemyDef(store: DataStore): EnemyDef {
  const grunt = store.enemies.grunt;
  if (!grunt) {
    throw new Error("enemies.json must define grunt before spawning");
  }
  return grunt;
}

/** Spawn one enemy into the defense scene lists (REFACTOR_PLAN PR3). */
export function spawnDefenseEnemyAt(
  host: DefenseEnemySpawnerHost,
  x: number,
  y: number,
  def?: EnemyDef,
  defId = "grunt",
  hpOverride?: number,
): void {
  const base = def ?? defaultDefenseEnemyDef(host.dataStore);
  const spawnDef =
    hpOverride !== undefined ? { ...base, hp: hpOverride } : base;
  const id = `e_${host.enemies.length}_${Date.now()}`;
  const enemy = spawnEnemy(
    host.scene,
    id,
    x,
    y,
    spawnDef,
    defId,
    () => {
      destroyArrowRainTelegraph(enemy.arrowRain?.telegraph);
      destroyArrowRainTelegraph(enemy.lobber?.telegraph);
      enemy.sprite.destroy();
      host.hooks.onRemovedFromPlay();
    },
    () => host.hooks.onFocusEnemy(id),
  );
  enemy.damageable.onDamaged = (_amount, flavor = "default") => {
    flashSpriteTint(host.scene, enemy.sprite, flavor);
  };
  host.enemyGroup.add(enemy.sprite);
  host.maskWorldObject?.(enemy.sprite);
  host.maskWorldObject?.(enemy.nameplate.container);
  host.enemies.push(enemy);
}