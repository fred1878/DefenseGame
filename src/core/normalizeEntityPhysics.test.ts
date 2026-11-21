import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeEntityPhysics } from "./normalizeEntityPhysics";

describe("normalizeEntityPhysics", () => {
  it("requires path clearance margins", () => {
    expect(() => normalizeEntityPhysics({})).toThrow(ConfigLoadError);
  });

  it("loads nav path margins only (body radii live on player/enemies)", () => {
    const out = normalizeEntityPhysics({
      enemyPathClearanceMarginPx: 7,
      staticObstacleNavClearancePx: 24,
    });
    expect(out.enemyPathClearanceMarginPx).toBe(7);
    expect(out.staticObstacleNavClearancePx).toBe(24);
  });
});