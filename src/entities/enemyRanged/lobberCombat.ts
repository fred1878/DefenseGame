import {
  destroyArrowRainTelegraph,
  LOBBER_TELEGRAPH_PALETTE,
  spawnArrowRainTelegraph,
  updateArrowRainTelegraph,
} from "../../combat/ArrowRainTelegraph";
import type { EnemyInstance } from "../Enemy";
import type { EnemyAttackTarget } from "../EnemyCombat";
import { advanceCombatPhase, freezeWindupRecovery } from "./combatPhase";
import type { LobberCombatState, LobSpawnRequest } from "./types";

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
  c.facing = Math.atan2(dy, dx);

  const minVolley = tune.preferredRange - 22;
  const inRange = dist <= tune.attackTriggerRange && dist >= minVolley;

  if (c.phase === "idle" && c.cooldownMs <= 0 && inRange) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.lobThrown = false;
    c.hitThisSwing = false;
    extra.aimX = target.x;
    extra.aimY = target.y;
    destroyArrowRainTelegraph(extra.telegraph);
    extra.telegraph = spawnArrowRainTelegraph(
      enemy.sprite.scene,
      extra.aimX,
      extra.aimY,
      tune.windupMs,
      tune.blastRadius,
      LOBBER_TELEGRAPH_PALETTE,
    );
  }

  if (c.phase === "windup" && extra.telegraph) {
    updateArrowRainTelegraph(
      extra.telegraph,
      deltaMs,
      false,
      tune.blastRadius,
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

  let spawnLob: LobSpawnRequest | undefined;

  if (c.phase === "active") {
    if (extra.telegraph) {
      updateArrowRainTelegraph(
        extra.telegraph,
        deltaMs,
        true,
        tune.blastRadius,
      );
    }
  }

  if (c.phase === "active" && !extra.lobThrown) {
    extra.lobThrown = true;
    if (target.kind === "player" && inRange) {
      spawnLob = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: extra.aimX,
        toY: extra.aimY,
        damage: enemy.damage,
        blastRadius: tune.blastRadius,
        blastDamageScale: tune.blastDamageScale,
      };
    } else if (target.kind === "wall" && inRange) {
      spawnLob = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
        blastRadius: tune.blastRadius,
        blastDamageScale: tune.blastDamageScale,
      };
      if (!c.hitThisSwing) {
        c.hitThisSwing = true;
        onWallHit?.();
      }
    }
  }

  if (c.phase === "idle" || c.phase === "recovery") {
    destroyArrowRainTelegraph(extra.telegraph);
    extra.telegraph = undefined;
  }

  freezeWindupRecovery(enemy, c.phase, target.kind);
  return { spawnLob };
}