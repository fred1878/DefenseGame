import { describe, expect, it } from "vitest";
import {
  groundDecorShouldPlace,
  groundTileVariantIndex,
} from "./groundTileVariant";

describe("groundTileVariantIndex", () => {
  it("is stable", () => {
    expect(groundTileVariantIndex(1, 2, 3, 6)).toBe(
      groundTileVariantIndex(1, 2, 3, 6),
    );
  });
});

describe("groundDecorShouldPlace", () => {
  it("places roughly 9% of cells", () => {
    let n = 0;
    for (let ty = 0; ty < 20; ty++) {
      for (let tx = 0; tx < 20; tx++) {
        if (groundDecorShouldPlace(tx, ty, 7)) n++;
      }
    }
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(60);
  });
});