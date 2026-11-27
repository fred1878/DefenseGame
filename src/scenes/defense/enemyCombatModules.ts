import type Phaser from "phaser";
import { playBruiserMeleeCritHitOnPlayerFx } from "../../combat/BruiserPlayerCritHitFx";
import { attachPvfxProjectileFx } from "../../combat/SpellPvfxProjectileFx";
import { worldUnit } from "../../config/worldScale";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import {
  enemyProjectileTextureKey,
  PVFX_TEXTURE,
} from "../../content/combatPvfxAssets";
import type { EnemyBehaviorId } from "../../core/enemyBehaviorIds";
import type { EnemyInstance } from "../../entities/Enemy";
import { updateEnemyCombat } from "../../entities/EnemyCombat";
import {
  updateArrowRainCombat,
  updateJavelineerCombat,
  updateLobberCombat,
  updateRangedHybridCombat,
  updateStationaryRangedCombat,
} from "../../entities/EnemyRangedCombat";
import { enemyCollisionBodyRadius } from "../../entities/entityPhysics";
import {
  type EnemyProjectile,
  spawnEnemyLobProjectile,
  spawnEnemyProjectile,
} from "../../entities/Projectile";

export type EnemyAttackTarget = Parameters<typeof updateEnemyCombat>[1];

/** Everything one enemy's combat step needs for the current frame. */
export type EnemyCombatTickContext = {
  scene: Phaser.Scene;
  enemy: EnemyInstance;
  target: EnemyAttackTarget;
  delta: number;
  playerX: number;
  playerY: number;
  playerRadius: number;
  onWallHit: () => void;
  nextProjectileId: (prefix: string) => string;
  maskWorldObject?: ((go: Phaser.GameObjects.GameObject) => void) | undefined;
  /** Adds a spawned enemy projectile to the frame's projectile list. */
  addProjectile: (proj: EnemyProjectile) => void;
};

/** One behaviour's combat step; returns the damage dealt to the player this frame. */
export type EnemyCombatTick = (ctx: EnemyCombatTickContext) => number;

/** Default melee swipe (row `damage`) for behaviours without a ranged kit. */
const meleeCombat: EnemyCombatTick = (ctx) =>
  updateEnemyCombat(ctx.enemy, ctx.target, ctx.delta, ctx.onWallHit)
    ? ctx.enemy.damage
    : 0;

const bruiserCombat: EnemyCombatTick = (ctx) => {
  const { enemy: e, target } = ctx;
  if (!updateEnemyCombat(e, target, ctx.delta, ctx.onWallHit)) return 0;
  if (target.kind === "player") {
    playBruiserMeleeCritHitOnPlayerFx(
      ctx.scene,
      target.x,
      target.y,
      ctx.maskWorldObject,
    );
  }
  return e.damage;
};

const arrowRainCombat: EnemyCombatTick = (ctx) => {
  const e = ctx.enemy;
  if (!e.arrowRain) return meleeCombat(ctx);
  const rain = updateArrowRainCombat(
    e,
    ctx.target,
    e.arrowRain,
    ctx.delta,
    ctx.onWallHit,
  );
  return rain.hitPlayer ? rain.damage : 0;
};

const javelineerCombat: EnemyCombatTick = (ctx) => {
  const e = ctx.enemy;
  if (!e.javelineer) return meleeCombat(ctx);
  const jav = updateJavelineerCombat(
    e,
    ctx.target,
    e.javelineer,
    ctx.delta,
    ctx.onWallHit,
  );
  if (jav.spawnJavelin) {
    const req = jav.spawnJavelin;
    const id = ctx.nextProjectileId("ej_");
    const javTune = e.combatTuning.javelineer!;
    const javProj = spawnEnemyProjectile(
      ctx.scene,
      req.fromX,
      req.fromY,
      req.toX,
      req.toY,
      worldUnit(javTune.projectileSpeedWu, ctx.scene.registry),
      req.damage,
      worldUnit(javTune.projectileMaxTravelWu, ctx.scene.registry),
      id,
    );
    javProj.sourceEnemyId = e.id;
    ctx.maskWorldObject?.(javProj.sprite);
    ctx.addProjectile(javProj);
  }
  return jav.meleeHit ? e.damage : 0;
};

