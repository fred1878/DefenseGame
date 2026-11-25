import Phaser from "phaser";
import {
  SPRITE_DISPLAY,
  enemyTextureKey,
  type PlayerCardinal,
} from "../content/assets";
import { resolveEnemyCardinal } from "./enemyFacing";
import { worldDisplayPx, worldUnit } from "../core/worldPixelScale";
import { DEFENSE_RENDER_DEPTH } from "../config";
import type { EnemyDef } from "../core/DataStore";
import {
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
  createRangedHybridCombatState,
  type ArrowRainCombatState,
  type JavelineerCombatState,
  type LobberCombatState,
  type RangedHybridCombatState,
  type StationaryRangedCombatState,
} from "./EnemyRangedCombat";

import type { EnemyNavState } from "../ai/EnemyBrain";
import { createEnemyNav } from "../ai/EnemyBrain";
import {
  enemyCollisionBodyRadius,
  tuneArcadeDynamicBody,
} from "./entityPhysics";
import { reapplySpriteHitFlashIfActive } from "../combat/HitFlash";
import {
  createEnemyNameplate,
  prepareEnemyNameplateForRespawn,
  recycleEnemyNameplateAfterDeath,
  updateEnemyNameplate,
  type EnemyNameplate,
} from "../ui/enemyNameplate";
import { cancelEnemyMeleeFxTimer } from "../combat/enemyMeleeFxSchedule";

export type EnemyBehaviorExtra = {
  strafeSign: 1 | -1;
  strafeFlipMs: number;
  chargeWindupMs: number;
  chargeActiveMs: number;
  chargeCooldownMs: number;
  /** Player position when charge windup began (world px). */
  chargeAimX: number;
  chargeAimY: number;
  /** Normalized dash heading, locked when windup ends. */
  chargeDashDirX: number;
  chargeDashDirY: number;
  /** Prevents multi-hit during a single dash burst. */
  chargeHitThisDash: boolean;
  /** Remaining ms to hold at the ward screen post without micro-repositioning. */
  wardPostGraceMs: number;
  wardPostSnapPlayerX: number;
  wardPostSnapPlayerY: number;
  wardPostSnapAllyX: number;
  wardPostSnapAllyY: number;
  wardPostAnchorGoalX: number;
  wardPostAnchorGoalY: number;
  wardPostWasInHoldRadius: boolean;
  /** Set each brain tick — idle combat must not overwrite ward screen facing. */
  wardPostHolding: boolean;
};

export type EnemyInstance = {
  id: string;
  defId: string;
  behavior: string;
  speedWu: number;
  damage: number;
  weight: number;
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
  rangedHybrid?: RangedHybridCombatState;
  nameplate: EnemyNameplate;
  displayName: string;
  /** Per-frame status slow from spells (do not persist). */
  statusSpeedMul: number;
  /** Residual slide from player hits; merged into velocity after AI intent. */
  knockbackVx: number;
  knockbackVy: number;
};

function defaultBehaviorExtra(
  combatTuning: ResolvedEnemyCombat,
): EnemyBehaviorExtra {
  return {
    strafeSign: 1,
    strafeFlipMs: combatTuning.javelineer?.orbitFlipMs ?? 0,
    chargeWindupMs: 0,
    chargeActiveMs: 0,
    chargeCooldownMs: 0,
    chargeAimX: 0,
    chargeAimY: 0,
    chargeDashDirX: 0,
    chargeDashDirY: 0,
    chargeHitThisDash: false,
    wardPostGraceMs: 0,
    wardPostSnapPlayerX: 0,
    wardPostSnapPlayerY: 0,
    wardPostSnapAllyX: 0,
    wardPostSnapAllyY: 0,
    wardPostAnchorGoalX: 0,
    wardPostAnchorGoalY: 0,
    wardPostWasInHoldRadius: false,
    wardPostHolding: false,
  };
}

function bindEnemyBehaviorSubstate(enemy: EnemyInstance, behavior: string): void {
  delete enemy.arrowRain;
  delete enemy.javelineer;
  delete enemy.stationaryRanged;
  delete enemy.lobber;
  delete enemy.rangedHybrid;
  if (behavior === "arrowRainArcher") {
    enemy.arrowRain = createArrowRainCombatState();
  } else if (behavior === "javelineer") {
    enemy.javelineer = createJavelineerCombatState();
  } else if (behavior === "stationaryRanged") {
    enemy.stationaryRanged = createStationaryRangedCombatState();
  } else if (behavior === "lobber") {
    enemy.lobber = createLobberCombatState();
  } else if (behavior === "rangedHybrid") {
    enemy.rangedHybrid = createRangedHybridCombatState();
  }
}

