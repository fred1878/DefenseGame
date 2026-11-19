import { describe, expect, it } from "vitest";
import { SPELL_MECHANICS_DEFAULTS } from "../combat/spellMechanics";
import { normalizeSpellMechanics } from "./normalizeSpellMechanics";

describe("normalizeSpellMechanics", () => {
  it("merges partial JSON over code defaults", () => {
    const out = normalizeSpellMechanics({ blinkDistanceWu: 120 });
    expect(out.blinkDistanceWu).toBe(120);
    expect(out.swingRangeWu).toBe(SPELL_MECHANICS_DEFAULTS.swingRangeWu);
  });
});