const stationaryRangedCombat: EnemyCombatTick = (ctx) => {
  const e = ctx.enemy;
  if (!e.stationaryRanged) return meleeCombat(ctx);
  const bolt = updateStationaryRangedCombat(
    e,
    ctx.target,
    e.stationaryRanged,
    ctx.delta,
    ctx.onWallHit,
  );
  if (bolt.spawnBolt) {
    const req = bolt.spawnBolt;
    const tune = e.combatTuning.stationaryRanged!;
    const id = ctx.nextProjectileId("es_");
    const boltTexture = enemyProjectileTextureKey(
      ctx.scene,
      e.defId,
      COMBAT_FX_TEXTURE.stoneThrow,
    );
    const boltProj = spawnEnemyProjectile(
      ctx.scene,
      req.fromX,
      req.fromY,
      req.toX,
      req.toY,
      worldUnit(tune.projectileSpeedWu, ctx.scene.registry),
      req.damage,
      worldUnit(tune.projectileMaxTravelWu, ctx.scene.registry),
      id,
      boltTexture,
    );
    if (boltTexture === PVFX_TEXTURE.arrowFlight) {
      attachPvfxProjectileFx(
        ctx.scene,
        boltProj,
        boltTexture,
        ctx.maskWorldObject,
      );
    }
    boltProj.sourceEnemyId = e.id;
    ctx.maskWorldObject?.(boltProj.sprite);
    ctx.addProjectile(boltProj);
  }
  return 0;
};

const rangedHybridCombat: EnemyCombatTick = (ctx) => {
  const e = ctx.enemy;
  if (!e.rangedHybrid) return meleeCombat(ctx);
  const hybrid = updateRangedHybridCombat(
    e,
    ctx.target,
    e.rangedHybrid,
    ctx.delta,
    ctx.onWallHit,
  );
  if (hybrid.spawnBolt) {
    const req = hybrid.spawnBolt;
    const tune = e.combatTuning.stationaryRanged!;
    const id = ctx.nextProjectileId("eh_");
    const hybridProj = spawnEnemyProjectile(
      ctx.scene,
      req.fromX,
      req.fromY,
      req.toX,
      req.toY,
      worldUnit(tune.projectileSpeedWu, ctx.scene.registry),
      req.damage,
      worldUnit(tune.projectileMaxTravelWu, ctx.scene.registry),
      id,
    );
    hybridProj.sourceEnemyId = e.id;
    ctx.maskWorldObject?.(hybridProj.sprite);
    ctx.addProjectile(hybridProj);
  }
  return hybrid.meleeHit ? e.damage : 0;
};

const chargerCombat: EnemyCombatTick = (ctx) => {
  const e = ctx.enemy;
  const extra = e.behaviorExtra;
  const chargerTune = e.combatTuning.charger!;
  if (
    extra.chargeActiveMs > 0 &&
    ctx.target.kind === "player" &&
    !extra.chargeHitThisDash
  ) {
    const bodyR = enemyCollisionBodyRadius(e.defId);
    const touch =
      Math.hypot(ctx.playerX - e.sprite.x, ctx.playerY - e.sprite.y) <=
      bodyR + ctx.playerRadius;
    if (touch) {
      extra.chargeHitThisDash = true;
      return chargerTune.chargeDamage;
    }
    return 0;
  }
  if (extra.chargeActiveMs <= 0 && extra.chargeWindupMs <= 0) {
    return meleeCombat(ctx);
  }
  return 0;
};

const lobberCombat: EnemyCombatTick = (ctx) => {
  const e = ctx.enemy;
  if (!e.lobber) return meleeCombat(ctx);
  const lob = updateLobberCombat(
    e,
    ctx.target,
    e.lobber,
    ctx.delta,
    ctx.onWallHit,
  );
  if (lob.spawnLob) {
    const req = lob.spawnLob;
    const tune = e.combatTuning.lobber!;
    const id = ctx.nextProjectileId("el_");
    const proj = spawnEnemyLobProjectile(
      ctx.scene,
      req.fromX,
      req.fromY,
      req.toX,
      req.toY,
      tune.projectileSpeedWu,
      req.damage,
      tune.blastRadiusWu,
      id,
    );
    (proj as EnemyProjectile & { lobDamageScale?: number }).lobDamageScale =
      req.blastDamageScale;
    proj.sourceEnemyId = e.id;
    ctx.maskWorldObject?.(proj.sprite);
    ctx.addProjectile(proj);
  }
  return 0;
};

/**
 * Combat step per behaviour id. Exhaustive: adding an id to
 * `ENEMY_BEHAVIOR_IDS` fails to compile until it has a combat entry here.
 */
const ENEMY_COMBAT: Record<EnemyBehaviorId, EnemyCombatTick> = {
  meleeChaser: meleeCombat,
  bruiser: bruiserCombat,
  arrowRainArcher: arrowRainCombat,
  javelineer: javelineerCombat,
  stationaryRanged: stationaryRangedCombat,
  wallSiege: meleeCombat,
  charger: chargerCombat,
  lobber: lobberCombat,
  rangedHybrid: rangedHybridCombat,
  ward: meleeCombat,
};

export function enemyCombatTick(behavior: EnemyBehaviorId): EnemyCombatTick {
  return ENEMY_COMBAT[behavior];
}
