import { describe, expect, it } from "vitest";
import {
  DEBUG_CAMERA_ROUND_PIXELS_KEY,
  DEBUG_RENDERER_ROUND_PIXELS_KEY,
  DEBUG_SCALE_AUTO_ROUND_KEY,
  getDebugCameraRoundPixels,
  getDebugRendererRoundPixels,
  getDebugScaleAutoRound,
} from "./pixelRenderDebug";
import { getDebugWorldTextureFilter } from "./pixelArtTextures";

function fakeRegistry(store: Record<string, unknown> = {}) {
  return {
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
  } as Phaser.Data.DataManager;
}

describe("pixelRenderDebug registry defaults", () => {
  it("defaults match production gameMain settings", () => {
    const reg = fakeRegistry();
    expect(getDebugWorldTextureFilter(reg)).toBe("nearest");
    expect(getDebugCameraRoundPixels(reg)).toBe(true);
    expect(getDebugRendererRoundPixels(reg)).toBe(true);
    expect(getDebugScaleAutoRound(reg)).toBe(true);
  });

  it("reads stored boolean overrides", () => {
    const reg = fakeRegistry({
      [DEBUG_CAMERA_ROUND_PIXELS_KEY]: false,
      [DEBUG_RENDERER_ROUND_PIXELS_KEY]: false,
      [DEBUG_SCALE_AUTO_ROUND_KEY]: false,
    });
    expect(getDebugCameraRoundPixels(reg)).toBe(false);
    expect(getDebugRendererRoundPixels(reg)).toBe(false);
    expect(getDebugScaleAutoRound(reg)).toBe(false);
  });
});
