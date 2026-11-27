import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeEnemyAi } from "./normalizeEnemyAi";
import shippedEnemyAi from "../../../public/data/enemy-ai.json";

describe("normalizeEnemyAi", () => {
  it("requires all chase tuning fields", () => {
    expect(() => normalizeEnemyAi({})).toThrow(ConfigLoadError);
  });

  it("returns parsed numbers from a complete fixture", () => {
    const shipped: Record<string, unknown> = shippedEnemyAi;
    const out = normalizeEnemyAi({
      ...shipped,
      playerAggroRadiusWu: 300,
      wallVelocityBlendMs: 400,
    });
    expect(out.playerAggroRadiusWu).toBe(300);
    expect(out.wallVelocityBlendMs).toBe(400);
    expect(out.javelineer.closeRetreatBlend).toBe(0.68);
  });

  it("requires every behaviour movement section", () => {
    const shipped: Record<string, unknown> = shippedEnemyAi;
    const { ward: _ward, ...noWard } = shipped;
    expect(() => normalizeEnemyAi(noWard)).toThrow(/enemy-ai\.ward/);
    expect(() =>
      normalizeEnemyAi({ ...shipped, pathing: { replanMs: 450 } }),
    ).toThrow(/enemy-ai\.pathing\.waypointRadiusWu/);
  });
});
