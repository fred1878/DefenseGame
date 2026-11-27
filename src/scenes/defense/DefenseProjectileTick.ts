import { tuning } from "../../tuning/gameTuning";
import { playerTuning } from "../../config/player";
import Phaser from "phaser";
import type { Damageable } from "../../combat/rules/DamageSystem";
import { applyDamage, MELEE_HIT_FLAVOR } from "../../combat/rules/DamageSystem";
import { applySpellBlastAt } from "../../combat/rules/SpellEffects";
import { applySpellOnHitEffects } from "../../combat/rules/spellOnHitEffects";
import type { EnemySpellStatusMap } from "../../combat/rules/enemySpellStatus";
import { playerIncomingDamageMult } from "../../combat/rules/shadowformRuntime";
import { spellById } from "../../content/spells";
import { spellProjectileDirectKnockback } from "../../combat/rules/spellKnockback";
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
import { spawnLobberGroundImpactSmokeFx } from "../../combat/fx/LobberImpactSmokeFx";
import { ICE_BOLT_SPELL_ID } from "../../content/iceFxSpells";
import {
  destroyIceBoltProjectileFx,
  finishIceBoltProjectileHit,
  syncIceBoltProjectileFx,
} from "../../combat/fx/SpellIceBoltProjectileFx";
import {
  destroyPvfxProjectileFx,
  syncPvfxProjectileFx,
} from "../../combat/fx/SpellPvfxProjectileFx";
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
  spellDamageMult: (
    def?: import("../../content/spells").SpellDefinition,
  ) => number;
  /** Player auto-attack shot hit an enemy (lifesteal / on-hit procs). */
  onWeaponHit?: (enemyId: string, damage: number) => void;
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
  registerWorldDraw?: (go: Phaser.GameObjects.GameObject) => void;
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
      if (!p.spellId) return host.wu(playerTuning().rangedKnockbackWu);
      const def = spellById(p.spellId);
      return host.wu(spellProjectileDirectKnockback(p.spellId, def));
    },
    findEnemy: host.findEnemy,
  };
  const projectiles = host.projectiles.filter((p) => {
    if (p.spellId === ICE_BOLT_SPELL_ID && p.iceBoltFx) {
      syncIceBoltProjectileFx(p);
    } else if (p.pvfxFlightFx) {
      syncPvfxProjectileFx(p);
    }
    const result = updateSpellProjectile(p, spellProjCtx);
    if (!result.alive && p.pvfxFlightFx) {
      destroyPvfxProjectileFx(p);
    }
    if (!result.alive && p.spellId === ICE_BOLT_SPELL_ID && p.iceBoltFx) {
      if (result.hitEnemyId) {
        finishIceBoltProjectileHit(host.scene, p, host.registerWorldDraw);
      } else {
        destroyIceBoltProjectileFx(p);
      }
    }
    if (result.hitEnemyId && !p.spellId) {
      host.onWeaponHit?.(result.hitEnemyId, p.damage);
    }
    if (result.hitEnemyId && p.spellId) {
      const def = spellById(p.spellId);
      if (def?.onHit) {
        applySpellOnHitEffects(
          host.enemySpellStatus,
          result.hitEnemyId,
          def.onHit,
          def.damageFlavor ?? "fire",
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
          host.spellDamageMult(def),
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
    if (p.pvfxFlightFx) {
      syncPvfxProjectileFx(p);
    }
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
      host.wu(playerTuning().rangedKnockbackWu) *
        tuning("gameplay").combat.enemyProjectileKnockbackMul,
      playerIncomingDamageMult(),
    );
    if (!alive && p.sourceEnemyId && p.blastRadiusWu !== undefined) {
      const owner = host.findEnemyInstance?.(p.sourceEnemyId);
      if (owner) clearLobberAirborneTelegraph(owner);
    }
    if (!alive && p.pvfxFlightFx) {
      destroyPvfxProjectileFx(p);
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
          (p as EnemyProjectile & { lobDamageScale?: number }).lobDamageScale ??
          1;
        applyDamage(
          host.player.damageable,
          det.damage * scale * playerIncomingDamageMult(),
          det.flavor ?? MELEE_HIT_FLAVOR,
        );
        playerInvulnMs = playerTuning().playerHitInvulnMs;
      }
      const source = p.sourceEnemyId
        ? host.findEnemyInstance?.(p.sourceEnemyId)
        : undefined;
      if (source?.behavior === "lobber") {
        const lobTune = source.combatTuning.lobber;
        if (!lobTune) {
          throw new Error(
            `Lobber detonation missing combatTuning.lobber for ${source.defId}`,
          );
        }
        spawnLobberGroundImpactSmokeFx(
          host.scene,
          det.x,
          det.y,
          lobTune.blastRadiusWu,
          lobTune.impactVfxBlastMul,
          host.registerWorldDraw,
        );
      }
      host.flashNova(det.x, det.y, blastR, {
        blastTextureKey: COMBAT_FX_TEXTURE.spellShockwave,
      });
    }
    return alive;
  });

  return { projectiles, enemyProjectiles, playerInvulnMs };
}
