import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeHitFlash } from "./normalizeHitFlash";

const flavorDefaults = {
  colorFade: true,
  alphaFade: true,
};

const completeFixture = {
  durationMs: 190,
  flavors: {
    physical: {
      tint: 16777215,
      mode: "fill",
      peakAlpha: 1,
      colorFade: false,
      alphaFade: true,
    },
    fire: {
      tint: 16724738,
      mode: "multiply",
      peakAlpha: 1,
      ...flavorDefaults,
    },
    frost: {
      tint: 10075895,
      mode: "multiply",
      peakAlpha: 1,
      ...flavorDefaults,
    },
    water: {
      tint: 7254992,
      mode: "multiply",
      peakAlpha: 1,
      ...flavorDefaults,
    },
  },
};

describe("normalizeHitFlash", () => {
  it("requires duration and every damage flavor", () => {
    expect(() => normalizeHitFlash({})).toThrow(ConfigLoadError);
    expect(() =>
      normalizeHitFlash({
        durationMs: 100,
        flavors: { physical: completeFixture.flavors.physical },
      }),
    ).toThrow(ConfigLoadError);
  });

  it("rejects invalid tint, mode, peakAlpha, or fade flags", () => {
    expect(() =>
      normalizeHitFlash({
        ...completeFixture,
        flavors: {
          ...completeFixture.flavors,
          fire: { tint: 1.5, mode: "multiply", peakAlpha: 1, ...flavorDefaults },
        },
      }),
    ).toThrow(ConfigLoadError);
    expect(() =>
      normalizeHitFlash({
        ...completeFixture,
        flavors: {
          ...completeFixture.flavors,
          fire: {
            tint: 16711680,
            mode: "blend",
            peakAlpha: 1,
            ...flavorDefaults,
          },
        },
      }),
    ).toThrow(ConfigLoadError);
    expect(() =>
      normalizeHitFlash({
        ...completeFixture,
        flavors: {
          ...completeFixture.flavors,
          fire: {
            tint: 16724738,
            mode: "multiply",
            peakAlpha: 1,
            colorFade: "yes",
            alphaFade: true,
          },
        },
      }),
    ).toThrow(ConfigLoadError);
  });

  it("returns parsed config from a complete fixture", () => {
    const out = normalizeHitFlash(completeFixture);
    expect(out.durationMs).toBe(190);
    expect(out.flavors.fire.mode).toBe("multiply");
    expect(out.flavors.fire.colorFade).toBe(true);
    expect(out.flavors.physical.mode).toBe("fill");
    expect(out.flavors.physical.colorFade).toBe(false);
    expect(out.flavors.water.tint).toBe(7254992);
  });
});