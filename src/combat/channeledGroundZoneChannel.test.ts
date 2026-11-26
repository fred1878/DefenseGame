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

describe("channeledGroundZoneChannel leftover branches", () => {
  it("uses one tick and zero damage when channel and damage are missing", () => {
    const def = channeledGroundDef(12);
    delete (def as { channelMs?: number }).channelMs;
    delete (def as { baseDamage?: number }).baseDamage;
    expect(channeledGroundZoneMaxTicks(def)).toBe(1);
    expect(channeledGroundZoneTotalDamage(def, 2)).toBe(0);
    expect(channeledGroundZonePerTickDamage(def, 2)).toBe(0);
  });

  it("uses one tick when channelMs is zero", () => {
    const def = channeledGroundDef(12);
    def.channelMs = 0;
    expect(channeledGroundZoneMaxTicks(def)).toBe(1);
  });
});
