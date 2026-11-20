import { describe, expect, it, vi } from "vitest";
import { resolveEnemyCombat } from "../../core/enemyTuning";
import { mockEnemyInstance } from "../../entities/testEnemyInstance";
import {
  createRangedHybridCombatState,
  resetHybridCombatPhase,
  updateRangedHybridCombat,
} from "../../entities/EnemyRangedCombat";
import type { EnemyAttackTarget } from "../../entities/EnemyCombat";

function playerTarget(
  x: number,
  y: number,
): EnemyAttackTarget {
  return {
    kind: "player",
    x,
    y,
    radius: 14,
    damageable: {
      id: "p",
      hp: 100,
      maxHp: 100,
      alive: true,
      team: "player",
    },
  };
}

describe("rangedHybrid combat state machine", () => {
  const combatTuning = resolveEnemyCombat("rangedHybrid", {
    melee: {
      windupMs: 80,
      activeMs: 60,
      recoveryMs: 80,
      cooldownMs: 40,
      triggerRange: 120,
      range: 61,
    },
    stationaryRanged: {
      preferredRange: 110,
      attackTriggerRange: 200,
      windupMs: 200,
      activeMs: 40,
      recoveryMs: 100,
      cooldownMs: 200,
    },
    hybrid: {
      closeMeleeRadius: 90,
      preferredRange: 110,
      maxMeleeSwings: 3,
      retreatRangeSlack: 12,
    },
  });

  it("enters melee when the player is within close radius", () => {
    const enemy = mockEnemyInstance({
      behavior: "rangedHybrid",
      combatTuning,
      sprite: { x: 0, y: 0, setVelocity: vi.fn(), scene: {} } as never,
    });
    enemy.rangedHybrid = createRangedHybridCombatState();
    updateRangedHybridCombat(
      enemy,
      playerTarget(40, 0),
      enemy.rangedHybrid,
      16,
    );
    expect(enemy.rangedHybrid.mode).toBe("melee");
  });

  it("returns to ranged when the player leaves melee before three swings", () => {
    const enemy = mockEnemyInstance({
      behavior: "rangedHybrid",
      combatTuning,
      sprite: { x: 0, y: 0, setVelocity: vi.fn(), scene: {} } as never,
    });
    enemy.rangedHybrid = createRangedHybridCombatState();
    enemy.rangedHybrid.mode = "melee";
    enemy.rangedHybrid.meleeSwings = 1;
    updateRangedHybridCombat(
      enemy,
      playerTarget(120, 0),
      enemy.rangedHybrid,
      16,
    );
    expect(enemy.rangedHybrid.mode).toBe("ranged");
    expect(enemy.rangedHybrid.meleeSwings).toBe(0);
  });

  it("retreats after three completed melee swings", () => {
    const enemy = mockEnemyInstance({
      behavior: "rangedHybrid",
      combatTuning,
      sprite: { x: 0, y: 0, setVelocity: vi.fn(), scene: {} } as never,
    });
    enemy.rangedHybrid = createRangedHybridCombatState();
    enemy.rangedHybrid.mode = "melee";
    enemy.rangedHybrid.meleeSwings = 2;
    enemy.combat.phase = "recovery";
    enemy.rangedHybrid.prevPhase = "recovery";
    const frames = enemy.combatTuning.melee!.recoveryMs + 5;
    updateRangedHybridCombat(
      enemy,
      playerTarget(30, 0),
      enemy.rangedHybrid,
      frames,
    );
    expect(enemy.rangedHybrid.mode).toBe("retreat");
    expect(enemy.rangedHybrid.meleeSwings).toBe(3);
  });

  it("resumes ranged after retreating to preferred range", () => {
    const enemy = mockEnemyInstance({
      behavior: "rangedHybrid",
      combatTuning,
      sprite: { x: 0, y: 0, setVelocity: vi.fn(), scene: {} } as never,
    });
    enemy.rangedHybrid = createRangedHybridCombatState();
    enemy.rangedHybrid.mode = "retreat";
    resetHybridCombatPhase(enemy.combat);
    updateRangedHybridCombat(
      enemy,
      playerTarget(130, 0),
      enemy.rangedHybrid,
      16,
    );
    expect(enemy.rangedHybrid.mode).toBe("ranged");
  });
});