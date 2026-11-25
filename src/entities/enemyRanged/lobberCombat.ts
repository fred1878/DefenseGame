import { jitterTelegraphCenter } from "../../combat/aoeTelegraphJitter";
import {
  destroyArrowRainTelegraph,
  LOBBER_TELEGRAPH_PALETTE,
  spawnArrowRainTelegraph,
  updateArrowRainTelegraph,
} from "../../combat/ArrowRainTelegraph";
import { worldUnit } from "../../core/worldPixelScale";
import type { EnemyInstance } from "../Enemy";
import { enemyIsAttacking, type EnemyAttackTarget } from "../EnemyCombat";
import { commitEnemyAttack } from "./attackCommit";
import {
  advanceCombatPhase,
  freezeWindupRecovery,
  tickCooldownAndFaceTarget,
} from "./combatPhase";
import type { LobberCombatState, LobSpawnRequest } from "./types";

export function clearLobberAirborneTelegraph(enemy: EnemyInstance): void {
  const extra = enemy.lobber;
  if (!extra?.lobAirborne) return;
  extra.lobAirborne = false;
  destroyArrowRainTelegraph(extra.telegraph);
  extra.telegraph = undefined;
}

export function updateLobberCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: LobberCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnLob?: LobSpawnRequest | undefined } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.lobber!;
  const dist = tickCooldownAndFaceTarget(enemy, target, deltaMs);

  const minVolley = tune.preferredRangeWu - tune.kiteBandSlackWu;
  const inRange = dist <= tune.attackTriggerRangeWu && dist >= minVolley;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.lobThrown = false;
    c.hitThisSwing = false;
    const jittered = jitterTelegraphCenter(target.x, target.y);
    extra.aimX = jittered.x;
    extra.aimY = jittered.y;
    commitEnemyAttack(
      c,
      enemy.sprite.x,
      enemy.sprite.y,
      target,
      extra.aimX,
      extra.aimY,
    );
    destroyArrowRainTelegraph(extra.telegraph);
    const zonePx = worldUnit(tune.blastRadiusWu, enemy.sprite.scene.registry);
    extra.telegraph = spawnArrowRainTelegraph(
      enemy.sprite.scene,
      extra.aimX,
      extra.aimY,
      tune.windupMs,
      zonePx,
      LOBBER_TELEGRAPH_PALETTE,
    );
  }

  if (c.phase === "windup" && extra.telegraph) {
    updateArrowRainTelegraph(
      extra.telegraph,
      deltaMs,
      false,
      worldUnit(tune.blastRadiusWu, enemy.sprite.scene.registry),
    );
  }

  advanceCombatPhase(
    c,
    tune.windupMs,
    tune.activeMs,
    tune.recoveryMs,
    tune.cooldownMs,
    deltaMs,
  );

  const zonePx = worldUnit(tune.blastRadiusWu, enemy.sprite.scene.registry);
  let spawnLob: LobSpawnRequest | undefined;

  if ((c.phase === "active" || extra.lobAirborne) && extra.telegraph) {
    const raining = c.phase === "active" || extra.lobAirborne;
    updateArrowRainTelegraph(extra.telegraph, deltaMs, raining, zonePx);
  }

  if (c.phase === "active" && !extra.lobThrown && c.attackTargetKind != null) {
    extra.lobThrown = true;
    extra.lobAirborne = true;
    spawnLob = {
      fromX: enemy.sprite.x,
      fromY: enemy.sprite.y,
      toX: extra.aimX,
      toY: extra.aimY,
      damage: tune.damage,
      blastRadius: tune.blastRadiusWu,
      blastDamageScale: tune.blastDamageScale,
    };
    if (c.attackTargetKind === "wall" && !c.hitThisSwing) {
      c.hitThisSwing = true;
      onWallHit?.();
    }
  }

  if ((c.phase === "idle" || c.phase === "recovery") && !extra.lobAirborne) {
    destroyArrowRainTelegraph(extra.telegraph);
    extra.telegraph = undefined;
  }

  if (enemyIsAttacking(c)) {
    enemy.sprite.setVelocity(0, 0);
  }
  freezeWindupRecovery(enemy, c.phase, target.kind);
  return { spawnLob };
}
