import { beforeAll, describe, expect, it, vi } from "vitest";
import { applyEntityPhysics } from "../entities/entityPhysics";
import { mockEnemyInstance } from "../entities/testEnemyInstance";
import {
  ENEMY_KNOCKBACK_WEIGHT_BASELINE,
  applyEnemyKnockbackFrom,
  decayEnemyKnockback,
  knockbackRadialUnit,
  knockbackStrengthForEnemyWeight,
  setEnemyChaseVelocity,
} from "./enemyKnockback";

describe("knockbackRadialUnit", () => {
  it("points from blast origin toward the target", () => {
    const { nx, ny } = knockbackRadialUnit(120, 100, 100, 100);
    expect(nx).toBeCloseTo(1, 5);
    expect(Math.abs(ny)).toBeLessThan(0.01);
  });

  it("uses a stable radial fallback when target coincides with origin", () => {
    const a = knockbackRadialUnit(50, 50, 50, 50);
    const b = knockbackRadialUnit(50, 50, 50, 50);
    expect(Math.hypot(a.nx, a.ny)).toBeCloseTo(1, 5);
    expect(a.nx).toBe(b.nx);
    expect(a.ny).toBe(b.ny);
  });
});

describe("knockbackStrengthForEnemyWeight", () => {
  it("leaves strength unchanged at baseline weight", () => {
    expect(
      knockbackStrengthForEnemyWeight(120, ENEMY_KNOCKBACK_WEIGHT_BASELINE),
    ).toBe(120);
  });

  it("reduces knockback as weight increases", () => {
    expect(knockbackStrengthForEnemyWeight(100, 200)).toBe(50);
  });

  it("increases knockback as weight decreases", () => {
    expect(knockbackStrengthForEnemyWeight(100, 50)).toBe(200);
  });

  it("returns zero for invalid weight", () => {
    expect(knockbackStrengthForEnemyWeight(100, 0)).toBe(0);
    expect(knockbackStrengthForEnemyWeight(100, -10)).toBe(0);
  });
});

describe("enemyKnockback", () => {
  beforeAll(() => {
    applyEntityPhysics({
      enemyPathClearanceMarginWu: 9,
      staticObstacleNavClearanceWu: 18,
      knockbackVelocityCapMult: 1.35,
    });
  });

  it("adds knockback on top of chase velocity", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
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
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      knockbackVx: 100,
      knockbackVy: 0,
    });
    decayEnemyKnockback(enemy, 260);
    expect(enemy.knockbackVx).toBeLessThan(40);
    expect(enemy.knockbackVx).toBeGreaterThan(30);
  });

  it("pushes away from the hit source", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      weight: 100,
      sprite: { x: 50, y: 0 } as never,
    });
    applyEnemyKnockbackFrom(enemy, 0, 0, 120);
    expect(enemy.knockbackVx).toBeGreaterThan(0);
    expect(Math.abs(enemy.knockbackVy)).toBeLessThan(0.01);
  });

  it("caps combined impulse from multiple hits in one tick", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      weight: 100,
      sprite: { x: 50, y: 0 } as never,
    });
    applyEnemyKnockbackFrom(enemy, 0, 0, 100);
    applyEnemyKnockbackFrom(enemy, 0, 0, 100);
    const vlen = Math.hypot(enemy.knockbackVx, enemy.knockbackVy);
    expect(vlen).toBeLessThanOrEqual(100 * 1.35 + 0.01);
  });

  it("scales impulse down for heavier enemies", () => {
    const light = mockEnemyInstance({
      behavior: "meleeChaser",
      weight: 50,
      sprite: { x: 50, y: 0 } as never,
    });
    const heavy = mockEnemyInstance({
      behavior: "meleeChaser",
      weight: 200,
      sprite: { x: 50, y: 0 } as never,
    });
    applyEnemyKnockbackFrom(light, 0, 0, 100);
    applyEnemyKnockbackFrom(heavy, 0, 0, 100);
    expect(light.knockbackVx).toBeGreaterThan(heavy.knockbackVx);
    expect(light.knockbackVx / heavy.knockbackVx).toBeCloseTo(4, 5);
  });

  it("ignores a non-positive decay step", () => {
    const enemy = mockEnemyInstance({
      behavior: "meleeChaser",
      knockbackVx: 50,
      knockbackVy: 0,
    });
    decayEnemyKnockback(enemy, 0);
    decayEnemyKnockback(enemy, -16);
    expect(enemy.knockbackVx).toBe(50);
  });
});
