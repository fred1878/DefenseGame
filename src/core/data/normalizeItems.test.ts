import { describe, expect, it } from "vitest";
import { gearFixtureRaw } from "../../test/gearFixture";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeItems,
  normalizeOnHitProc,
  normalizeStatModifier,
  parseHexColor,
} from "./normalizeItems";

// biome-ignore lint/suspicious/noExplicitAny: tests patch arbitrary JSON paths
type LooseJson = Record<string, any>;

function withPatch(patch: (raw: LooseJson) => void): Record<string, unknown> {
  const raw = gearFixtureRaw() as LooseJson;
  patch(raw);
  return raw;
}

describe("normalizeItems", () => {
  it("parses rarities, bases, weapon profiles, affixes and uniques", () => {
    const c = normalizeItems(gearFixtureRaw());
    expect(c.armourHalfReductionAt).toBe(50);
    expect(c.armourMaxReductionPct).toBe(60);
    expect(c.statCaps.attackSpeedPct).toBe(50);
    expect(c.uniqueChanceByRarity.magic).toBe(0);
    expect(c.uniqueChanceByRarity.legendary).toBe(100);
    expect(c.uniques.flamebrand!.rarity).toBe("legendary");
    expect(c.bases.blade!.melee?.arcDeg).toBe(90);
    expect(c.bases.bow!.ranged?.projectile).toBe("fx_fire_bolt");
    expect(c.bases.bow!.ranged?.projectileTint).toBe(0x112233);
    expect(c.bases.blade!.modifiers).toEqual([]);
    expect(c.affixes.tough!.tiers.map((t) => t.minItemLevel)).toEqual([1, 4]);
    expect(c.affixes.of_mastery!.effect).toEqual({
      stat: "spellDamagePct",
      spells: ["fire_bolt"],
    });
    expect(c.affixes.of_chill!.effect).toEqual({
      proc: "slow",
      chancePct: 100,
      ms: 900,
    });
    expect(c.affixes.of_jolt!.effect).toEqual({ proc: "stun", chancePct: 100 });
    expect(c.uniques.flamebrand!.procs[0]!.kind).toBe("dot");
  });

  it("defaults a missing unique note to empty and omits an unset tint", () => {
    const c = normalizeItems(
      withPatch((r) => {
        delete r.uniques.flamebrand.note;
        delete r.bases.bow.ranged.projectileTint;
      }),
    );
    expect(c.uniques.flamebrand!.note).toBe("");
    expect(c.bases.bow!.ranged?.projectileTint).toBeUndefined();
  });

  it.each([
    ["missing root", () => null],
    ["bad cap stat", () => withPatch((r) => (r.statCaps.bogus = 1))],
    ["missing rarity", () => withPatch((r) => delete r.rarities.epic)],
    [
      "max < min affixes",
      () => withPatch((r) => (r.rarities.magic.maxAffixes = 0)),
    ],
    ["bad colour", () => withPatch((r) => (r.rarities.magic.color = "blue"))],
    ["bad type", () => withPatch((r) => (r.bases.cap.type = "hat"))],
    ["no melee profile", () => withPatch((r) => delete r.bases.blade.melee)],
    [
      "bad projectile",
      () => withPatch((r) => (r.bases.bow.ranged.projectile = "nope")),
    ],
    ["empty name", () => withPatch((r) => (r.bases.cap.name = ""))],
    [
      "modifiers not array",
      () => withPatch((r) => (r.bases.cap.modifiers = 3)),
    ],
    ["empty tiers", () => withPatch((r) => (r.affixes.tough.tiers = []))],
    [
      "empty spells",
      () => withPatch((r) => (r.affixes.of_mastery.effect.spells = [])),
    ],
    [
      "bad position",
      () => withPatch((r) => (r.affixes.tough.position = "middle")),
    ],
    [
      "unknown unique base",
      () => withPatch((r) => (r.uniques.flamebrand.baseId = "ghost")),
    ],
    [
      "common unique",
      () => withPatch((r) => (r.uniques.flamebrand.rarity = "common")),
    ],
    [
      "missing unique rarity",
      () => withPatch((r) => delete r.uniques.flamebrand.rarity),
    ],
    [
      "unique chance over 100",
      () => withPatch((r) => (r.uniqueChanceByRarity.magic = 140)),
    ],
    [
      "missing unique chance",
      () => withPatch((r) => delete r.uniqueChanceByRarity.rare),
    ],
  ])("throws ConfigLoadError for %s", (_label, make) => {
    expect(() => normalizeItems(make())).toThrow(ConfigLoadError);
  });
});

describe("normalizeStatModifier / normalizeOnHitProc", () => {
  it("parses keyed modifiers and rejects unknown stats", () => {
    expect(
      normalizeStatModifier(
        { stat: "spellCooldownPct", spell: "x", value: 5 },
        "m",
      ),
    ).toEqual({ stat: "spellCooldownPct", spell: "x", value: 5 });
    expect(
      normalizeStatModifier(
        { stat: "elementDamagePct", element: "frost", value: 2 },
        "m",
      ),
    ).toEqual({ stat: "elementDamagePct", element: "frost", value: 2 });
    expect(() =>
      normalizeStatModifier({ stat: "luck", value: 1 }, "m"),
    ).toThrow(ConfigLoadError);
    expect(() =>
      normalizeStatModifier(
        { stat: "elementDamagePct", element: "poison", value: 1 },
        "m",
      ),
    ).toThrow(ConfigLoadError);
  });

  it("parses each proc kind and rejects unknown kinds", () => {
    expect(
      normalizeOnHitProc(
        { kind: "slow", chancePct: 5, slowPct: 20, ms: 100 },
        "p",
      ),
    ).toEqual({ kind: "slow", chancePct: 5, slowPct: 20, ms: 100 });
    expect(
      normalizeOnHitProc({ kind: "stun", chancePct: 5, ms: 100 }, "p"),
    ).toEqual({ kind: "stun", chancePct: 5, ms: 100 });
    expect(() =>
      normalizeOnHitProc({ kind: "zap", chancePct: 1 }, "p"),
    ).toThrow(ConfigLoadError);
  });

  it("parses hex colours", () => {
    expect(parseHexColor("#ff0000", "c")).toBe(0xff0000);
    expect(() => parseHexColor(12, "c")).toThrow(ConfigLoadError);
  });
});
