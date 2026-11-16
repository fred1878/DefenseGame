import Phaser from "phaser";
import {
  SPRITE_DISPLAY,
  enemyTextureKey,
  type PlayerCardinal,
} from "../content/assets";
import { resolveEnemyCardinal } from "./enemyFacing";
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
  createStationaryRangedCombatState,
  createLobberCombatState,
  type ArrowRainCombatState,
  type JavelineerCombatState,
  type LobberCombatState,
  type StationaryRangedCombatState,
} from "./EnemyRangedCombat";

import type { EnemyNavState } from "../ai/EnemyBrain";
import { createEnemyNav } from "../ai/EnemyBrain";
import {
  enemyCollisionBodyRadius,
  tuneArcadeDynamicBody,
} from "./entityPhysics";
import {
  createEnemyNameplate,
  hideEnemyNameplateOnDeath,
  updateEnemyNameplate,
  type EnemyNameplate,
} from "../ui/enemyNameplate";

export type EnemyBehaviorExtra = {
  strafeSign: 1 | -1;
  strafeFlipMs: number;
  chargeWindupMs: number;
  chargeActiveMs: number;
  chargeCooldownMs: number;
};

export type EnemyInstance = {
  id: string;
  defId: string;
  behavior: string;
  speed: number;
  damage: number;
  textureKey: string;
  cardinalFacing: PlayerCardinal;
  combatTuning: ResolvedEnemyCombat;
  sprite: Phaser.Physics.Arcade.Sprite;
  damageable: Damageable;
  combat: EnemyCombatState;
  nav: EnemyNavState;
  behaviorExtra: EnemyBehaviorExtra;
  arrowRain?: ArrowRainCombatState;
  javelineer?: JavelineerCombatState;
  stationaryRanged?: StationaryRangedCombatState;
  lobber?: LobberCombatState;
  nameplate: EnemyNameplate;
  displayName: string;
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
  const sprite = scene.physics.add.sprite(
    x,
    y,
    enemyTextureKey(def.textureKey, "s"),
  );
  const side = worldDisplayPx(SPRITE_DISPLAY.enemy, scene.registry);
  sprite.setDisplaySize(side, side);
  tuneArcadeDynamicBody(
    sprite,
    worldUnit(enemyCollisionBodyRadius(def.behavior), scene.registry),
    { pushable: true },
  );
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
    onDeath: () => {
      hideEnemyNameplateOnDeath(nameplate, scene);
      onDeath();
    },
  };
  const combatTuning = resolveEnemyCombat(def.behavior, def.combat);
  const nameplate = createEnemyNameplate(
    scene,
    x,
    y,
    def.displayName,
    side,
  );
  updateEnemyNameplate(nameplate, x, y, side, damageable);

  const enemy: EnemyInstance = {
    id,
    defId,
    behavior: def.behavior,
    speed: def.speed ?? DEFAULT_ENEMY_BASE.speed,
    damage: def.damage ?? DEFAULT_ENEMY_BASE.damage,
    textureKey: def.textureKey,
    cardinalFacing: "s",
    displayName: def.displayName,
    combatTuning,
    sprite,
    damageable,
    combat: createEnemyCombat(),
    nav: createEnemyNav(),
    nameplate,
    behaviorExtra: {
      strafeSign: 1,
      strafeFlipMs: combatTuning.javelineer?.orbitFlipMs ?? 1400,
      chargeWindupMs: 0,
      chargeActiveMs: 0,
      chargeCooldownMs: 0,
    },
  };
  if (def.behavior === "arrowRainArcher") {
    enemy.arrowRain = createArrowRainCombatState();
  }
  if (def.behavior === "javelineer") {
    enemy.javelineer = createJavelineerCombatState();
  }
  if (def.behavior === "stationaryRanged") {
    enemy.stationaryRanged = createStationaryRangedCombatState();
  }
  if (def.behavior === "lobber") {
    enemy.lobber = createLobberCombatState();
  }
  return enemy;
}

export function updateEnemySpriteFacing(enemy: EnemyInstance): void {
  const body = enemy.sprite.body as Phaser.Physics.Arcade.Body | null;
  const vx = body?.velocity.x ?? 0;
  const vy = body?.velocity.y ?? 0;
  const combatActive = enemy.combat.phase !== "idle";
  const card = resolveEnemyCardinal(
    vx,
    vy,
    enemy.combat.facing,
    enemy.cardinalFacing,
    combatActive,
  );
  if (card === enemy.cardinalFacing) return;
  enemy.cardinalFacing = card;
  const key = enemyTextureKey(enemy.textureKey, card);
  if (enemy.sprite.texture.key === key) return;
  enemy.sprite.setTexture(key);
  const reg = enemy.sprite.scene.registry;
  const side = worldDisplayPx(SPRITE_DISPLAY.enemy, reg);
  enemy.sprite.setDisplaySize(side, side);
}