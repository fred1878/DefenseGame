import { describe, expect, it } from "vitest";
import {
  CHANNELED_CONE_MAX_TICKS,
  advanceChanneledConeTicks,
  channeledConeChannelMs,
  createChanneledConeTickState,
} from "./channeledConeChannel";
import type { SpellDefinition } from "../../content/spells";

function channeledConeDef(): SpellDefinition {
  return {
    id: "cone_of_fire",
    name: "Cone Of Fire",
    shortLabel: "Cone",
    mechanicType: "channeled_cone",
    castableInDefense: true,
    implementationPhase: 3,
    cooldownMs: 6000,
    channelMs: 750,
    channelTickMs: 250,
    baseDamage: 8,
    iconFile: "cone_of_fire.png",
    damageFlavor: "fire",
    coneRangeWu: 180,
  };
}

describe("channeledConeChannel", () => {
  it("fires three ticks on 250ms cadence (first tick after 250ms)", () => {
    const def = channeledConeDef();
    expect(channeledConeChannelMs(def)).toBe(750);
    const state = createChanneledConeTickState();
    expect(advanceChanneledConeTicks(state, def, 249)).toBe(0);
    expect(advanceChanneledConeTicks(state, def, 1)).toBe(1);
    expect(advanceChanneledConeTicks(state, def, 250)).toBe(1);
    expect(advanceChanneledConeTicks(state, def, 250)).toBe(1);
    expect(state.ticksDone).toBe(3);
    expect(advanceChanneledConeTicks(state, def, 500)).toBe(0);
    expect(state.ticksDone).toBe(CHANNELED_CONE_MAX_TICKS);
  });
});
