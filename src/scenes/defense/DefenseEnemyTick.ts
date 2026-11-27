import { playerTuning } from "../../config/player";
import { enemyCombatTick } from "./enemyCombatModules";
import { tuning } from "../../tuning/gameTuning";
import type Phaser from "phaser";
import { applyDamage, MELEE_HIT_FLAVOR } from "../../combat/rules/DamageSystem";
import { updateEnemyBrain } from "../../ai/EnemyBrain";
import { pickEnemyTarget, wallCombatPoint } from "../../ai/brainShared";
import {
  playerAggroRadiusWu,
  playerIncomingDamageMult,
} from "../../combat/rules/shadowformRuntime";
import type { NavGrid, NavPeerAgent } from "../../pathfinding/grid";
import type { EnemyPeerAlly } from "../../ai/behaviors/types";
import {
  updateEnemySpriteFacing,
  type EnemyInstance,
} from "../../entities/Enemy";
import {
  enemyCollisionBodyRadius,
  enemyPathClearancePx,
  enforceEnemyDefenseBounds,
} from "../../entities/entityPhysics";
import { worldDisplayPx, worldUnit } from "../../config/worldScale";
import { interruptEnemyAttack } from "../../entities/enemyRanged/attackInterrupt";
import type { EnemyProjectile } from "../../entities/Projectile";
import type { Damageable } from "../../combat/rules/DamageSystem";
import type { EnemySpellStatusMap } from "../../combat/rules/enemySpellStatus";
import {
  decayEnemyKnockback,
  setEnemyChaseVelocity,
} from "../../combat/rules/enemyKnockback";
import { updateEnemyNameplate } from "../../ui/hud/enemyNameplate";
import { SPRITE_DISPLAY } from "../../content/assets";

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

/** Per-enemy brain, behavior combat, wall damage, player hits. */
export function tickDefenseEnemies(
  host: DefenseEnemyTickHost,
  delta: number,
): DefenseEnemyTickResult {
  let wallHp = host.wallHp;
  let playerInvulnMs = host.playerInvulnMs;
  const enemyProjectiles = [...host.enemyProjectiles];
  const {
    x: px,
    y: py,
    radius: playerRadius,
    damageable: playerDamageable,
  } = host.playerHurtbox;

  host.enemyPathGoals.clear();
  const liveEnemies = host.enemies.filter((e) => e.damageable.alive);
  // One peer row per live enemy per frame (not per enemy pair). Positions are
  // refreshed before each enemy's brain update so earlier bound clamps this
  // frame are still seen, exactly as when the rows were rebuilt per enemy.
  const peerAgentRows: NavPeerAgent[] = liveEnemies.map((o) => ({
    x: 0,
    y: 0,
    clearancePx: worldUnit(enemyPathClearancePx(o.defId), host.registry),
  }));
  const peerAllyRows: EnemyPeerAlly[] = liveEnemies.map((o) => ({
    id: o.id,
    behavior: o.behavior,
    defId: o.defId,
    x: 0,
    y: 0,
  }));
  for (const e of liveEnemies) {
    const bodyRadiusPx = worldUnit(
      enemyCollisionBodyRadius(e.defId),
      host.registry,
    );
    enforceEnemyDefenseBounds(e, bodyRadiusPx);

    const stunned = host.enemySpellStatus.isStunned(e.id);
    if (stunned) {
      interruptEnemyAttack(e);
      setEnemyChaseVelocity(e, 0, 0);
      decayEnemyKnockback(e, delta);
      enforceEnemyDefenseBounds(e, bodyRadiusPx);
      continue;
    }
    const peerAgents: NavPeerAgent[] = [];
    const peerAllies: EnemyPeerAlly[] = [];
    for (let i = 0; i < liveEnemies.length; i++) {
      const o = liveEnemies[i]!;
      if (o.id === e.id) continue;
      const agent = peerAgentRows[i]!;
      const ally = peerAllyRows[i]!;
      agent.x = ally.x = o.sprite.x;
      agent.y = ally.y = o.sprite.y;
      peerAgents.push(agent);
      peerAllies.push(ally);
    }
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

    const combatAggroPx = worldUnit(
      playerAggroRadiusWu(tuning("enemyAi").playerAggroRadiusWu),
      host.registry,
    );
    const combatTargetKind = pickEnemyTarget(
      host.navGrid,
      e.sprite.x,
      e.sprite.y,
      px,
      py,
      combatAggroPx,
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
            ...wallCombatPoint(e.sprite.x, host.scene.registry),
          };

    const onWallHit = () => {
      const wallDamage = e.combatTuning.wall.damage;
      wallHp = Math.max(0, wallHp - wallDamage);
    };
    const playerHitDamage = enemyCombatTick(e.behavior)({
      scene: host.scene,
      enemy: e,
      target: attackTarget,
      delta,
      playerX: px,
      playerY: py,
      playerRadius,
      onWallHit,
      nextProjectileId: host.nextProjectileId,
      maskWorldObject: host.maskWorldObject,
      addProjectile: (proj) => enemyProjectiles.push(proj),
    });

    if (
      playerHitDamage > 0 &&
      playerInvulnMs <= 0 &&
      !host.endlessInfiniteHp &&
      !host.registry.get("e2eGodMode")
    ) {
      applyDamage(
        playerDamageable,
        playerHitDamage * playerIncomingDamageMult(),
        MELEE_HIT_FLAVOR,
      );
      if (playerDamageable.hp <= 0) {
        playerDamageable.alive = false;
      } else {
        playerDamageable.alive = true;
      }
      playerInvulnMs = playerTuning().playerHitInvulnMs;
    }

    decayEnemyKnockback(e, delta);
    enforceEnemyDefenseBounds(e, bodyRadiusPx);
  }

  return { wallHp, playerInvulnMs, enemyProjectiles };
}

/** Face living enemies toward their motion and move their nameplates/HP bars. */
export function syncDefenseEnemyNameplates(
  enemies: readonly EnemyInstance[],
  registry: Phaser.Data.DataManager,
): void {
  const enemySpriteSide = worldDisplayPx(SPRITE_DISPLAY.enemy, registry);
  for (const e of enemies) {
    if (!e.damageable.alive || e.nameplate.dying) continue;
    updateEnemySpriteFacing(e);
    updateEnemyNameplate(
      e.nameplate,
      e.sprite.x,
      e.sprite.y,
      enemySpriteSide,
      e.damageable,
    );
  }
}
