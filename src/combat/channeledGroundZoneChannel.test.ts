import { describe, expect, it } from "vitest";
import type { SpellDefinition } from "../content/spells";
import {
  channeledGroundZoneCompletionRemainder,
  channeledGroundZoneMaxTicks,
  channeledGroundZonePerTickDamage,
  channeledGroundZoneTotalDamage,
} from "./channeledGroundZoneChannel";

function channeledGroundDef(baseDamage: number): SpellDefinition {
  return {
    id: "blizzard",
    name: "Blizzard",
    shortLabel: "Bliz",
    mechanicType: "channeled",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 1100,
    channelMs: 1500,
    channelTickMs: 250,
    baseDamage,
    blastRadiusWu: 80,
    iconFile: "blizzard.png",
    targetMode: "ground",
    damageFlavor: "frost",
  };
}

describe("channeledGroundZoneChannel", () => {
  it("splits baseDamage × mult evenly across channel ticks when total divides evenly", () => {
    const def = channeledGroundDef(42);
    const mult = 1;
    expect(channeledGroundZoneMaxTicks(def)).toBe(6);
    expect(channeledGroundZoneTotalDamage(def, mult)).toBe(42);
    expect(channeledGroundZonePerTickDamage(def, mult)).toBe(7);
    expect(channeledGroundZoneCompletionRemainder(def, mult)).toBe(0);
  });

  it("applies undivided remainder on the last tick (completion remainder)", () => {
    const def = channeledGroundDef(43);
    const mult = 1;
    expect(channeledGroundZoneMaxTicks(def)).toBe(6);
    expect(channeledGroundZonePerTickDamage(def, mult)).toBe(7);
    expect(channeledGroundZoneCompletionRemainder(def, mult)).toBe(1);
  });

  it("scales total channel budget by spell damage mult", () => {
    const def = channeledGroundDef(10);
    expect(channeledGroundZoneTotalDamage(def, 1.5)).toBe(15);
    expect(channeledGroundZonePerTickDamage(def, 1.5)).toBe(2);
    expect(channeledGroundZoneCompletionRemainder(def, 1.5)).toBe(3);
  });
});
