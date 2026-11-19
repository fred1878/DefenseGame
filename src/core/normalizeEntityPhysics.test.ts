import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeEntityPhysics } from "./normalizeEntityPhysics";

describe("normalizeEntityPhysics", () => {
  it("requires entityBodyRadius block", () => {
    expect(() => normalizeEntityPhysics({})).toThrow(ConfigLoadError);
  });

  it("merges partial radius overrides onto required fields", () => {
    const out = normalizeEntityPhysics({
      entityBodyRadius: {
        player: 17,
        enemy: 14,
        enemyMelee: 21,
        grunt: 28,
      },
      enemyPathClearanceMarginPx: 7,
    });
    expect(out.entityBodyRadius.player).toBe(17);
    expect(out.entityBodyRadius.grunt).toBe(28);
    expect(out.enemyPathClearanceMarginPx).toBe(7);
  });
});