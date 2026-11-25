import { describe, expect, it } from "vitest";
import { ConfigLoadError } from "./configValidation";
import { normalizeTownLayout } from "./normalizeTownLayout";

const minimalSlot = {
  buildingId: "town_market_stall",
  x: 100,
  y: 200,
};

describe("normalizeTownLayout", () => {
  it("accepts buildingDisplayScale and slots", () => {
    const layout = normalizeTownLayout({
      buildingDisplayScale: 2,
      slots: [minimalSlot],
    });
    expect(layout.buildingDisplayScale).toBe(2);
    expect(layout.slots).toHaveLength(1);
    expect(layout.slots[0]!.buildingId).toBe("town_market_stall");
  });

  it("rejects missing buildingDisplayScale", () => {
    expect(() => normalizeTownLayout({ slots: [minimalSlot] })).toThrow(
      ConfigLoadError,
    );
  });

  it("rejects buildingDisplayScale below 1", () => {
    expect(() =>
      normalizeTownLayout({ buildingDisplayScale: 0.5, slots: [minimalSlot] }),
    ).toThrow(/buildingDisplayScale must be >= 1/);
  });

  it("rejects invalid slots", () => {
    expect(() =>
      normalizeTownLayout({ buildingDisplayScale: 1, slots: {} as never }),
    ).toThrow(/town_layout\.slots/);
  });
});
