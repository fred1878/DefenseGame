import { describe, expect, it } from "vitest";
import { GAME } from "../config/game";
import {
  DEFENSE_FIELD_PX,
  DEFENSE_FIELD_TILES,
  defenseHalfHeight,
} from "../config/defense";
import { GROUND_TILE_SIZE } from "../content/assets";

describe("defense field tiles", () => {
  it("uses fewer cols than rows", () => {
    expect(DEFENSE_FIELD_TILES.cols).toBeLessThan(DEFENSE_FIELD_TILES.rows);
  });

  it("derives pixel size from 64px tiles", () => {
    expect(DEFENSE_FIELD_PX.width).toBe(
      DEFENSE_FIELD_TILES.cols * GROUND_TILE_SIZE,
    );
    expect(DEFENSE_FIELD_PX.height).toBe(
      DEFENSE_FIELD_TILES.rows * GROUND_TILE_SIZE,
    );
  });

  it("is taller than the portrait viewport for vertical scroll", () => {
    expect(DEFENSE_FIELD_PX.height).toBeGreaterThan(GAME.height);
    expect(DEFENSE_FIELD_PX.width).toBeLessThan(GAME.width);
  });

  it("places north wall inside the north edge", () => {
    expect(defenseHalfHeight() * 2).toBe(DEFENSE_FIELD_PX.height);
  });
});