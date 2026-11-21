import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ConfigLoadError } from "./configValidation";
import { normalizeSpellCatalog } from "./normalizeSpells";

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
    const rows = normalizeSpellCatalog(shippedSpells());
    expect(rows.length).toBeGreaterThan(0);
    const nova = rows.find((s) => s.id === "fire_nova");
    expect(nova?.blastKnockback).toBe(0);
    const bolt = rows.find((s) => s.id === "lightning_bolt");
    expect(bolt?.knockback).toBe(140);
    const chain = rows.find((s) => s.id === "chain_lightning");
    expect(chain?.chainKnockback).toBe(120);
    expect(chain?.chainHopKnockback).toBe(100);
  });
});