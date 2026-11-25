import { describe, expect, it } from "vitest";
import {
  advanceChanneledHealTicks,
  channeledHealCompletionRemainder,
  channeledHealMaxTicks,
  channeledHealPerTickAmount,
  createChanneledHealTickState,
} from "./channeledHealChannel";
import type { SpellDefinition } from "../content/spells";

function channeledHealDef(): SpellDefinition {
  return {
    id: "heal",
    name: "Heal",
    shortLabel: "Heal",
    mechanicType: "heal",
    castableInDefense: true,
    implementationPhase: 1,
    cooldownMs: 12000,
    channelMs: 1500,
    channelTickMs: 250,
    healAmount: 42,
    iconFile: "heal.png",
    targetMode: "self",
  };
}

describe("channeledHealChannel", () => {
  it("splits healAmount evenly across channel ticks when total divides evenly", () => {
    const def = channeledHealDef();
    expect(channeledHealMaxTicks(def)).toBe(6);
    expect(channeledHealPerTickAmount(def)).toBe(7);
    expect(channeledHealCompletionRemainder(def)).toBe(0);
  });

  it("fires heal ticks on 250ms cadence (first tick after 250ms)", () => {
    const def = channeledHealDef();
    const state = createChanneledHealTickState();
    expect(advanceChanneledHealTicks(state, def, 249)).toBe(0);
    expect(advanceChanneledHealTicks(state, def, 1)).toBe(1);
    for (let i = 0; i < 5; i++) {
      expect(advanceChanneledHealTicks(state, def, 250)).toBe(1);
    }
    expect(state.ticksDone).toBe(6);
    expect(advanceChanneledHealTicks(state, def, 500)).toBe(0);
  });
});
