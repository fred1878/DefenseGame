import { describe, expect, it } from "vitest";
import shipped from "../../../public/data/damage-numbers.json";
import { normalizeDamageNumbers } from "./normalizeDamageNumbers";

describe("normalizeDamageNumbers", () => {
  it("reads the shipped file", () => {
    const out = normalizeDamageNumbers(shipped);
    expect(out.maxActive).toBe(32);
    expect(out.styles.heal.prefix).toBe("+");
    expect(out.styles.fire.motion.flickerHz).toBe(14);
    expect(out.styles.physical.motion.flickerHz).toBeUndefined();
  });

  it("names the missing field", () => {
    expect(() =>
      normalizeDamageNumbers({ ...shipped, enabled: "yes" }),
    ).toThrow(/damage-numbers\.enabled/);
    const { poison: _p, ...styles } = shipped.styles;
    expect(() => normalizeDamageNumbers({ ...shipped, styles })).toThrow(
      /damage-numbers\.styles\.poison/,
    );
    expect(() =>
      normalizeDamageNumbers({
        ...shipped,
        styles: {
          ...shipped.styles,
          frost: {
            ...shipped.styles.frost,
            motion: { ...shipped.styles.frost.motion, popMs: undefined },
          },
        },
      }),
    ).toThrow(/styles\.frost\.motion\.popMs/);
  });
});