function bindEnemySpriteTap(
  sprite: Phaser.Physics.Arcade.Sprite,
  onTap?: () => void,
): void {
  sprite.removeAllListeners("pointerdown");
  if (!onTap) return;
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

/** Reset a pooled enemy shell for a new spawn (PR12 pooling). */
export function reconfigureEnemyInstance(
  enemy: EnemyInstance,
  scene: Phaser.Scene,
  id: string,
  x: number,
  y: number,
  def: EnemyDef,
  defId: string,
  onDeath: () => void,
  onTap?: () => void,
): void {
  const combatTuning = resolveEnemyCombat(def.behavior, def.combat, defId);
  const side = worldDisplayPx(SPRITE_DISPLAY.enemy, scene.registry);
  const texKey = enemyTextureKey(def.textureKey, "s");

  cancelEnemyMeleeFxTimer(enemy.combat);
  enemy.id = id;
  enemy.defId = defId;
  enemy.behavior = def.behavior;
  enemy.speedWu = def.speedWu;
  enemy.damage = def.damage;
  enemy.weight = def.weight;
  enemy.textureKey = def.textureKey;
  enemy.cardinalFacing = "s";
  enemy.displayName = def.displayName;
  enemy.combatTuning = combatTuning;
  enemy.combat = createEnemyCombat();
  enemy.nav = createEnemyNav();
  enemy.statusSpeedMul = 1;
  enemy.knockbackVx = 0;
  enemy.knockbackVy = 0;
  enemy.behaviorExtra = defaultBehaviorExtra(combatTuning);
  bindEnemyBehaviorSubstate(enemy, def.behavior);

  enemy.damageable.id = id;
  enemy.damageable.hp = def.hp;
  enemy.damageable.maxHp = def.hp;
  enemy.damageable.alive = true;
  enemy.damageable.onDeath = () => {
    recycleEnemyNameplateAfterDeath(enemy.nameplate, scene, () => {});
    onDeath();
  };

  const sprite = enemy.sprite;
  sprite.setTexture(texKey);
  sprite.setPosition(x, y);
  sprite.setDisplaySize(side, side);
  tuneArcadeDynamicBody(
    sprite,
    worldUnit(enemyCollisionBodyRadius(defId), scene.registry),
    { pushable: true, worldBounds: true },
  );
  sprite.setDepth(DEFENSE_RENDER_DEPTH.enemy);
  sprite.clearTint();
  sprite.setAlpha(1);
  sprite.setActive(true).setVisible(true);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.reset(x, y);
  body.enable = true;
  body.setVelocity(0, 0);
  bindEnemySpriteTap(sprite, onTap);

  prepareEnemyNameplateForRespawn(enemy.nameplate, scene);
  enemy.nameplate.nameText.setText(def.displayName);
  updateEnemyNameplate(enemy.nameplate, x, y, side, enemy.damageable);
}

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
    worldUnit(enemyCollisionBodyRadius(defId), scene.registry),
    { pushable: true, worldBounds: true },
  );
  sprite.setDepth(DEFENSE_RENDER_DEPTH.enemy);
  sprite.setInteractive(
    new Phaser.Geom.Circle(0, 0, worldUnit(26, scene.registry)),
    Phaser.Geom.Circle.Contains,
  );
  bindEnemySpriteTap(sprite, onTap);
  const damageable: Damageable = {
    id,
    hp: def.hp,
    maxHp: def.hp,
    alive: true,
    team: "enemy",
    onDeath: () => {
      recycleEnemyNameplateAfterDeath(nameplate, scene, () => {});
      onDeath();
    },
  };
  const combatTuning = resolveEnemyCombat(def.behavior, def.combat, defId);
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
    speedWu: def.speedWu,
    damage: def.damage,
    weight: def.weight,
    textureKey: def.textureKey,
    cardinalFacing: "s",
    displayName: def.displayName,
    combatTuning,
    sprite,
    damageable,
    combat: createEnemyCombat(),
    nav: createEnemyNav(),
    nameplate,
    statusSpeedMul: 1,
    knockbackVx: 0,
    knockbackVy: 0,
    behaviorExtra: defaultBehaviorExtra(combatTuning),
  };
  bindEnemyBehaviorSubstate(enemy, def.behavior);
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
  reapplySpriteHitFlashIfActive(enemy.sprite);
}