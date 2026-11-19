import { describe, expect, it } from "vitest";
import { ENEMY_AI_DEFAULTS } from "../config/enemy";
import { normalizeEnemyAi } from "./normalizeEnemyAi";

describe("normalizeEnemyAi", () => {
  it("defaults when missing", () => {
    expect(normalizeEnemyAi(null).playerAggroRadius).toBe(
      ENEMY_AI_DEFAULTS.playerAggroRadius,
    );
  });

  it("overrides aggro radius", () => {
    expect(normalizeEnemyAi({ playerAggroRadius: 400 }).playerAggroRadius).toBe(
      400,
    );
  });
});