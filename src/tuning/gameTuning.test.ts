import { describe, expect, it, vi } from "vitest";
import { setTuning, tuning } from "./gameTuning";

describe("gameTuning", () => {
  it("returns a frozen copy of what was set", () => {
    const src = {
      moveSpeedMult: 1.2,
      damageTakenMult: 0.5,
      aggroRadiusMult: 0.25,
    };
    setTuning("shadowform", src);
    const got = tuning("shadowform");
    expect(got).toEqual(src);
    expect(got).not.toBe(src);
    expect(Object.isFrozen(got)).toBe(true);
    src.moveSpeedMult = 9;
    expect(tuning("shadowform").moveSpeedMult).toBe(1.2);
  });

  it("names the JSON file when a slot is read before Boot loads it", async () => {
    vi.resetModules();
    const fresh = await import("./gameTuning");
    expect(() => fresh.tuning("enemyAi")).toThrow(
      /enemyAi tuning not loaded — Boot must apply public\/data\/enemy-ai\.json/,
    );
  });
});
