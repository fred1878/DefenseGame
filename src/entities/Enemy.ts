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
  onTap?: () => void,
): EnemyInstance {
  const sprite = scene.physics.add.sprite(x, y, "enemy_grunt");
  sprite.setCircle(12);
  sprite.setDepth(5);
  sprite.setInteractive(
    new Phaser.Geom.Circle(0, 0, 26),
    Phaser.Geom.Circle.Contains,
  );
  if (onTap) {
    sprite.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        onTap();
      },
    );
  }
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