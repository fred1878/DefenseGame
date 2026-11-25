import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeEntityPhysics } from "./normalizeEntityPhysics";

describe("normalizeEntityPhysics", () => {
  it("requires path clearance margins", () => {
    expect(() => normalizeEntityPhysics({})).toThrow(ConfigLoadError);
  });

  it("loads nav path margins only (body radii live on player/enemies)", () => {
    const out = normalizeEntityPhysics({
      enemyPathClearanceMarginWu: 7,
      staticObstacleNavClearanceWu: 24,
      knockbackVelocityCapMult: 1.35,
    });
    expect(out.enemyPathClearanceMarginWu).toBe(7);
    expect(out.staticObstacleNavClearanceWu).toBe(24);
    expect(out.knockbackVelocityCapMult).toBe(1.35);
  });
});
