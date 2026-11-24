import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ConfigLoadError } from "./configValidation";
import {
  normalizeSpellCatalog,
  shadowformMechanicsFromCatalog,
} from "./normalizeSpells";

function shippedSpells() {
  const file = path.join(process.cwd(), "public/data/spells.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("normalizeSpellCatalog", () => {
  it("rejects empty catalog", () => {
    expect(() => normalizeSpellCatalog({ spells: [] })).toThrow(ConfigLoadError);
  });

  it("requires knockback on projectile spells", () => {
    expect(() =>
      normalizeSpellCatalog({
        spells: [
          {
            id: "x",
            name: "X",
            shortLabel: "X",
            mechanicType: "projectile",
            castableInDefense: true,
            implementationPhase: 1,
            cooldownMs: 0,
            channelMs: 0,
            iconFile: "x.png",
          },
        ],
      }),
    ).toThrow(/knockback/);
  });

  it("accepts shipped spells.json knockback wiring", () => {
    const shipped = shippedSpells();
    const rawShade = shipped.spells.find((s: { id: string }) => s.id === "shadowform") as
      | {
          shadowformMoveSpeedMult: number;
          shadowformDamageTakenMult: number;
          shadowformAggroRadiusMult: number;
        }
      | undefined;
    expect(rawShade).toBeDefined();

    const rows = normalizeSpellCatalog(shipped);
    expect(rows.length).toBeGreaterThan(0);
    const nova = rows.find((s) => s.id === "fire_nova");
    expect(typeof nova?.blastKnockbackWu).toBe("number");
    const bolt = rows.find((s) => s.id === "lightning_bolt");
    expect(typeof bolt?.knockbackWu).toBe("number");
    const chain = rows.find((s) => s.id === "chain_lightning");
    expect(typeof chain?.chainKnockbackWu).toBe("number");
    expect(typeof chain?.chainHopKnockbackWu).toBe("number");
    expect(chain?.chainLightningHops).toBeDefined();
    expect(chain?.chainLightningHopRangeWu).toBeDefined();
    const blink = rows.find((s) => s.id === "blink");
    expect(blink?.blinkDistanceWu).toBeDefined();
    expect(blink?.blinkResolveBinarySearchIterations).toBe(24);
    expect(blink?.blinkPartialMoveEpsilonWu).toBe(0.5);
    const swing = rows.find((s) => s.id === "swing");
    expect(swing?.swingRangeWu).toBeDefined();
    expect(swing?.swingArcDeg).toBeDefined();
    const shade = rows.find((s) => s.id === "shadowform");
    expect(shade?.shadowformMoveSpeedMult).toBe(rawShade!.shadowformMoveSpeedMult);
    expect(shade?.shadowformDamageTakenMult).toBe(rawShade!.shadowformDamageTakenMult);
    expect(shade?.shadowformAggroRadiusMult).toBe(rawShade!.shadowformAggroRadiusMult);
    const mechanics = shadowformMechanicsFromCatalog(rows);
    expect(mechanics.moveSpeedMult).toBe(rawShade!.shadowformMoveSpeedMult);
    expect(mechanics.damageTakenMult).toBe(rawShade!.shadowformDamageTakenMult);
    expect(mechanics.aggroRadiusMult).toBe(rawShade!.shadowformAggroRadiusMult);
  });

  it("rejects invalid shadowform damage taken mult", () => {
    const base = shippedSpells();
    const spells = base.spells.map((s: { id: string }) =>
      s.id === "shadowform"
        ? { ...s, shadowformDamageTakenMult: 1.5 }
        : s,
    );
    expect(() => normalizeSpellCatalog({ spells })).toThrow(ConfigLoadError);
  });
});