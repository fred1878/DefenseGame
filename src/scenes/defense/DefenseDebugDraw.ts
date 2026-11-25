import Phaser from "phaser";
import { PLAYER_TUNING } from "../../config";
import type { DefenseObstacleRect } from "../../config/defense";
import { collectInteractiveScreenRects } from "../../debug/collectInteractiveScreenRects";
import {
  showEnemyPaths,
  showHitboxes,
  showTouchInput,
} from "../../debug/DebugState";
import { HitboxDebugDraw } from "../../debug/HitboxDebugDraw";
import { PathDebugDraw } from "../../debug/PathDebugDraw";
import {
  TouchInputDebugDraw,
  type FocusTapFlash,
} from "../../debug/TouchInputDebugDraw";
import type { EnemyInstance } from "../../entities/Enemy";
import {
  enemyShouldDrawMeleeArcOverlay,
  enemyUsesMeleePlayerActivationRange,
} from "../../entities/EnemyCombat";
import {
  enemyCollisionBodyRadius,
  playerBodyRadiusPx,
} from "../../entities/entityPhysics";
import type { Player } from "../../entities/Player";
import {
  projectileArcadeRadiusPx,
  type EnemyProjectile,
  type PlayerProjectile,
} from "../../entities/Projectile";
import type { NavGrid } from "../../pathfinding/grid";
import type { VirtualStick } from "../../input/VirtualStick";

/** Debug overlays drawn each frame by `DefenseScene.update` (hitboxes, paths, touch input). */

export type DefenseTouchDebugInput = {
  scene: Phaser.Scene;
  registry: Phaser.Data.DataManager;
  touchDebug: TouchInputDebugDraw;
  stick: VirtualStick;
  focusTapFlash: FocusTapFlash | null;
  pointerUiBlocked: (p: Phaser.Input.Pointer) => boolean;
};

/** Draws the touch-input overlay; returns the aged (or cleared) focus tap flash. */
export function drawDefenseTouchDebug(
  input: DefenseTouchDebugInput,
  delta: number,
): FocusTapFlash | null {
  const { touchDebug } = input;
  if (!showTouchInput(input.registry)) {
    touchDebug.clear();
    return null;
  }
  let focusTapFlash = input.focusTapFlash;
  if (focusTapFlash) {
    focusTapFlash = {
      ...focusTapFlash,
      ageMs: focusTapFlash.ageMs + delta,
    };
    if (focusTapFlash.ageMs >= 900) focusTapFlash = null;
  }
  const skipDebug = [touchDebug.uiGraphics(), touchDebug.worldGraphics()];
  touchDebug.draw({
    stick: input.stick,
    excludeZones: input.stick.getDebugLayout().excludeZones,
    uiScreenRects: collectInteractiveScreenRects(input.scene, { skip: skipDebug }),
    pointerUiBlocked: input.pointerUiBlocked,
    focusFlash: focusTapFlash,
  });
  return focusTapFlash;
}

export type DefenseEnemyPathsInput = {
  registry: Phaser.Data.DataManager;
  pathDebug: PathDebugDraw;
  navGrid: NavGrid;
  obstacleBlockers: DefenseObstacleRect[];
  enemies: EnemyInstance[];
  enemyPathGoals: ReadonlyMap<
    string,
    { targetKind: "wall" | "player"; x: number; y: number }
  >;
};

export function drawDefenseEnemyPaths(input: DefenseEnemyPathsInput): void {
  const { pathDebug } = input;
  if (!showEnemyPaths(input.registry)) {
    pathDebug.clear();
    return;
  }
  pathDebug.clear();
  pathDebug.drawObstacleZones(input.navGrid, input.obstacleBlockers);
  for (const e of input.enemies) {
    if (!e.damageable.alive) continue;
    const goal = input.enemyPathGoals.get(e.id);
    if (!goal) continue;
    pathDebug.drawEnemy(e, goal.targetKind, goal.x, goal.y);
  }
}

export type DefenseHitboxDebugInput = {
  registry: Phaser.Data.DataManager;
  hitboxDebug: HitboxDebugDraw;
  player: Player;
  enemies: EnemyInstance[];
  projectiles: PlayerProjectile[];
  enemyProjectiles: EnemyProjectile[];
  obstacleBlockers: DefenseObstacleRect[];
  wu: (atDefault2x: number) => number;
};

