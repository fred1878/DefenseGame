import { describe, expect, it } from "vitest";
import type { SpellDefinition } from "../content/spells";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeSpellCatalog,
  shadowformMechanicsFromCatalog,
} from "./normalizeSpells";

function spellRow(
  partial: Partial<SpellDefinition> & Pick<SpellDefinition, "id" | "mechanicType">,
): SpellDefinition {
  return {
    name: partial.id,
    shortLabel: partial.id,
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 0,
    channelMs: 0,
    iconFile: `${partial.id}.png`,
    ...partial,
  };
}

const KNOCKBACK_FIXTURE_CATALOG = {
  spells: [
    spellRow({
      id: "shadowform",
      mechanicType: "buff",
      shadowformDurationMs: 8000,
      shadowformMoveSpeedMult: 1.25,
      shadowformDamageTakenMult: 0.6,
      shadowformAggroRadiusMult: 0.4,
    }),
    spellRow({
      id: "test_blast",
      mechanicType: "blast",
      blastKnockbackWu: 120,
      blastRadiusWu: 64,
    }),
    spellRow({
      id: "test_bolt",
      mechanicType: "projectile",
      knockbackWu: 80,
    }),
    spellRow({
      id: "chain_lightning",
      mechanicType: "tracking_projectile",
      knockbackWu: 40,
      chainKnockbackWu: 30,
      chainHopKnockbackWu: 20,
      chainLightningHops: 3,
      chainLightningHopRangeWu: 96,
    }),
    spellRow({
      id: "test_blink",
      mechanicType: "blink",
      blinkDistanceWu: 120,
      blinkResolveBinarySearchIterations: 24,
      blinkPartialMoveEpsilonWu: 0.5,
    }),
    spellRow({
      id: "test_swing",
      mechanicType: "swing",
      swingRangeWu: 48,
      swingArcDeg: 90,
      knockbackWu: 50,
    }),
  ],
} satisfies { spells: SpellDefinition[] };

describe("normalizeSpellCatalog", () => {
  it("rejects empty catalog", () => {
    expect(() => normalizeSpellCatalog({ spells: [] })).toThrow(ConfigLoadError);
  });

  it("requires knockback on projectile spells", () => {
    expect(() =>
      normalizeSpellCatalog({
        spells: [
          spellRow({
            id: "x",
            mechanicType: "projectile",
          }),
        ],
      }),
    ).toThrow(/knockback/);
  });

  it("accepts mechanic knockback and shadowform fields when wired", () => {
    const rows = normalizeSpellCatalog(KNOCKBACK_FIXTURE_CATALOG);
    expect(rows).toHaveLength(KNOCKBACK_FIXTURE_CATALOG.spells.length);

    const blast = rows.find((s) => s.id === "test_blast");
    expect(blast?.blastKnockbackWu).toBe(120);
    expect(blast?.blastRadiusWu).toBe(64);

    const bolt = rows.find((s) => s.id === "test_bolt");
    expect(bolt?.knockbackWu).toBe(80);

    const chain = rows.find((s) => s.id === "chain_lightning");
    expect(chain?.chainKnockbackWu).toBe(30);
    expect(chain?.chainHopKnockbackWu).toBe(20);
    expect(chain?.chainLightningHops).toBe(3);
    expect(chain?.chainLightningHopRangeWu).toBe(96);

    const blink = rows.find((s) => s.id === "test_blink");
    expect(blink?.blinkDistanceWu).toBe(120);
    expect(blink?.blinkResolveBinarySearchIterations).toBe(24);
    expect(blink?.blinkPartialMoveEpsilonWu).toBe(0.5);

    const swing = rows.find((s) => s.id === "test_swing");
    expect(swing?.swingRangeWu).toBe(48);
    expect(swing?.swingArcDeg).toBe(90);
    expect(swing?.knockbackWu).toBe(50);

    const shade = rows.find((s) => s.id === "shadowform");
    expect(shade?.shadowformMoveSpeedMult).toBe(1.25);
    expect(shade?.shadowformDamageTakenMult).toBe(0.6);
    expect(shade?.shadowformAggroRadiusMult).toBe(0.4);

    const mechanics = shadowformMechanicsFromCatalog(rows);
    expect(mechanics).toEqual({
      moveSpeedMult: 1.25,
      damageTakenMult: 0.6,
      aggroRadiusMult: 0.4,
    });
  });

  it("rejects invalid shadowform damage taken mult", () => {
    expect(() =>
      normalizeSpellCatalog({
        spells: [
          spellRow({
            id: "shadowform",
            mechanicType: "buff",
            shadowformDurationMs: 1000,
            shadowformMoveSpeedMult: 1,
            shadowformDamageTakenMult: 1.5,
            shadowformAggroRadiusMult: 0.5,
          }),
        ],
      }),
    ).toThrow(ConfigLoadError);
  });
});