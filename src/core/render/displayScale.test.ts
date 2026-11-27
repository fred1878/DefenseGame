import { describe, expect, it } from "vitest";
import { GAME } from "../../config/game";
import { scaleUiX, scaleUiY, uiScaleX, uiScaleY } from "../../config/uiScale";

describe("displayScale", () => {
  it("uses 540×1200 game canvas (9:20)", () => {
    expect(GAME.width).toBe(540);
    expect(GAME.height).toBe(1200);
    expect(GAME.width / GAME.height).toBeCloseTo(9 / 20, 5);
  });

  it("scales legacy 390×844 UI constants up", () => {
    expect(uiScaleX()).toBeCloseTo(540 / 390, 5);
    expect(uiScaleY()).toBeCloseTo(1200 / 844, 5);
    expect(scaleUiX(100)).toBe(138);
    expect(scaleUiY(100)).toBe(142);
  });
});
