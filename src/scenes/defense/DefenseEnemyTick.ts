import Phaser from "phaser";
import { applyDamage } from "../../combat/DamageSystem";
import { playEnemyMeleeSlashSfx } from "../../audio/enemyMeleeSlashSfx";
import { showGruntMeleeSwipe } from "../../combat/MeleeSwipeFx";
import {
  pickEnemyCombatTarget,
  updateEnemyBrain,
  wallCombatPoint,
} from "../../ai/EnemyBrain";
import { PLAYER_TUNING } from "../../config";
import type { NavGrid } from "../../pathfinding/grid";
import type { EnemyInstance } from "../../entities/Enemy";
import { enemyCollisionBodyRadius } from "../../entities/entityPhysics";
import { updateEnemyCombat } from "../../entities/EnemyCombat";
import {
  updateArrowRainCombat,
  updateJavelineerCombat,
  updateLobberCombat,
  updateRangedHybridCombat,
  updateStationaryRangedCombat,
} from "../../entities/EnemyRangedCombat";
import { interruptEnemyAttack } from "../../entities/enemyRanged/attackInterrupt";
import {
  spawnEnemyLobProjectile,
  spawnEnemyProjectile,
  type EnemyProjectile,
} from "../../entities/Projectile";
import type { Damageable } from "../../combat/DamageSystem";
import type { EnemySpellStatusMap } from "../../combat/enemySpellStatus";
import { decayEnemyKnockback, setEnemyChaseVelocity } from "../../combat/enemyKnockback";

export type DefenseEnemyTickHost = {
  scene: Phaser.Scene;
  registry: Phaser.Data.DataManager;
  navGrid: NavGrid;
  enemies: EnemyInstance[];
  enemyProjectiles: EnemyProjectile[];
  enemySpellStatus: EnemySpellStatusMap;
  enemyPathGoals: Map<
    string,
    { targetKind: "wall" | "player"; x: number; y: number }
  >;
  wallHp: number;
  playerInvulnMs: number;
  playerHurtbox: {
    x: number;
    y: number;
    radius: number;
    damageable: Damageable;
  };
  nextProjectileId: (prefix: string) => string;
  maskWorldObject?: (go: Phaser.GameObjects.GameObject) => void;
  endlessInfiniteHp?: boolean;
};

export type DefenseEnemyTickResult = {
  wallHp: number;
  playerInvulnMs: number;
  enemyProjectiles: EnemyProjectile[];
};

