import { describe, expect, it } from "vitest";
import bundledSpells from "../../public/data/spells.json";
import { setSpellCatalog, type SpellDefinition } from "./spells";
import {
  deriveGroundTapAutoCastSpellIds,
  spellGroundTapAutoCasts,
  spellGroundTapAutoCastsForDef,
} from "./spellGroundTapCast";
import { spellUsesManualGroundAim } from "./spellTargeting";

const catalog = bundledSpells.spells as SpellDefinition[];

describe("spellGroundTapAutoCasts", () => {
  it("deriveGroundTapAutoCastSpellIds returns an empty list for no spells", () => {
    expect(deriveGroundTapAutoCastSpellIds([])).toEqual([]);
  });

  it("matches every targeted ground AoE in the shipped catalog", () => {
    const derived = deriveGroundTapAutoCastSpellIds(catalog);
    expect(derived).toEqual(["blizzard", "fire_blast", "flamestrike", "meteor"]);
    for (const def of catalog) {
      expect(spellGroundTapAutoCastsForDef(def)).toBe(spellUsesManualGroundAim(def));
      expect(spellGroundTapAutoCasts(def.id)).toBe(spellUsesManualGroundAim(def));
    }
  });

  it("falls back to boot groundTap ids when the spell is absent from catalog", () => {
    const saved = [...catalog];
    setSpellCatalog([]);
    try {
      expect(spellGroundTapAutoCasts("meteor")).toBe(true);
      expect(spellGroundTapAutoCasts("unknown_spell")).toBe(false);
    } finally {
      setSpellCatalog(saved);
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