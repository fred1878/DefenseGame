import { describe, expect, it, vi } from "vitest";
import { createEnemyCombat } from "../EnemyCombat";
import { mockEnemyInstance } from "../../test/testEnemyInstance";
import { advanceCombatPhase, tickCooldownAndFaceTarget } from "./combatPhase";

describe("advanceCombatPhase", () => {
  it("steps windup, active, and recovery, then ignores idle", () => {
    const c = createEnemyCombat();
    c.phase = "windup";
    c.phaseMs = 90;
    advanceCombatPhase(c, 100, 80, 60, 500, 20);
    expect(c.phase).toBe("active");
    expect(c.phaseMs).toBe(0);

    c.phaseMs = 80;
    advanceCombatPhase(c, 100, 80, 60, 500, 1);
    expect(c.phase).toBe("recovery");

    c.phaseMs = 60;
    advanceCombatPhase(c, 100, 80, 60, 500, 1);
    expect(c.phase).toBe("idle");
    expect(c.cooldownMs).toBe(500);

    advanceCombatPhase(c, 100, 80, 60, 500, 16);
    expect(c.phase).toBe("idle");
  });
});

describe("tickCooldownAndFaceTarget", () => {
  it("ticks cooldown and faces the target while idle", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      sprite: { x: 0, y: 0, setVelocity: vi.fn() } as never,
    });
    enemy.combat.phase = "idle";
    enemy.combat.cooldownMs = 40;
    const dist = tickCooldownAndFaceTarget(
      enemy,
      {
        kind: "player",
        x: 30,
        y: 40,
        radius: 8,
        damageable: { alive: true } as never,
      },
      16,
    );
    expect(enemy.combat.cooldownMs).toBe(24);
    expect(enemy.combat.facing).toBeCloseTo(Math.atan2(40, 30));
    expect(dist).toBeCloseTo(50);
  });
});
