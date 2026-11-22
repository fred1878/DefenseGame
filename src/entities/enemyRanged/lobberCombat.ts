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
import { advanceCombatPhase, freezeWindupRecovery } from "./combatPhase";
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
): { spawnLob?: LobSpawnRequest } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.lobber!;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  if (c.phase === "idle") {
    c.facing = Math.atan2(dy, dx);
  }

  const minVolley = tune.preferredRange - 22;
  const inRange = dist <= tune.attackTriggerRange && dist >= minVolley;

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
    const zonePx = worldUnit(tune.blastRadius, enemy.sprite.scene.registry);
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
      worldUnit(tune.blastRadius, enemy.sprite.scene.registry),
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

  const zonePx = worldUnit(tune.blastRadius, enemy.sprite.scene.registry);
  let spawnLob: LobSpawnRequest | undefined;

  if (
    (c.phase === "active" || extra.lobAirborne) &&
    extra.telegraph
  ) {
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
      blastRadius: tune.blastRadius,
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