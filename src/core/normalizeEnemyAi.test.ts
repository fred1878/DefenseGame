import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeEnemyAi } from "./normalizeEnemyAi";

describe("normalizeEnemyAi", () => {
  it("requires all chase tuning fields", () => {
    expect(() => normalizeEnemyAi({})).toThrow(ConfigLoadError);
  });

  it("returns parsed numbers from a complete fixture", () => {
    const out = normalizeEnemyAi({
      playerAggroRadiusWu: 300,
      playerChaseMemoryMs: 1500,
      wallVelocityBlendMs: 400,
      northWallMeleeStandoffWu: 32,
    });
    expect(out.playerAggroRadiusWu).toBe(300);
    expect(out.wallVelocityBlendMs).toBe(400);
  });
});
