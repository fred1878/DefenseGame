import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ConfigLoadError } from "./configValidation";
import { normalizeSpellMechanics } from "./normalizeSpellMechanics";

function shippedMechanics() {
  const file = path.join(process.cwd(), "public/data/spell-mechanics.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("normalizeSpellMechanics", () => {
  it("accepts shipped spell-mechanics.json", () => {
    const m = normalizeSpellMechanics(shippedMechanics());
    expect(m.moveSpeedMult).toBeGreaterThan(1);
    expect(m.damageTakenMult).toBeGreaterThan(0);
    expect(m.damageTakenMult).toBeLessThanOrEqual(1);
    expect(m.aggroRadiusMult).toBeGreaterThan(0);
    expect(m.aggroRadiusMult).toBeLessThanOrEqual(1);
  });

  it("rejects invalid damage taken mult", () => {
    expect(() =>
      normalizeSpellMechanics({
        shadowformMoveSpeedMult: 1.2,
        shadowformDamageTakenMult: 1.5,
        shadowformAggroRadiusMult: 0.5,
      }),
    ).toThrow(ConfigLoadError);
  });
});