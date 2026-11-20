import { describe, expect, it, vi } from "vitest";
import { mockEnemyInstance } from "../entities/testEnemyInstance";
import {
  applyEnemyKnockbackFrom,
  decayEnemyKnockback,
  setEnemyChaseVelocity,
} from "./enemyKnockback";

describe("enemyKnockback", () => {
  it("adds knockback on top of chase velocity", () => {
    const enemy = mockEnemyInstance({
      knockbackVx: 80,
      knockbackVy: 0,
      sprite: {
        setVelocity: vi.fn(),
      } as never,
    });
    setEnemyChaseVelocity(enemy, 40, 0);
    expect(enemy.sprite.setVelocity).toHaveBeenCalledWith(120, 0);
  });

  it("decays impulse over time", () => {
    const enemy = mockEnemyInstance({ knockbackVx: 100, knockbackVy: 0 });
    decayEnemyKnockback(enemy, 260);
    expect(enemy.knockbackVx).toBeLessThan(40);
    expect(enemy.knockbackVx).toBeGreaterThan(30);
  });

  it("pushes away from the hit source", () => {
    const enemy = mockEnemyInstance({
      sprite: { x: 50, y: 0 } as never,
    });
    applyEnemyKnockbackFrom(enemy, 0, 0, 120);
    expect(enemy.knockbackVx).toBeGreaterThan(0);
    expect(Math.abs(enemy.knockbackVy)).toBeLessThan(0.01);
  });
});