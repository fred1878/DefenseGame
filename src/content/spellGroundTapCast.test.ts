import { describe, expect, it } from "vitest";
import bundledSpells from "../../public/data/spells.json";
import type { SpellDefinition } from "./spells";
import {
  deriveGroundTapAutoCastSpellIds,
  spellGroundTapAutoCasts,
  spellGroundTapAutoCastsForDef,
} from "./spellGroundTapCast";
import { spellUsesManualGroundAim } from "./spellTargeting";

const catalog = bundledSpells.spells as SpellDefinition[];

describe("spellGroundTapAutoCasts", () => {
  it("matches every targeted ground AoE in the shipped catalog", () => {
    const derived = deriveGroundTapAutoCastSpellIds(catalog);
    expect(derived).toEqual(["blizzard", "fire_blast", "flamestrike", "meteor"]);
    for (const def of catalog) {
      expect(spellGroundTapAutoCastsForDef(def)).toBe(spellUsesManualGroundAim(def));
      expect(spellGroundTapAutoCasts(def.id)).toBe(spellUsesManualGroundAim(def));
    }
  });

  it("excludes caster-centered blasts and non-ground spells", () => {
    const frostNova = catalog.find((s) => s.id === "frost_nova")!;
    const fireBolt = catalog.find((s) => s.id === "fire_bolt")!;
    expect(spellGroundTapAutoCasts("frost_nova")).toBe(false);
    expect(spellGroundTapAutoCasts("fire_bolt")).toBe(false);
    expect(spellGroundTapAutoCastsForDef(frostNova)).toBe(false);
    expect(spellGroundTapAutoCastsForDef(fireBolt)).toBe(false);
  });
});