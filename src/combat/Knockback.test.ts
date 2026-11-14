import { describe, expect, it } from "vitest";
import { applyKnockbackFrom } from "./Knockback";

describe("applyKnockbackFrom", () => {
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