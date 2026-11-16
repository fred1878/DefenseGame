import { describe, expect, it } from "vitest";
import { poolSpellIconAlpha, isSpellPoolSelectable } from "./spellPoolReadiness";
import { spellById } from "./spells";

describe("spellPoolReadiness", () => {
  it("treats meteor as pool-ready (bright when off bar)", () => {
    const meteor = spellById("meteor");
    expect(meteor).toBeDefined();
    expect(isSpellPoolSelectable(meteor!)).toBe(true);
    expect(
      poolSpellIconAlpha("meteor", ["fire_bolt", "heal"], true),
    ).toBe(1);
  });

  it("dims pool icons that are already on the bar", () => {
    expect(
      poolSpellIconAlpha("meteor", ["meteor", ""], true),
    ).toBe(0.5);
  });

  it("fades phase-5 catalog spells as coming soon", () => {
    const blink = spellById("blink");
    expect(blink).toBeDefined();
    expect(isSpellPoolSelectable(blink!)).toBe(false);
    expect(
      poolSpellIconAlpha("blink", [], false),
    ).toBe(0.48);
  });
});