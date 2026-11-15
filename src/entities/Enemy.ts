import Phaser from "phaser";
import { SPRITE_DISPLAY } from "../config/assets";
import type { Damageable } from "../combat/DamageSystem";
import { createEnemyCombat, type EnemyCombatState } from "./EnemyCombat";

import type { EnemyNavState } from "../ai/EnemyBrain";
import { createEnemyNav } from "../ai/EnemyBrain";
import { ENTITY_BODY_RADIUS, tuneArcadeDynamicBody } from "./entityPhysics";

export type EnemyInstance = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  damageable: Damageable;
  combat: EnemyCombatState;
  nav: EnemyNavState;
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
  sprite.setDisplaySize(SPRITE_DISPLAY.enemy, SPRITE_DISPLAY.enemy);
  tuneArcadeDynamicBody(sprite, ENTITY_BODY_RADIUS.enemy, { pushable: true });
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
  return {
    id,
    sprite,
    damageable,
    combat: createEnemyCombat(),
    nav: createEnemyNav(),
  };
}