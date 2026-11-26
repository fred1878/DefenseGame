import { beforeAll, describe, expect, it } from "vitest";
import { applyEntityPhysics } from "../entities/entityPhysics";
import { applyKnockbackFrom } from "./Knockback";

describe("applyKnockbackFrom", () => {
  beforeAll(() => {
    applyEntityPhysics({
      enemyPathClearanceMarginWu: 9,
      staticObstacleNavClearanceWu: 18,
      knockbackVelocityCapMult: 1.35,
    });
  });
  it("pushes sprite away from the impact origin", () => {
    const body = { velocity: { x: 0, y: 0 } };
    const sprite = {
      x: 50,
      y: 0,
      body,
    } as Parameters<typeof applyKnockbackFrom>[0];

    applyKnockbackFrom(sprite, 0, 0, 120);
    expect(body.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(body.velocity.y)).toBeLessThan(1);
  });

  it("clamps extreme velocity", () => {
    const body = { velocity: { x: 400, y: 0 } };
    const sprite = { x: 10, y: 0, body } as Parameters<
      typeof applyKnockbackFrom
    >[0];
    applyKnockbackFrom(sprite, 0, 0, 200);
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    expect(speed).toBeLessThanOrEqual(200 * 1.35 + 0.01);
  });
});

describe("applyKnockbackFrom leftover branches", () => {
  it("still knocks back from the same point and skips a sprite with no body", () => {
    const body = { velocity: { x: 0, y: 0 } };
    const sprite = {
      x: 10,
      y: 20,
      body,
    } as Parameters<typeof applyKnockbackFrom>[0];
    applyKnockbackFrom(sprite, 10, 20, 80);
    expect(Math.hypot(body.velocity.x, body.velocity.y)).toBe(0);

    const orphan = { x: 1, y: 1, body: null } as Parameters<
      typeof applyKnockbackFrom
    >[0];
    applyKnockbackFrom(orphan, 0, 0, 80);
    expect(orphan.body).toBeNull();
  });
});
