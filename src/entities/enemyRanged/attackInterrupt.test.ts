import { describe, expect, it, vi } from "vitest";
import { mockEnemyInstance } from "../testEnemyInstance";
import { interruptEnemyAttack } from "./attackInterrupt";

describe("interruptEnemyAttack", () => {
  it("no-ops when the enemy is idle and has no committed target", () => {
    const enemy = mockEnemyInstance({ behavior: "meleeChaser" });
    interruptEnemyAttack(enemy);
    expect(enemy.combat.phase).toBe("idle");
  });

  it("clears telegraphs, shot flags, and the combat phase", () => {
    const enemy = mockEnemyInstance({
      behavior: "lobber",
      combat: {
        phase: "windup",
        phaseMs: 40,
        hitThisSwing: true,
        attackTargetKind: "player",
        slashFxShown: true,
      } as never,
      arrowRain: { telegraph: { gfx: { destroy: vi.fn() } } } as never,
      lobber: {
        telegraph: { gfx: { destroy: vi.fn() } },
        lobThrown: true,
      } as never,
      javelineer: { shotFired: true } as never,
      stationaryRanged: { shotFired: true } as never,
      rangedHybrid: { shotFired: true } as never,
    });
    interruptEnemyAttack(enemy);
    expect(enemy.combat.phase).toBe("idle");
    expect(enemy.combat.phaseMs).toBe(0);
    expect(enemy.combat.hitThisSwing).toBe(false);
    expect(enemy.combat.slashFxShown).toBe(false);
    expect(enemy.arrowRain?.telegraph).toBeUndefined();
    expect(enemy.lobber?.telegraph).toBeUndefined();
    expect(enemy.lobber?.lobThrown).toBe(false);
    expect(enemy.javelineer?.shotFired).toBe(false);
    expect(enemy.stationaryRanged?.shotFired).toBe(false);
    expect(enemy.rangedHybrid?.shotFired).toBe(false);
  });

  it("clears a mid-attack enemy that has no ranged extra state", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      combat: {
        phase: "active",
        phaseMs: 20,
        hitThisSwing: true,
        attackTargetKind: "player",
      } as never,
    });
    interruptEnemyAttack(enemy);
    expect(enemy.combat.phase).toBe("idle");
    expect(enemy.combat.hitThisSwing).toBe(false);
  });
});
