import Phaser from "phaser";
import { SPRITE_DISPLAY } from "../content/assets";
import { worldDisplayPx, worldUnit } from "../core/worldPixelScale";
import type { EnemyDef } from "../core/DataStore";
import {
  DEFAULT_ENEMY_BASE,
  resolveEnemyCombat,
  type ResolvedEnemyCombat,
} from "../core/enemyTuning";
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
  combatTuning: ResolvedEnemyCombat;
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
  const side = worldDisplayPx(SPRITE_DISPLAY.enemy, scene.registry);
  sprite.setDisplaySize(side, side);
  tuneArcadeDynamicBody(sprite, worldUnit(ENTITY_BODY_RADIUS.enemy, scene.registry), {
    pushable: true,
  });
  sprite.setDepth(5);
  sprite.setInteractive(
    new Phaser.Geom.Circle(0, 0, worldUnit(26, scene.registry)),
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
  const combatTuning = resolveEnemyCombat(def.behavior, def.combat);
  const enemy: EnemyInstance = {
    id,
    defId,
    behavior: def.behavior,
    speed: def.speed ?? DEFAULT_ENEMY_BASE.speed,
    damage: def.damage ?? DEFAULT_ENEMY_BASE.damage,
    textureKey: def.textureKey,
    combatTuning,
    sprite,
    damageable,
    combat: createEnemyCombat(),
    nav: createEnemyNav(),
    behaviorExtra: {
      strafeSign: 1,
      strafeFlipMs: combatTuning.javelineer?.orbitFlipMs ?? 1400,
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