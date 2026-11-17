import type { EnemyInstance } from "../Enemy";
import type { EnemyAttackTarget } from "../EnemyCombat";
import { advanceCombatPhase } from "./combatPhase";
import type { JavelineerCombatState, JavelinSpawnRequest } from "./types";

export function updateJavelineerCombat(
  enemy: EnemyInstance,
  target: EnemyAttackTarget,
  extra: JavelineerCombatState,
  deltaMs: number,
  onWallHit?: () => void,
): { spawnJavelin?: JavelinSpawnRequest; meleeHit: boolean } {
  const c = enemy.combat;
  const tune = enemy.combatTuning.javelineer!;
  if (c.cooldownMs > 0) c.cooldownMs = Math.max(0, c.cooldownMs - deltaMs);

  const dx = target.x - enemy.sprite.x;
  const dy = target.y - enemy.sprite.y;
  const dist = Math.hypot(dx, dy);
  c.facing = Math.atan2(dy, dx);

  const inBand =
    target.kind === "player" &&
    dist >= tune.minRange &&
    dist <= tune.maxRange;
  const wallInBand =
    target.kind === "wall" &&
    dist >= tune.minRange &&
    dist <= tune.maxRange;

  if (c.phase === "idle" && c.cooldownMs <= 0 && (inBand || wallInBand)) {
    c.phase = "windup";
    c.phaseMs = 0;
    extra.shotFired = false;
    c.hitThisSwing = false;
  }

  advanceCombatPhase(
    c,
    tune.windupMs,
    tune.activeMs,
    tune.recoveryMs,
    tune.cooldownMs,
    deltaMs,
  );

  let spawnJavelin: JavelinSpawnRequest | undefined;
  let meleeHit = false;

  if (c.phase === "active" && !extra.shotFired) {
    extra.shotFired = true;
    if (target.kind === "player" && inBand) {
      spawnJavelin = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
      };
    } else if (target.kind === "wall" && wallInBand) {
      spawnJavelin = {
        fromX: enemy.sprite.x,
        fromY: enemy.sprite.y,
        toX: target.x,
        toY: target.y,
        damage: enemy.damage,
      };
      onWallHit?.();
    } else if (target.kind === "player" && dist < tune.minRange) {
      meleeHit = true;
    }
  }

  return { spawnJavelin, meleeHit };
}