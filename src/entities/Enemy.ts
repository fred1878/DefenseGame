import Phaser from "phaser";
import type { Damageable } from "../combat/DamageSystem";

export type EnemyInstance = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  damageable: Damageable;
};

export function spawnEnemy(
  scene: Phaser.Scene,
  id: string,
  x: number,
  y: number,
  hp: number,
  onDeath: () => void,
): EnemyInstance {
  const sprite = scene.physics.add.sprite(x, y, "enemy_grunt");
  sprite.setCircle(12);
  sprite.setDepth(5);
  const damageable: Damageable = {
    id,
    hp,
    maxHp: hp,
    alive: true,
    team: "enemy",
    onDeath,
  };
  return { id, sprite, damageable };
}

export function chasePlayer(
  enemy: EnemyInstance,
  playerX: number,
  playerY: number,
  speed: number,
): void {
  if (!enemy.damageable.alive) return;
  const sprite = enemy.sprite;
  const angle = Math.atan2(playerY - sprite.y, playerX - sprite.x);
  sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
}