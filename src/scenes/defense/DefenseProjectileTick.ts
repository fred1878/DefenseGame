import Phaser from "phaser";
import type { Damageable } from "../../combat/DamageSystem";
import { applyDamage } from "../../combat/DamageSystem";
import { applySpellBlastAt } from "../../combat/SpellEffects";
import { applySpellOnHitEffects } from "../../combat/spellOnHitEffects";
import type { EnemySpellStatusMap } from "../../combat/enemySpellStatus";
import { PLAYER_TUNING } from "../../config";
import { spellById } from "../../content/spells";
import { spellProjectileDirectKnockback } from "../../combat/spellKnockback";
import { COMBAT_FX_TEXTURE } from "../../content/assets";
import { playerBodyRadiusPx } from "../../entities/entityPhysics";
import {
  updateEnemyProjectile,
  updateSpellProjectile,
  type EnemyProjectile,
  type PlayerProjectile,
} from "../../entities/Projectile";
import type { EnemyInstance } from "../../entities/Enemy";
import { clearLobberAirborneTelegraph } from "../../entities/enemyRanged/lobberCombat";
import type { Player } from "../../entities/Player";

export type DefenseProjectileEnemyTarget = {
  id: string;
  x: number;
  y: number;
  radius: number;
  damageable: Damageable;
  sprite: Phaser.Physics.Arcade.Sprite;
  enemy: import("../../entities/Enemy").EnemyInstance;
};

export type DefenseProjectileTickHost = {
  scene: Phaser.Scene;
  registry: Phaser.Data.DataManager;
  player: Player;
  playerInvulnMs: number;
  projectiles: PlayerProjectile[];
  enemyProjectiles: EnemyProjectile[];
  enemyTargets: () => DefenseProjectileEnemyTarget[];
  spellDamageMult: () => number;
  wu: (atDefault2x: number) => number;
  findEnemy: (id: string) => DefenseProjectileEnemyTarget | undefined;
  enemySpellStatus: EnemySpellStatusMap;
  flashNova: (
    x: number,
    y: number,
    radius: number,
    def?: { blastTextureKey?: string },
  ) => void;
  endlessInfiniteHp?: boolean;
  findEnemyInstance?: (id: string) => EnemyInstance | undefined;
};

export type DefenseProjectileTickResult = {
  projectiles: PlayerProjectile[];
  enemyProjectiles: EnemyProjectile[];
  playerInvulnMs: number;
};

/** Player spell projectiles + enemy projectiles filter loops (REFACTOR_PLAN PR8). */
export function tickDefenseProjectiles(
  host: DefenseProjectileTickHost,
  delta: number,
): DefenseProjectileTickResult {
  const px = host.player.sprite.x;
  const py = host.player.sprite.y;
  let playerInvulnMs = host.playerInvulnMs;

  const spellProjCtx = {
    deltaMs: delta,
    enemies: host.enemyTargets(),
    knockbackFor: (p: PlayerProjectile) => {
      // Player ranged auto-attack (no spellId) uses public/data/player.json only.
      if (!p.spellId) return PLAYER_TUNING.rangedKnockback;
      return spellProjectileDirectKnockback(p.spellId, spellById(p.spellId));
    },
    findEnemy: host.findEnemy,
  };
  const projectiles = host.projectiles.filter((p) => {
    const result = updateSpellProjectile(p, spellProjCtx);
    if (result.hitEnemyId && p.spellId) {
      const def = spellById(p.spellId);
      if (def?.onHit) {
        applySpellOnHitEffects(
          host.enemySpellStatus,
          result.hitEnemyId,
          def.onHit,
          def.damageFlavor ?? "default",
        );
      }
    }
    if (result.detonation) {
      const def = spellById(p.spellId ?? "arc_bomb");
      if (def) {
        applySpellBlastAt(
          host.scene,
          result.detonation.x,
          result.detonation.y,
          def,
          host.enemyTargets(),
          host.spellDamageMult(),
          host.enemySpellStatus,
        );
        host.flashNova(
          result.detonation.x,
          result.detonation.y,
          result.detonation.radiusWu,
          { blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave },
        );
      }
    }
    return result.alive;
  });

  const playerHurtboxRadius = host.wu(playerBodyRadiusPx());
  const enemyProjectiles = host.enemyProjectiles.filter((p) => {
    const alive = updateEnemyProjectile(
      p,
      delta,
      {
        x: px,
        y: py,
        radius: playerHurtboxRadius,
        damageable: host.player.damageable,
        sprite: host.player.sprite,
      },
      PLAYER_TUNING.rangedKnockback * 0.65,
    );
    if (!alive && p.sourceEnemyId && p.blastRadiusWu !== undefined) {
      const owner = host.findEnemyInstance?.(p.sourceEnemyId);
      if (owner) clearLobberAirborneTelegraph(owner);
    }
    const det = p.pendingDetonation;
    if (!alive && det) {
      const blastR = host.wu(det.radiusWu);
      const inBlast =
        Phaser.Math.Distance.Between(px, py, det.x, det.y) <=
        blastR + playerHurtboxRadius;
      if (
        inBlast &&
        playerInvulnMs <= 0 &&
        !host.endlessInfiniteHp &&
        !host.registry.get("e2eGodMode") &&
        host.player.damageable.alive
      ) {
        const scale =
          (p as EnemyProjectile & { lobDamageScale?: number }).lobDamageScale ?? 1;
        applyDamage(host.player.damageable, det.damage * scale);
        playerInvulnMs = PLAYER_TUNING.playerHitInvulnMs;
      }
      host.flashNova(det.x, det.y, blastR, {
        blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
      });
    }
    return alive;
  });

  return { projectiles, enemyProjectiles, playerInvulnMs };
}