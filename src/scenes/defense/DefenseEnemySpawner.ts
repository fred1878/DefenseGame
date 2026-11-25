import type Phaser from "phaser";
import { flashSpriteTint } from "../../combat/HitFlash";
import { destroyArrowRainTelegraph } from "../../combat/ArrowRainTelegraph";
import type { DataStore, EnemyDef } from "../../core/DataStore";
import {
  reconfigureEnemyInstance,
  spawnEnemy,
  type EnemyInstance,
} from "../../entities/Enemy";
import { cancelEnemyMeleeFxTimer } from "../../combat/enemyMeleeFxSchedule";
import { destroyEnemyNameplate } from "../../ui/enemyNameplate";

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

type SceneEnemyPool = {
  inactive: EnemyInstance[];
  serial: number;
};

const sceneEnemyPools = new WeakMap<Phaser.Scene, SceneEnemyPool>();

function enemyPoolFor(scene: Phaser.Scene): SceneEnemyPool {
  let pool = sceneEnemyPools.get(scene);
  if (!pool) {
    pool = { inactive: [], serial: 0 };
    sceneEnemyPools.set(scene, pool);
  }
  return pool;
}

function nextDefenseEnemyId(scene: Phaser.Scene): string {
  const pool = enemyPoolFor(scene);
  pool.serial += 1;
  return `e_${pool.serial}`;
}

function releaseDefenseEnemyToPool(
  host: DefenseEnemySpawnerHost,
  enemy: EnemyInstance,
): void {
  cancelEnemyMeleeFxTimer(enemy.combat);
  destroyArrowRainTelegraph(enemy.arrowRain?.telegraph);
  destroyArrowRainTelegraph(enemy.lobber?.telegraph);
  if (enemy.arrowRain) enemy.arrowRain.telegraph = undefined;
  if (enemy.lobber) enemy.lobber.telegraph = undefined;

  const body = enemy.sprite.body as Phaser.Physics.Arcade.Body | null;
  body?.stop();
  if (body) body.enable = false;
  enemy.sprite.setActive(false).setVisible(false);
  host.enemyGroup.remove(enemy.sprite);

  enemyPoolFor(host.scene).inactive.push(enemy);
  host.hooks.onRemovedFromPlay();
}

/** Destroy every pooled enemy shell when the defense scene shuts down. */
export function destroyDefenseEnemyPool(scene: Phaser.Scene): void {
  const pool = sceneEnemyPools.get(scene);
  if (!pool) return;
  for (const enemy of pool.inactive) {
    destroyArrowRainTelegraph(enemy.arrowRain?.telegraph);
    destroyArrowRainTelegraph(enemy.lobber?.telegraph);
    enemy.sprite.destroy();
    destroyEnemyNameplate(enemy.nameplate);
  }
  pool.inactive.length = 0;
  sceneEnemyPools.delete(scene);
}

export function enemyDefById(store: DataStore, defId: string): EnemyDef {
  const def = store.enemies[defId];
  if (!def) {
    throw new Error(`enemies.json must define "${defId}" before spawning`);
  }
  return def;
}

/** Spawn one enemy into the defense scene lists (REFACTOR_PLAN PR3 + PR12 pool). */
export function spawnDefenseEnemyAt(
  host: DefenseEnemySpawnerHost,
  x: number,
  y: number,
  def?: EnemyDef,
  defId = "grunt",
  hpOverride?: number,
): void {
  const base = def ?? enemyDefById(host.dataStore, defId);
  const spawnDef =
    hpOverride !== undefined ? { ...base, hp: hpOverride } : base;
  const id = nextDefenseEnemyId(host.scene);
  let enemy!: EnemyInstance;
  const onDeath = () => releaseDefenseEnemyToPool(host, enemy);
  const onTap = () => host.hooks.onFocusEnemy(id);
  const pooled = enemyPoolFor(host.scene).inactive.pop();
  if (pooled) {
    enemy = pooled;
    reconfigureEnemyInstance(
      enemy,
      host.scene,
      id,
      x,
      y,
      spawnDef,
      defId,
      onDeath,
      onTap,
    );
  } else {
    enemy = spawnEnemy(
      host.scene,
      id,
      x,
      y,
      spawnDef,
      defId,
      onDeath,
      onTap,
    );
  }

  enemy.damageable.onDamaged = (_amount, flavor) => {
    flashSpriteTint(host.scene, enemy.sprite, flavor);
  };
  host.enemyGroup.add(enemy.sprite);
  host.maskWorldObject?.(enemy.sprite);
  host.maskWorldObject?.(enemy.nameplate.container);
  host.enemies.push(enemy);
}