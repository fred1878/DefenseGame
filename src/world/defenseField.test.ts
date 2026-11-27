import { defenseFieldTiles } from "../config/defense";
import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { GAME } from "../config/game";
import {
  DEFENSE_FIELD_PX,
  defenseFieldPx,
  defenseHalfHeight,
} from "../config/defense";
import { GROUND_TILE_SIZE } from "../content/assets";
import {
  WORLD_PIXEL_SCALE_REGISTRY_KEY,
  worldDisplayPx,
} from "../config/worldScale";

function fakeRegistry(
  store: Record<string, unknown> = {},
): Phaser.Data.DataManager {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("defense field tiles", () => {
  it("uses fewer cols than rows", () => {
    expect(defenseFieldTiles().cols).toBeLessThan(defenseFieldTiles().rows);
  });

  it("derives pixel size from 64px tiles", () => {
    expect(DEFENSE_FIELD_PX.width).toBe(
      defenseFieldTiles().cols * GROUND_TILE_SIZE,
    );
    expect(DEFENSE_FIELD_PX.height).toBe(
      defenseFieldTiles().rows * GROUND_TILE_SIZE,
    );
  });

  it("matches night-field data footprint: one-screen wide, taller than viewport", () => {
    const colsOneScreen = Math.floor(GAME.width / GROUND_TILE_SIZE);
    expect(defenseFieldTiles()).toEqual({ cols: colsOneScreen, rows: 22 });
    expect(DEFENSE_FIELD_PX.width).toBe(colsOneScreen * GROUND_TILE_SIZE);
    expect(DEFENSE_FIELD_PX.width).toBeLessThanOrEqual(GAME.width);
    expect(DEFENSE_FIELD_PX.height).toBeGreaterThan(GAME.height);
  });

  it("places north wall inside the north edge", () => {
    expect(defenseHalfHeight() * 2).toBe(DEFENSE_FIELD_PX.height);
  });

  it("scales field footprint with debug world pixel scale", () => {
    const baseline = defenseFieldPx();
    const reg1 = fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 1 });
    const reg3 = fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 3 });
    const at1 = defenseFieldPx(reg1);
    const at3 = defenseFieldPx(reg3);
    const step2 = worldDisplayPx(
      GROUND_TILE_SIZE,
      fakeRegistry({ [WORLD_PIXEL_SCALE_REGISTRY_KEY]: 2 }),
    );
    expect(baseline.width).toBe(defenseFieldTiles().cols * step2);
    expect(at1.width).toBeCloseTo(baseline.width * 0.5, 5);
    expect(at3.width).toBeCloseTo(baseline.width * 1.5, 5);
    expect(at1.height).toBeCloseTo(baseline.height * 0.5, 5);
  });
});