/** Per-enemy brain, behavior combat, wall damage, player hits (REFACTOR_PLAN PR9). */
export function tickDefenseEnemies(
  host: DefenseEnemyTickHost,
  delta: number,
): DefenseEnemyTickResult {
  let wallHp = host.wallHp;
  let playerInvulnMs = host.playerInvulnMs;
  const enemyProjectiles = [...host.enemyProjectiles];
  const { x: px, y: py, radius: playerRadius, damageable: playerDamageable } =
    host.playerHurtbox;

  host.enemyPathGoals.clear();
  const liveEnemies = host.enemies.filter((e) => e.damageable.alive);
  for (const e of liveEnemies) {
    if (host.enemySpellStatus.isStunned(e.id)) {
      interruptEnemyAttack(e);
      setEnemyChaseVelocity(e, 0, 0);
      continue;
    }
    const peerAgents = liveEnemies
      .filter((o) => o.id !== e.id)
      .map((o) => ({ x: o.sprite.x, y: o.sprite.y }));
    const peerAllies = liveEnemies
      .filter((o) => o.id !== e.id)
      .map((o) => ({
        id: o.id,
        behavior: o.behavior,
        x: o.sprite.x,
        y: o.sprite.y,
      }));
    const brain = updateEnemyBrain(
      e,
      e.nav,
      host.navGrid,
      px,
      py,
      delta,
      peerAgents,
      peerAllies,
    );
    host.enemyPathGoals.set(e.id, {
      targetKind: brain.targetKind,
      x: brain.targetX,
      y: brain.targetY,
    });

    if (host.enemySpellStatus.isRooted(e.id)) {
      setEnemyChaseVelocity(e, 0, 0);
    }

    const combatTargetKind = pickEnemyCombatTarget(
      host.navGrid,
      e.sprite.x,
      e.sprite.y,
      px,
      py,
    );
    const attackTarget =
      combatTargetKind === "player"
        ? {
            kind: "player" as const,
            x: px,
            y: py,
            radius: playerRadius,
            damageable: playerDamageable,
          }
        : {
            kind: "wall" as const,
            ...wallCombatPoint(e.sprite.x),
          };

    let playerHitDamage = 0;
    const onWallHit = () => {
      const wallDamage = e.combatTuning.wall.damage;
      wallHp = Math.max(0, wallHp - wallDamage);
    };

    if (e.behavior === "arrowRainArcher" && e.arrowRain) {
      const rain = updateArrowRainCombat(
        e,
        attackTarget,
        e.arrowRain,
        delta,
        onWallHit,
      );
      if (rain.hitPlayer) playerHitDamage += rain.damage;
    } else if (e.behavior === "javelineer" && e.javelineer) {
      const jav = updateJavelineerCombat(
        e,
        attackTarget,
        e.javelineer,
        delta,
        onWallHit,
      );
      if (jav.spawnJavelin) {
        const req = jav.spawnJavelin;
        const id = host.nextProjectileId("ej_");
        const javProj = spawnEnemyProjectile(
          host.scene,
          req.fromX,
          req.fromY,
          req.toX,
          req.toY,
          e.combatTuning.javelineer!.projectileSpeed,
          req.damage,
          e.combatTuning.javelineer!.projectileMaxTravel,
          id,
        );
        host.maskWorldObject?.(javProj.sprite);
        enemyProjectiles.push(javProj);
      }
      if (jav.meleeHit) playerHitDamage += e.damage;
    } else if (e.behavior === "stationaryRanged" && e.stationaryRanged) {
      const bolt = updateStationaryRangedCombat(
        e,
        attackTarget,
        e.stationaryRanged,
        delta,
        onWallHit,
      );
      if (bolt.spawnBolt) {
        const req = bolt.spawnBolt;
        const tune = e.combatTuning.stationaryRanged!;
        const id = host.nextProjectileId("es_");
        const boltProj = spawnEnemyProjectile(
          host.scene,
          req.fromX,
          req.fromY,
          req.toX,
          req.toY,
          tune.projectileSpeed,
          req.damage,
          tune.projectileMaxTravel,
          id,
        );
        host.maskWorldObject?.(boltProj.sprite);
        enemyProjectiles.push(boltProj);
      }
    } else if (e.behavior === "rangedHybrid" && e.rangedHybrid) {
      const hybrid = updateRangedHybridCombat(
        e,
        attackTarget,
        e.rangedHybrid,
        delta,
        onWallHit,
      );
      if (hybrid.spawnBolt) {
        const req = hybrid.spawnBolt;
        const tune = e.combatTuning.stationaryRanged!;
        const id = host.nextProjectileId("eh_");
        const hybridProj = spawnEnemyProjectile(
          host.scene,
          req.fromX,
          req.fromY,
          req.toX,
          req.toY,
          tune.projectileSpeed,
          req.damage,
          tune.projectileMaxTravel,
          id,
        );
        host.maskWorldObject?.(hybridProj.sprite);
        enemyProjectiles.push(hybridProj);
      }
      if (hybrid.meleeHit) playerHitDamage += e.damage;
      if (
        e.rangedHybrid.mode === "melee" &&
        e.combat.phase === "active" &&
        !e.combat.slashFxShown
      ) {
        e.combat.slashFxShown = true;
        showGruntMeleeSwipe(
          host.scene,
          e.sprite.x,
          e.sprite.y,
          e.combat.facing,
          e.combatTuning.melee.activeMs,
        );
        playEnemyMeleeSlashSfx(host.scene);
      }
    } else if (e.behavior === "charger") {
      const extra = e.behaviorExtra;
      const chargerTune = e.combatTuning.charger!;
      if (
        extra.chargeActiveMs > 0 &&
        attackTarget.kind === "player" &&
        !extra.chargeHitThisDash
      ) {
        const bodyR = enemyCollisionBodyRadius(e.defId);
        const touch = Math.hypot(px - e.sprite.x, py - e.sprite.y) <= bodyR + playerRadius;
        if (touch) {
          extra.chargeHitThisDash = true;
          playerHitDamage += chargerTune.chargeDamage;
        }
      } else if (extra.chargeActiveMs <= 0 && extra.chargeWindupMs <= 0) {
        const hitPlayer = updateEnemyCombat(e, attackTarget, delta, onWallHit);
        if (e.combat.phase === "active" && !e.combat.slashFxShown) {
          e.combat.slashFxShown = true;
          showGruntMeleeSwipe(
            host.scene,
            e.sprite.x,
            e.sprite.y,
            e.combat.facing,
            e.combatTuning.melee.activeMs,
          );
          playEnemyMeleeSlashSfx(host.scene);
        }
        if (hitPlayer) playerHitDamage += e.damage;
      }
    } else if (e.behavior === "lobber" && e.lobber) {
      const lob = updateLobberCombat(
        e,
        attackTarget,
        e.lobber,
        delta,
        onWallHit,
      );
      if (lob.spawnLob) {
        const req = lob.spawnLob;
        const tune = e.combatTuning.lobber!;
        const id = host.nextProjectileId("el_");
        const proj = spawnEnemyLobProjectile(
          host.scene,
          req.fromX,
          req.fromY,
          req.toX,
          req.toY,
          tune.projectileSpeed,
          req.damage,
          tune.blastRadius,
          id,
        );
        (proj as EnemyProjectile & { lobDamageScale?: number }).lobDamageScale =
          req.blastDamageScale;
        host.maskWorldObject?.(proj.sprite);
        enemyProjectiles.push(proj);
      }
    } else {
      const hitPlayer = updateEnemyCombat(e, attackTarget, delta, onWallHit);
      if (e.combat.phase === "active" && !e.combat.slashFxShown) {
        e.combat.slashFxShown = true;
        showGruntMeleeSwipe(
          host.scene,
          e.sprite.x,
          e.sprite.y,
          e.combat.facing,
          e.combatTuning.melee.activeMs,
        );
        playEnemyMeleeSlashSfx(host.scene);
      }
      if (hitPlayer) playerHitDamage += e.damage;
    }

    if (
      playerHitDamage > 0 &&
      playerInvulnMs <= 0 &&
      !host.endlessInfiniteHp &&
      !host.registry.get("e2eGodMode")
    ) {
      applyDamage(playerDamageable, playerHitDamage);
      if (playerDamageable.hp <= 0) {
        playerDamageable.alive = false;
      } else {
        playerDamageable.alive = true;
      }
      playerInvulnMs = PLAYER_TUNING.playerHitInvulnMs;
    }

    decayEnemyKnockback(e, delta);
  }

  return { wallHp, playerInvulnMs, enemyProjectiles };
}