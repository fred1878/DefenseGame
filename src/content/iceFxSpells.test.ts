import { describe, expect, it } from "vitest";
import { spellUsesIceCastWindupFx } from "./iceFxSpells";
import type { SpellDefinition } from "./spells";

const frost = (over: Partial<SpellDefinition>): SpellDefinition =>
  ({
    id: "test_frost",
    name: "Test",
    mechanicType: "blast",
    castableInDefense: true,
    damageFlavor: "frost",
    ...over,
  }) as SpellDefinition;

describe("spellUsesIceCastWindupFx", () => {
  it("is true for frost spells with positive castMs", () => {
    expect(spellUsesIceCastWindupFx(frost({ castMs: 400 }))).toBe(true);
  });

  it("is false without castMs or non-frost flavor", () => {
    expect(spellUsesIceCastWindupFx(frost({ castMs: 0 }))).toBe(false);
    expect(
      spellUsesIceCastWindupFx(frost({ castMs: 500, damageFlavor: "fire" })),
    ).toBe(false);
  });
});
