import { describe, expect, it } from "vitest";
import { pressDragExceedsThreshold, releaseOnSameButton } from "./touchButtonGesture";

describe("pressDragExceedsThreshold", () => {
  it("returns false inside threshold", () => {
    expect(pressDragExceedsThreshold(0, 0, 10, 0, 24)).toBe(false);
  });

  it("returns true beyond threshold", () => {
    expect(pressDragExceedsThreshold(0, 0, 30, 0, 24)).toBe(true);
  });
});

describe("releaseOnSameButton", () => {
  const bounds = { x: 100, y: 200, width: 80, height: 40 };

  it("accepts release inside bounds", () => {
    expect(releaseOnSameButton(bounds, 140, 220, 0)).toBe(true);
  });

  it("accepts release within slop outside bounds", () => {
    expect(releaseOnSameButton(bounds, 95, 220, 28)).toBe(true);
    expect(releaseOnSameButton(bounds, 185, 220, 28)).toBe(true);
  });

  it("rejects release far outside slop", () => {
    expect(releaseOnSameButton(bounds, 50, 220, 10)).toBe(false);
  });

  it("rejects vertical drift beyond slop (drag-off cancel path)", () => {
    expect(releaseOnSameButton(bounds, 140, 160, 20)).toBe(false);
  });
});