export function drawDefenseDebugHitboxes(input: DefenseHitboxDebugInput): void {
  const { hitboxDebug, player, wu } = input;
  if (!showHitboxes(input.registry)) {
    hitboxDebug.clear();
    return;
  }
  hitboxDebug.clear();
  const pBody = player.sprite.body as Phaser.Physics.Arcade.Body;
  const px = pBody.center.x;
  const py = pBody.center.y;
  const playerR = pBody.halfWidth;
  hitboxDebug.drawMeleeActivationRange(
    px,
    py,
    wu(PLAYER_TUNING.autoAttackMeleeRange),
  );
  hitboxDebug.drawMeleeMaxRange(px, py, wu(PLAYER_TUNING.meleeStrikeRangeWu));
  hitboxDebug.drawCircle(px, py, playerR);

  if (player.strikeMode() === "melee" && player.attackPhaseNow === "active") {
    const arcHalf = Phaser.Math.DegToRad(PLAYER_TUNING.meleeArcDeg / 2);
    hitboxDebug.drawMeleeArc(
      px,
      py,
      player.meleeHitboxFacingRad(),
      wu(PLAYER_TUNING.meleeStrikeRangeWu),
      arcHalf,
    );
  }

  for (const e of input.enemies) {
    if (!e.damageable.alive) continue;
    drawEnemyHitboxes(hitboxDebug, e, wu);
  }

  const projBodyR = projectileArcadeRadiusPx(input.registry);

  for (const p of input.enemyProjectiles) {
    if (!p.sprite.active) continue;
    hitboxDebug.drawProjectileBody(p.sprite.x, p.sprite.y, projBodyR);
    if (
      p.spellBehavior === "aoe_on_hit" &&
      p.blastRadiusWu !== undefined &&
      p.lobAimX !== undefined &&
      p.lobAimY !== undefined
    ) {
      hitboxDebug.drawProjectileBlastRadius(
        p.lobAimX,
        p.lobAimY,
        wu(p.blastRadiusWu),
      );
    }
  }

  for (const p of input.projectiles) {
    if (p.sprite.active) {
      hitboxDebug.drawProjectileBody(p.sprite.x, p.sprite.y, projBodyR);
    }
  }

  for (const obs of input.obstacleBlockers) {
    hitboxDebug.drawObstacleRect(obs.x, obs.y, obs.w, obs.h);
  }
}

function drawEnemyHitboxes(
  hitboxDebug: HitboxDebugDraw,
  e: EnemyInstance,
  wu: (atDefault2x: number) => number,
): void {
  if (enemyUsesMeleePlayerActivationRange(e.behavior)) {
    const melee = e.combatTuning.melee;
    if (melee) {
      hitboxDebug.drawMeleeActivationRange(
        e.sprite.x,
        e.sprite.y,
        melee.triggerRangeWu,
      );
      hitboxDebug.drawMeleeMaxRange(e.sprite.x, e.sprite.y, melee.rangeWu);
    }
  }
  hitboxDebug.drawCircle(
    e.sprite.x,
    e.sprite.y,
    wu(enemyCollisionBodyRadius(e.defId)),
  );
  if (enemyShouldDrawMeleeArcOverlay(e)) {
    const melee = e.combatTuning.melee;
    if (melee) {
      const arcHalf = Phaser.Math.DegToRad(melee.arcDeg / 2);
      hitboxDebug.drawMeleeArc(
        e.sprite.x,
        e.sprite.y,
        e.combat.facing,
        melee.rangeWu,
        arcHalf,
      );
    }
  }
  if (e.behavior === "charger") {
    const extra = e.behaviorExtra;
    const touchR =
      wu(enemyCollisionBodyRadius(e.defId)) + wu(playerBodyRadiusPx());
    if (extra.chargeActiveMs > 0) {
      hitboxDebug.drawChargeTouchRadius(e.sprite.x, e.sprite.y, touchR);
      hitboxDebug.drawChargeDashLine(
        e.sprite.x,
        e.sprite.y,
        extra.chargeAimX,
        extra.chargeAimY,
      );
    } else if (extra.chargeWindupMs > 0) {
      hitboxDebug.drawChargeDashLine(
        e.sprite.x,
        e.sprite.y,
        extra.chargeAimX,
        extra.chargeAimY,
      );
    }
  }
}

export type DefenseDebugDrawers = {
  hitboxDebug: HitboxDebugDraw;
  pathDebug: PathDebugDraw;
  touchDebug: TouchInputDebugDraw;
};

/** Create the hitbox / path / touch debug drawers and register them with the cameras. */
export function createDefenseDebugDrawers(
  scene: Phaser.Scene,
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void,
  registerUiDraw: (go: Phaser.GameObjects.GameObject) => void,
): DefenseDebugDrawers {
  const hitboxDebug = new HitboxDebugDraw(scene);
  const pathDebug = new PathDebugDraw(scene);
  const touchDebug = new TouchInputDebugDraw(scene);
  registerWorldDraw(hitboxDebug.graphics());
  registerWorldDraw(pathDebug.graphics());
  registerWorldDraw(touchDebug.worldGraphics());
  registerUiDraw(touchDebug.uiGraphics());
  return { hitboxDebug, pathDebug, touchDebug };
}
