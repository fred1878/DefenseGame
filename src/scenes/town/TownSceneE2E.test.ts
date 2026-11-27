import { describe, expect, it } from "vitest";
import type { DataStore } from "../../core/data/DataStore";
import type { TownBuildingControl } from "./TownBuildings";
import type { TownOverlays } from "./TownOverlays";
import { collectTownTouchDebugUiRects } from "./TownTouchDebug";
import type { TouchInputDebugDraw } from "../../debug/TouchInputDebugDraw";
import type Phaser from "phaser";
import {
  collectTownUiTapTargets,
  isTownTouchButtonPressed,
} from "./TownSceneE2E";

function control(x: number, y: number): TownBuildingControl {
  return {
    spriteCenter: () => ({ x, y }),
    container: { getData: () => false },
  } as unknown as TownBuildingControl;
}

describe("TownSceneE2E tap targets", () => {
  it("keys buildings by test id, maps the night starter, and adds overlay targets", () => {
    const store = {
      townBuildings: { smith: {}, gallows: { startsNight: true } },
    } as unknown as DataStore;
    const controls = new Map([
      ["smith", control(1, 2)],
      ["gallows", control(3, 4)],
    ]);
    const overlays = {
      collectE2eTapTargets: (out: Record<string, { x: number; y: number }>) => {
        out["save-menu"] = { x: 9, y: 9 };
      },
    } as unknown as TownOverlays;
    expect(collectTownUiTapTargets(store, controls, overlays)).toEqual({
      "town-building-smith": { x: 1, y: 2 },
      "town-building-gallows": { x: 3, y: 4 },
      "start-night": { x: 3, y: 4 },
      "save-menu": { x: 9, y: 9 },
    });
  });

  it("only reports the night-start button as pressable", () => {
    expect(isTownTouchButtonPressed(new Map(), "start-night")).toBe(false);
    expect(isTownTouchButtonPressed(new Map(), "other")).toBe(false);
    const pressed = {
      container: { scaleX: 0.9, scaleY: 0.9 },
    } as unknown as TownBuildingControl;
    const controls = new Map([["town_special_gallows_square", pressed]]);
    expect(isTownTouchButtonPressed(controls, "start-night")).toBe(true);
  });
});

describe("collectTownTouchDebugUiRects", () => {
  it("adds overlay rects after the scene's interactive rects", () => {
    const scene = {
      children: { list: [] },
      cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1 } },
    } as unknown as Phaser.Scene;
    const touchDebug = {
      uiGraphics: () => ({}),
      worldGraphics: () => ({}),
    } as unknown as TouchInputDebugDraw;
    const rect = { x: 1, y: 2, w: 3, h: 4 };
    expect(collectTownTouchDebugUiRects(scene, touchDebug)).toEqual([]);
    const overlays = {
      collectTouchDebugScreenRects: () => [rect],
    } as unknown as TownOverlays;
    expect(collectTownTouchDebugUiRects(scene, touchDebug, overlays)).toEqual([
      rect,
    ]);
  });
});
