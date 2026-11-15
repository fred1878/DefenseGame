import { describe, expect, it } from "vitest";
import { groundTileVariantIndex } from "./groundTileVariant";

describe("groundTileVariantIndex", () => {
  it("is stable for the same cell and seed", () => {
    expect(groundTileVariantIndex(3, 7, 42, 4)).toBe(
      groundTileVariantIndex(3, 7, 42, 4),
    );
  });

  it("varies across neighboring cells", () => {
    const a = groundTileVariantIndex(0, 0, 1, 4);
    const b = groundTileVariantIndex(1, 0, 1, 4);
    const c = groundTileVariantIndex(0, 1, 1, 4);
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it("shifts when night seed changes", () => {
    expect(groundTileVariantIndex(5, 5, 1, 4)).not.toBe(
      groundTileVariantIndex(5, 5, 2, 4),
    );
  });
});