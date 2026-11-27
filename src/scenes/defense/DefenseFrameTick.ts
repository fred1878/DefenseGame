import { playerTuning } from "../../config/player";
import { tuning } from "../../tuning/gameTuning";
import type Phaser from "phaser";
import {
  shadowformActive,
  shadowformMoveSpeedMultiplier,
} from "../../combat/rules/shadowform";
import { playerBodyRadiusPx } from "../../entities/entityPhysics";
import type { EnemyInstance } from "../../entities/Enemy";
import type { NavGrid } from "../../pathfinding/grid";
import type { DefenseRunState } from "./DefenseRunState";
import type { DefensePlayerCombat } from "./DefensePlayerCombat";
import type { DefenseSpellDirector } from "./DefenseSpellDirector";
import { syncShadowformRuntime } from "./DefenseSceneLifecycle";
import { tickDefenseProjectiles } from "./DefenseProjectileTick";
import { tickDefenseEnemies } from "./DefenseEnemyTick";
import { tickDefenseSpellWorld } from "./DefenseSpellWorldTick";
import type { EnemyTarget } from "./DefenseEnemyTargets";

/** Scene services the per-frame combat ticks read (bound once in `create`). */
export type DefenseFrameHost = {
  scene: Phaser.Scene;
  run: DefenseRunState;
  combat: DefensePlayerCombat;
  spellDirector: DefenseSpellDirector;
  navGrid: () => NavGrid;
  wu: (atDefault2x: number) => number;
  onWeaponHit: (enemyId: string, damage: number) => void;
  enemyTarget: (e: EnemyInstance) => EnemyTarget;
  enemyTargets: () => EnemyTarget[];
  registerWorldDraw: (go: Phaser.GameObjects.GameObject) => void;
};

/**
 * Player step of `DefenseScene.update`: cooldowns, shadowform, movement or
 * channeling, auto attack, queued / auto spells, melee arc and ranged shot.
 * Returns the player position at the start of the frame (enemy hurtbox).
 */
export function tickDefensePlayer(
  h: DefenseFrameHost,
  delta: number,
): { px: number; py: number } {
  const { run } = h;
  run.spellCaster.tickCooldowns(delta);
  syncShadowformRuntime(run.player, run.shadowformEndsAt, h.scene.time.now);
  const dir = run.stick.getDirection();
  const px = run.player.sprite.x;
  const py = run.player.sprite.y;
  const moveSpeed = shadowformMoveSpeedMultiplier(
    shadowformActive(run.shadowformEndsAt, h.scene.time.now),
    tuning("shadowform"),
  );

  if (run.spellCaster.isChanneling()) {
    h.spellDirector.updateChanneling(delta, dir, () =>
      h.combat.shouldLockMeleeAimFacing(),
    );
  } else {
    const lockMeleeAim = h.combat.shouldLockMeleeAimFacing();
    run.player.setVelocityFromStick(
      dir.x,
      dir.y,
      h.wu(playerTuning().moveSpeedWu) * moveSpeed,
      {
        lockMeleeAim,
      },
    );
    if (lockMeleeAim) {
      const target = run.targeting.facingTarget("melee", false);
      if (target) run.player.faceToward(target.x, target.y);
    }
    run.castBar.setVisible(false);
  }

  if (!run.spellCaster.isChanneling()) {
    h.combat.tryAutoAttack();
  }
  run.player.updateAttack(delta);
  if (!run.spellCaster.isChanneling()) {
    h.spellDirector.tryFlushQueuedSpellCast(dir.x, dir.y);
    h.spellDirector.tryAutoCastSpells(dir.x, dir.y);
  }
  h.combat.syncMeleeSwipeFx();

  // Skips dead enemies itself; no per-frame filtered copy needed.
  run.player.damageEnemiesInArc(
    run.enemies,
    playerTuning().meleeDamage,
    h.wu(playerTuning().meleeKnockbackWu),
    (enemy, damage) => h.onWeaponHit(enemy.id, damage),
  );

  if (run.player.consumeRangedShot()) {
    h.combat.fireProjectile(playerTuning().rangedDamage);
  }
  return { px, py };
}

/**
 * World step of `DefenseScene.update`: projectiles, invulnerability, focus
 * lock, spell zones and enemies (AI, melee / ranged attacks on wall and player).
 */
export function tickDefenseWorld(
  h: DefenseFrameHost,
  delta: number,
  px: number,
  py: number,
): void {
  const { run } = h;
  const projTick = tickDefenseProjectiles(
    {
      scene: h.scene,
      registry: h.scene.registry,
      player: run.player,
      playerInvulnMs: run.playerInvulnMs,
      projectiles: run.projectiles,
      enemyProjectiles: run.enemyProjectiles,
      enemyTargets: () => h.enemyTargets(),
      spellDamageMult: (def) => h.spellDirector.spellDamageMult(def),
      onWeaponHit: (enemyId, damage) => h.onWeaponHit(enemyId, damage),
      wu: (n) => h.wu(n),
      findEnemy: (id) => {
        const e = run.targeting.getEnemyById(id);
        return e ? h.enemyTarget(e) : undefined;
      },
      flashNova: (x, y, r, def) => h.combat.flashNova(x, y, r, def),
      endlessInfiniteHp: run.endlessInfiniteHp,
      enemySpellStatus: run.enemySpellStatus,
      findEnemyInstance: (id) => run.enemies.find((en) => en.id === id),
      registerWorldDraw: (go) => h.registerWorldDraw(go),
    },
    delta,
  );
  run.projectiles = projTick.projectiles;
  run.enemyProjectiles = projTick.enemyProjectiles;
  run.playerInvulnMs = projTick.playerInvulnMs;

  run.playerInvulnMs = Math.max(0, run.playerInvulnMs - delta);

  const playerHurtbox = {
    x: px,
    y: py,
    radius: h.wu(playerBodyRadiusPx()),
    damageable: run.player.damageable,
  };
  run.targeting.focusSelectLockMs = Math.max(
    0,
    run.targeting.focusSelectLockMs - delta,
  );
  tickDefenseSpellWorld(run, h.spellDirector, delta);

  const enemyTick = tickDefenseEnemies(
    {
      scene: h.scene,
      registry: h.scene.registry,
      navGrid: h.navGrid(),
      enemies: run.enemies,
      enemyProjectiles: run.enemyProjectiles,
      enemySpellStatus: run.enemySpellStatus,
      enemyPathGoals: run.enemyPathGoals,
      wallHp: run.wallHp,
      playerInvulnMs: run.playerInvulnMs,
      playerHurtbox,
      nextProjectileId: (prefix) => `${prefix}${run.projectileSerial++}`,
      maskWorldObject: (go) => h.registerWorldDraw(go),
      endlessInfiniteHp: run.endlessInfiniteHp,
    },
    delta,
  );
  run.wallHp = enemyTick.wallHp;
  run.playerInvulnMs = enemyTick.playerInvulnMs;
  run.enemyProjectiles = enemyTick.enemyProjectiles;
}
