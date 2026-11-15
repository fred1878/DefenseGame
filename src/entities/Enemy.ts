import Phaser from "phaser";
import { ENEMY_TUNING, JAVELINEER_TUNING } from "../config";
import { SPRITE_DISPLAY } from "../config/assets";
import type { EnemyDef } from "../core/DataStore";
import type { Damageable } from "../combat/DamageSystem";
import { createEnemyCombat, type EnemyCombatState } from "./EnemyCombat";
import {
  createArrowRainCombatState,
  createJavelineerCombatState,
  type ArrowRainCombatState,
  type JavelineerCombatState,
} from "./EnemyRangedCombat";

import type { EnemyNavState } from "../ai/EnemyBrain";
import { createEnemyNav } from "../ai/EnemyBrain";
import { ENTITY_BODY_RADIUS, tuneArcadeDynamicBody } from "./entityPhysics";

export type EnemyBehaviorExtra = {
  strafeSign: 1 | -1;
  strafeFlipMs: number;
};

export type EnemyInstance = {
  id: string;
  defId: string;
  behavior: string;
  speed: number;
  damage: number;
  textureKey: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  damageable: Damageable;
  combat: EnemyCombatState;
  nav: EnemyNavState;
  behaviorExtra: EnemyBehaviorExtra;
  arrowRain?: ArrowRainCombatState;
  javelineer?: JavelineerCombatState;
};

export function spawnEnemy(
  scene: Phaser.Scene,
  id: string,
  x: number,
  y: number,
  def: EnemyDef,
  defId: string,
  onDeath: () => void,
  onTap?: () => void,
): EnemyInstance {
  const sprite = scene.physics.add.sprite(x, y, def.textureKey);
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
    hp: def.hp,
    maxHp: def.hp,
    alive: true,
    team: "enemy",
    onDeath,
  };
  const enemy: EnemyInstance = {
    id,
    defId,
    behavior: def.behavior,
    speed: def.speed ?? ENEMY_TUNING.gruntSpeed,
    damage: def.damage ?? ENEMY_TUNING.attackDamage,
    textureKey: def.textureKey,
    sprite,
    damageable,
    combat: createEnemyCombat(),
    nav: createEnemyNav(),
    behaviorExtra: {
      strafeSign: 1,
      strafeFlipMs: JAVELINEER_TUNING.orbitFlipMs,
    },
  };
  if (def.behavior === "arrowRainArcher") {
    enemy.arrowRain = createArrowRainCombatState();
  }
  if (def.behavior === "javelineer") {
    enemy.javelineer = createJavelineerCombatState();
  }
  return enemy;
}