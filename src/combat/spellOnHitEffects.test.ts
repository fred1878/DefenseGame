import { describe, expect, it } from "vitest";
import { EnemySpellStatusMap } from "./enemySpellStatus";
import { applySpellOnHitEffects } from "./spellOnHitEffects";

describe("applySpellOnHitEffects", () => {
  it("applies stunMs from spell on-hit data", () => {
    const status = new EnemySpellStatusMap();
    applySpellOnHitEffects(status, "e1", { stunMs: 600 });
    expect(status.isStunned("e1")).toBe(true);
  });
});