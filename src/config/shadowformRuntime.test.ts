import { describe, expect, it, beforeEach } from "vitest";
import {
  playerAggroRadiusWu,
  playerIncomingDamageMult,
  resetShadowformRuntimeMults,
  setShadowformRuntimeMults,
} from "./shadowformRuntime";

describe("shadowformRuntime", () => {
  beforeEach(() => resetShadowformRuntimeMults());

  it("defaults to neutral multipliers", () => {
    expect(playerIncomingDamageMult()).toBe(1);
    expect(playerAggroRadiusWu(320)).toBe(320);
  });

  it("applies runtime mults from defense tick", () => {
    setShadowformRuntimeMults({
      damageTakenMult: 0.7,
      aggroRadiusMult: 0.5,
    });
    expect(playerIncomingDamageMult()).toBe(0.7);
    expect(playerAggroRadiusWu(320)).toBe(160);
  });
});